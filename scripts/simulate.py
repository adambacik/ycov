#!/usr/bin/env python3
"""
Simulate mosdepth-style coverage with a known truth for testing ycov.

Builds the 1 kb window grid (chr19-22, chrX, chrY), labels each
window with its sequence class, gaps and AZF/PAR regions, and simulates depth
for every scenario in SCENARIOS (normal male, AZF deletions, mLOY, female,
XYY, shallow sample, ...). Writes for every sample an all-reads and a
MAPQ >= 20 coverage file in mosdepth --by format, plus truth.tsv describing
what was simulated.

Output (in --outdir):
    <sample>.regions.bed.gz      + .csi   depth, all reads
    <sample>.q20.regions.bed.gz  + .csi   depth, MAPQ >= 20
    truth.tsv                             simulated events per sample
    metadata.tsv                          sample metadata for ycov prepare (no truth)

Requirements:
    - bgzip and tabix (htslib) in PATH
    - numpy, pandas

Usage:
    python simulate.py <reference.fasta> <sequence_classes.bed> <gaps.bed> <regions.bed>
                       [--outdir DIR] [--seed N]

Example:
    python simulate.py chm13v2.0.XY.fasta \\
        ../src/ycov/annotations/chm13/sequence_classes.bed \\
        ../src/ycov/annotations/chm13/gaps.bed \\
        ../src/ycov/annotations/chm13/regions.bed \\
        --outdir ~/ycov_data/sim --seed 42
"""


import argparse
import shutil
import subprocess
import sys
import zlib
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

CHROMS = ["chr19", "chr20", "chr21", "chr22", "chrX", "chrY"]
WINDOW_SIZE = 1_000

# CHM13 chrX PAR1 / PAR2 (chm13v2.0.PAR.bed), the chrY PARs are masked, so reads of both copies map here
X_PARS = [(0, 2_394_410), (153_925_834, 154_259_566)]

# Read length for the counting noise (1KGP high-coverage: 2 x 150 bp)
READ_LEN = 150

# (depth factor, mapq >= 20 fraction, CV) for every seq class; CV = extra variation on top of the counting noise
# Data based on scripts/measure_class_effects.py script
CLASS_EFFECTS: dict[str, tuple[float, float, float]] = {} # TODO

# chrX, autosomes and windows without a class (PAR1/PAR2 are gaps and end up 0 anyway)
DEFAULT_EFFECT = () # TODO

TruthRow = dict[str, str | float | int | None]


@dataclass
class Scenario:
    """One simulated sample: its identity and truth, its metadata.tsv row and the parameters for set_depths."""
    # identity and truth
    sample_id: str
    name: str
    sex: str
    # metadata.tsv
    age: int
    population: str
    phenotype: str
    # simulation
    depth: float = 30.0
    x_copies: float = 1.0
    y_copies: float = 1.0
    deleted: list[str] = field(default_factory=list)
    partial: list[tuple[str, int, int, float]] = field(default_factory=list)   # (label, start, end, rel_copy) on chrY
    reported_sex: str | None = None   # sex written to metadata.tsv; None = same as sex


SCENARIOS = [
    Scenario(sample_id="S01", name="normal_male", sex="M", age=34, population="SIM_A", phenotype="fertile"),
    Scenario(sample_id="S02", name="azfc_del", sex="M", age=38, population="SIM_A", phenotype="azoospermia",
             deleted=["AZFc"]),
    Scenario(sample_id="S03", name="mloy_50", sex="M", age=78, population="SIM_B", phenotype="fertile",
             y_copies=0.5),
    Scenario(sample_id="S04", name="female", sex="F", age=29, population="SIM_B", phenotype="fertile",
             x_copies=2.0, y_copies=0.0),
    Scenario(sample_id="S05", name="xyy", sex="M", age=25, population="SIM_A", phenotype="fertile",
             y_copies=2.0),
    Scenario(sample_id="S06", name="shallow_5x", sex="M", age=45, population="SIM_B", phenotype="fertile",
             depth=5.0),
    Scenario(sample_id="S07", name="azfa_del", sex="M", age=33, population="SIM_A", phenotype="azoospermia",
             deleted=["AZFa"]),
    Scenario(sample_id="S08", name="azfb_del", sex="M", age=36, population="SIM_B", phenotype="azoospermia",
             deleted=["AZFb"]),
    Scenario(sample_id="S09", name="normal_male_2", sex="M", age=52, population="SIM_B", phenotype="fertile"),
    Scenario(sample_id="S10", name="normal_male_3", sex="M", age=61, population="SIM_A", phenotype="fertile"),
    Scenario(sample_id="S11", name="partial_azfc", sex="M", age=40, population="SIM_B", phenotype="oligozoospermia",
             partial=[("azfc_partial", 26_490_936, 27_020_249, 0.5)]),  # generic: the part of AZFc outside AZFb, not gr/gr
]


def get_chromosome_lengths(fasta: Path) -> dict[str, int]:
    """Read the lengths of the CHROMS from the FASTA's .fai index, fail if it or any of them is missing."""
    fai = fasta.with_name(fasta.name + ".fai")
    if not fai.exists():
        raise FileNotFoundError(f"FASTA index file {fai} does not exist. Please create it using samtools faidx.")

    df = pd.read_csv(fai, sep="\t", header=None, usecols=[0, 1], names=["chrom", "length"])
    lengths = dict(zip(df["chrom"], df["length"]))

    missing = [c for c in CHROMS if c not in lengths]
    if missing:
        raise ValueError(f"Missing chromosome lengths for: {', '.join(missing)}")

    return {c: int(lengths[c]) for c in CHROMS}


def validate_scenarios(scenarios: list[Scenario], regions: pd.DataFrame) -> None:
    """Fail before simulating if any scenario is inconsistent.

    sample_ids must be unique, every deleted region must be exactly one chrY region in regions.bed,
    deletions need a Y (y_copies > 0), partial deletions need start < end and 0 <= rel_copy < 1.
    """
    errors = []

    ids = [s.sample_id for s in scenarios]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        errors.append(f"duplicate sample_id: {', '.join(duplicates)}")

    for s in scenarios:
        if (s.deleted or s.partial) and s.y_copies == 0:
            errors.append(f"{s.sample_id}: cannot delete regions without Y (y_copies = 0)")

        for region in s.deleted:
            n = ((regions["chrom"] == "chrY") & (regions["name"] == region)).sum()
            if n != 1:
                errors.append(f"{s.sample_id}: expected one chrY region named {region} in regions.bed, found {n}")

        for label, start, end, rel_copy in s.partial:
            if start >= end:
                errors.append(f"{s.sample_id}: partial deletion {label} has start >= end")
            if not 0 <= rel_copy < 1:
                errors.append(f"{s.sample_id}: partial deletion {label} needs 0 <= rel_copy < 1, got {rel_copy}")

    if errors:
        raise ValueError("Invalid scenarios:\n  " + "\n  ".join(errors))


def truth_rows(scenario: Scenario, regions: pd.DataFrame) -> list[TruthRow]:
    """Build the truth.tsv rows of one scenario.

    One row per deleted region (coordinates looked up in regions.bed) and one per partial deletion, each with
    the other chrY regions it overlaps (AZFb and AZFc share ~3.2 Mb, so deleting one also lowers the other).
    Always one whole-chrY row with expected_rel_copy = y_copies, its event compares y_copies to normal for the
    sex (1 in males, 0 in females): none / y_loss / mloy / y_gain.
    """
    base: TruthRow = {
        "sample_id": scenario.sample_id,
        "scenario": scenario.name,
        "sex": scenario.sex,
        "depth": scenario.depth,
        "x_copies": scenario.x_copies,
        "y_copies": scenario.y_copies,
    }

    y_regions = regions[regions["chrom"] == "chrY"]

    def overlaps(name: str, start: int, end: int) -> str | None:
        hits = y_regions[(y_regions["name"] != name) & (y_regions["start"] < end) & (y_regions["end"] > start)]
        return ",".join(hits["name"]) or None

    rows: list[TruthRow] = []
    for region in scenario.deleted:
        match = y_regions[y_regions["name"] == region]  # One match, see validate_scenarios
        start, end = int(match["start"].iloc[0]), int(match["end"].iloc[0])
        rows.append({**base, "event": "deletion", "region": region, "chrom": "chrY", "start": start, "end": end,
                     "expected_rel_copy": 0.0, "overlaps": overlaps(region, start, end)})

    for label, start, end, rel_copy in scenario.partial:
        rows.append({**base, "event": "partial_deletion", "region": label, "chrom": "chrY", "start": start, "end": end,
                     "expected_rel_copy": rel_copy, "overlaps": overlaps(label, start, end)})

    normal_y = 1.0 if scenario.sex == "M" else 0.0  # Females have no Y, so y_copies = 0 is no event
    if scenario.y_copies == normal_y:
        event = "none"
    elif scenario.y_copies == 0.0:
        event = "y_loss"
    elif scenario.y_copies < 1:
        event = "mloy"
    else:
        event = "y_gain"
    rows.append({**base, "event": event, "region": "chrY", "chrom": "chrY", "start": None, "end": None,
                 "expected_rel_copy": scenario.y_copies, "overlaps": None})

    return rows
    

def write_truth_table(scenarios: list[Scenario], outdir: Path, regions: pd.DataFrame) -> Path:
    """Collect the truth rows of all scenarios, sort them by sample and start and write truth.tsv ("." = no value)."""
    outdir.mkdir(parents=True, exist_ok=True)

    rows: list[TruthRow] = []
    for scenario in scenarios:
        rows.extend(truth_rows(scenario, regions))

    df = pd.DataFrame(rows)
    df = df.sort_values(by=["sample_id", "start"], kind="stable")
    df[["start", "end"]] = df[["start", "end"]].astype("Int64")
    df.to_csv(outdir / "truth.tsv", sep="\t", index=False, na_rep=".")

    return outdir / "truth.tsv"


def write_metadata_table(scenarios: list[Scenario], outdir: Path) -> Path:
    """Write metadata.tsv (one row per scenario, sorted by sample_id), reported_sex falls back to the true sex."""
    outdir.mkdir(parents=True, exist_ok=True)
    rows = [
        {
            "sample_id": s.sample_id,
            "reported_sex": s.reported_sex or s.sex,
            "population": s.population,
            "age": s.age,
            "phenotype": s.phenotype,
        }
        for s in scenarios
    ]

    df = pd.DataFrame(rows).sort_values(by="sample_id")
    df.to_csv(outdir / "metadata.tsv", sep="\t", index=False)

    return outdir / "metadata.tsv"


def write_files(sample: pd.DataFrame, sample_id: str, outdir: Path) -> list[Path]:
    """Write the depth and depth_q20 columns of one sample as mosdepth-style BED4 files, bgzip them and index them (.csi)."""
    outdir.mkdir(parents=True, exist_ok=True)

    written = []
    for column, suffix in [("depth", ""), ("depth_q20", ".q20")]:
        bed_file = outdir / f"{sample_id}{suffix}.regions.bed"
        sample[["chrom", "start", "end", column]].to_csv(bed_file, sep="\t", header=False, index=False, float_format="%.2f")
        subprocess.run(["bgzip", "-f", str(bed_file)], check=True)
        subprocess.run(["tabix", "-f", "-C", "-p", "bed", f"{bed_file}.gz"], check=True)
        written.append(Path(f"{bed_file}.gz"))

    return written


def build_windows(lengths: dict[str, int]) -> pd.DataFrame:
    """Split every chromosome into WINDOW_SIZE bp windows like mosdepth --by, the last one ends at the chromosome end."""
    frames = []

    for chrom, length in lengths.items():
        start = np.arange(0, length, WINDOW_SIZE)
        end = np.minimum(start + WINDOW_SIZE, length)
        frames.append(pd.DataFrame({"chrom": chrom, "start": start, "end": end}))

    return pd.concat(frames, ignore_index=True)


def label_windows(windows: pd.DataFrame, classes: pd.DataFrame, gaps: pd.DataFrame, regions: pd.DataFrame) -> pd.DataFrame:
    """Annotate the windows with what set_depths needs.

    seq_class = the class containing the window midpoint, is_gap = overlaps any gap,
    in_<region> (e.g. in_AZFc) = overlaps that region, is_x_par = midpoint in a chrX PAR.
    """
    windows = windows.copy()
    mid = (windows["start"] + windows["end"]) // 2

    # Midpoint picks one class per window; where classes overlap (2 bp XTR2/X-DEG) the later row wins
    windows["seq_class"] = None
    for row in classes.itertuples():
        in_class = (windows["chrom"] == row.chrom) & (mid >= row.start) & (mid < row.end)
        windows.loc[in_class, "seq_class"] = str(row.name)

    windows["is_gap"] = False
    for row in gaps.itertuples():
        windows["is_gap"] |= (windows["chrom"] == row.chrom) & (windows["start"] < row.end) & (windows["end"] > row.start)

    for row in regions.itertuples():
        windows[f"in_{row.name}"] = (windows["chrom"] == row.chrom) & (windows["start"] < row.end) & (windows["end"] > row.start)

    windows["is_x_par"] = False
    for start, end in X_PARS:
        windows["is_x_par"] |= (windows["chrom"] == "chrX") & (mid >= start) & (mid < end)

    return windows


def read_bed(file: Path) -> pd.DataFrame:
    """Read a headerless BED4 file into chrom, start, end, name columns."""
    return pd.read_csv(file, sep="\t", header=None, names=["chrom", "start", "end", "name"])


def set_depths(windows: pd.DataFrame, scenario: Scenario, rng: np.random.Generator) -> pd.DataFrame:
    """Simulate the depth of every window for one scenario.

    Expected depth = copies * depth / 2 (2 copies on autosomes, x_copies / y_copies on chrX / chrY,
    x_copies + y_copies in the chrX PARs), scaled
    by the class depth factor, 0 in deleted regions and gaps, times rel_copy in partial deletions.
    depth is drawn from a gamma distribution with that mean; its CV combines the class CV with the counting noise
    of the reads in the window (1 / reads), so shallow samples and small windows are noisier.
    depth_q20 = depth * class MAPQ fraction.
    """
    windows = windows.copy()

    windows["copies"] = 2.0
    windows.loc[windows["chrom"] == "chrX", "copies"] = scenario.x_copies
    windows.loc[windows["chrom"] == "chrY", "copies"] = scenario.y_copies
    windows.loc[windows["is_x_par"], "copies"] = scenario.x_copies + scenario.y_copies

    windows["expected"] = windows["copies"] * scenario.depth / 2.0

    effects = windows["seq_class"].map(lambda c: CLASS_EFFECTS.get(c, DEFAULT_EFFECT)) # Column of tuples
    factor = np.array([effect[0] for effect in effects])
    mapq_frac = np.array([effect[1] for effect in effects])
    cv = np.array([effect[2] for effect in effects])

    windows["expected"] *= factor

    for deleted in scenario.deleted:
        windows.loc[windows[f"in_{deleted}"], "expected"] = 0.0

    for _, start, end, rel_copy in scenario.partial:
        mask = (windows["chrom"] == "chrY") & (start < windows["end"]) & (end > windows["start"])
        windows.loc[mask, "expected"] *= rel_copy

    windows.loc[windows["is_gap"], "expected"] = 0.0

    # Counting noise: a window with n reads has CV^2 = 1/n (Poisson), added to the class CV^2
    expected = windows["expected"].to_numpy()
    reads = expected * (windows["end"] - windows["start"]).to_numpy() / READ_LEN
    count_var = np.divide(1.0, reads, out=np.zeros_like(reads), where=reads > 0)
    cv_total = np.sqrt(cv**2 + count_var)

    # Gamma with mean = expected and sd = expected * cv_total (shape = 1/cv^2, scale = expected * cv^2)
    windows["depth"] = rng.gamma(shape=1 / cv_total**2, scale=expected * cv_total**2)
    windows["depth_q20"] = windows["depth"] * mapq_frac

    return windows


def parse_args() -> argparse.Namespace:
    """Parse the input files, --outdir and --seed the module docstring is the --help text."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("fasta", type=Path)
    parser.add_argument("classes", type=Path)
    parser.add_argument("gaps", type=Path)
    parser.add_argument("regions", type=Path)
    parser.add_argument("--outdir", type=Path, default=Path("simulate_out"))
    parser.add_argument("--seed", type=int, default=42)

    return parser.parse_args()


def main() -> None:
    """Check the inputs, tools and scenarios, build and label the windows, simulate and write every scenario, then truth.tsv and metadata.tsv."""
    args = parse_args()
    files_got: dict[str, bool] = {
        "reference.fasta": args.fasta.exists(),
        "sequence_classes.bed": args.classes.exists(),
        "gaps.bed": args.gaps.exists(),
        "regions.bed": args.regions.exists()
    }
    missing = [name for name, exists in files_got.items() if not exists]
    if missing:
        sys.exit(f"Missing input files: {', '.join(missing)}")

    missing_tools = [tool for tool in ("bgzip", "tabix") if shutil.which(tool) is None]
    if missing_tools:
        sys.exit(f"Missing tools in PATH: {', '.join(missing_tools)} (install htslib)")

    files_written = []

    # Read annotations and check the scenarios against them before any work
    classes_data, gaps_data, regions_data = read_bed(args.classes), read_bed(args.gaps), read_bed(args.regions)
    validate_scenarios(SCENARIOS, regions_data)

    # Get chromosome lengths
    lengths = get_chromosome_lengths(args.fasta)

    # Build and annotate windows
    windows = build_windows(lengths)
    windows = label_windows(windows, classes_data, gaps_data, regions_data)

    # Save files
    for scenario in SCENARIOS:
        # Own generator per sample (seed + sample_id), so adding or reordering scenarios does not change the others
        rng = np.random.default_rng([args.seed, zlib.crc32(scenario.sample_id.encode())])
        sample = set_depths(windows, scenario, rng)
        files_written.extend(write_files(sample, scenario.sample_id, args.outdir))

    # Create truth.tsv
    truth_path = write_truth_table(SCENARIOS, args.outdir, regions_data)
    files_written.append(truth_path)

    # Create metadata.tsv
    files_written.append(write_metadata_table(SCENARIOS, args.outdir))

    # Confirm
    print(f"Simulation completed. {len(SCENARIOS)} samples created. {len(files_written)} files written to {args.outdir}.")


if __name__ == '__main__':
    main()
