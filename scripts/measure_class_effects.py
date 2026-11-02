#!/usr/bin/env python3
"""
Measure the CLASS_EFFECTS of simulate.py on real mosdepth output.

Per sample, relative to one copy (median chr19-22 depth / 2), for every chrY
class and for chr19-22 (DEFAULT_EFFECT, 2 copies):
    depth factor  = mean relative depth
    mapq fraction = q20 depth / all-reads depth
    CV            = sd / mean of the relative depth minus the counting noise
                    (1 / reads), which simulate.py adds itself
Windows above 10 copies (collapsed repeats) are left out of mean and sd.
Samples without Y (females) are skipped, the result is the median over the rest.

Input: <sample>.regions.bed.gz and <sample>.q20.regions.bed.gz in mosdepth_dir
(mosdepth -n --by 1000, without and with --mapq 20).
Output: per-class median / min / max to stderr, CLASS_EFFECTS to stdout.

Requirements:
    - numpy, pandas

Usage:
    python measure_class_effects.py <mosdepth_dir> [--classes BED]

Example:
    python measure_class_effects.py /media/ext/mosdepth > class_effects.txt
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from simulate import READ_LEN, WINDOW_SIZE, label_windows, read_bed

ANNOTATIONS_DIR = Path(__file__).resolve().parents[1] / "src/ycov/annotations/chm13"
AUTOSOMES = ["chr19", "chr20", "chr21", "chr22"]
MAX_REL = 10.0  # collapsed repeats above 10 copies would dominate mean and sd
MIN_Y_FACTOR = 0.25  # chrY X-DEG below this = no Y


def read_sample(mosdepth_dir: Path, sample: str) -> pd.DataFrame:
    """All-reads depth and q20 depth of one sample's chr19-22 and chrY windows."""
    names = ["chrom", "start", "end", "depth"]
    df = pd.read_csv(mosdepth_dir / f"{sample}.regions.bed.gz", sep="\t", names=names)
    q20 = pd.read_csv(
        mosdepth_dir / f"{sample}.q20.regions.bed.gz", sep="\t", names=names
    )
    df["q20"] = q20["depth"]
    return df[df["chrom"].isin(AUTOSOMES + ["chrY"])]


def measure_sample(df: pd.DataFrame, classes: pd.DataFrame) -> pd.DataFrame:
    """Depth factor, mapq fraction and CV per class (DEFAULT = chr19-22), one row per class."""
    baseline = df.loc[df["chrom"].isin(AUTOSOMES), "depth"].median() / 2

    # Same midpoint labelling as simulate.py, no gaps or regions needed here
    df = label_windows(df, classes, classes.iloc[:0], classes.iloc[:0])
    df["rel"] = df["depth"] / baseline
    autosomal = df["chrom"].isin(AUTOSOMES)
    df.loc[autosomal, "seq_class"] = "DEFAULT"
    df.loc[autosomal, "rel"] /= 2

    # PAR1/PAR2 are masked on chrY (0 by design)
    df = df[df["seq_class"].notna() & ~df["seq_class"].isin(["PAR1", "PAR2"])]

    rows = []
    for cls, windows in df.groupby("seq_class"):
        kept = windows[windows["rel"] <= MAX_REL]
        factor = kept["rel"].mean()

        # A window with n reads has CV^2 = 1/n from counting alone, simulate.py adds that itself
        reads = kept["depth"].mean() * WINDOW_SIZE / READ_LEN
        cv = np.sqrt(max((kept["rel"].std() / factor) ** 2 - 1 / reads, 0.01**2))

        mapq_frac = windows["q20"].sum() / windows["depth"].sum()
        rows.append({"class": cls, "factor": factor, "mapq_frac": mapq_frac, "cv": cv})

    return pd.DataFrame(rows)


def parse_args() -> argparse.Namespace:
    """Parse the mosdepth folder and --classes, the module docstring is the --help text."""
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("mosdepth_dir", type=Path)
    parser.add_argument(
        "--classes", type=Path, default=ANNOTATIONS_DIR / "sequence_classes.bed"
    )
    return parser.parse_args()


def main() -> None:
    """Measure every male sample, print the per-class table and CLASS_EFFECTS."""
    args = parse_args()
    classes = read_bed(args.classes)

    frames = []
    for path in sorted(args.mosdepth_dir.glob("*.q20.regions.bed.gz")):
        sample = path.name.removesuffix(".q20.regions.bed.gz")
        # Females have 0 depth on chrY, the 0 / 0 there is fine, they are skipped below
        with np.errstate(divide="ignore", invalid="ignore"):
            measured = measure_sample(read_sample(args.mosdepth_dir, sample), classes)

        if measured.set_index("class")["factor"]["X-DEG"] < MIN_Y_FACTOR:
            print(f"Skipping {sample}: no Y", file=sys.stderr)
            continue
        print(f"Measured {sample}", file=sys.stderr)
        frames.append(measured)

    if not frames:
        sys.exit(
            f"No male <sample>.regions.bed.gz + .q20.regions.bed.gz in {args.mosdepth_dir}"
        )

    per_class = pd.concat(frames).groupby("class")
    print(per_class.agg(["median", "min", "max"]).round(3).to_string(), file=sys.stderr)

    effects = {
        str(cls): f"({row.factor:.2f}, {row.mapq_frac:.2f}, {row.cv:.2f})"
        for cls, row in per_class.median().iterrows()
    }
    default = effects.pop("DEFAULT")
    print("CLASS_EFFECTS = {")
    for cls, effect in effects.items():
        print(f'    "{cls}": {effect},')
    print("}")
    print(f"DEFAULT_EFFECT = {default}")


if __name__ == "__main__":
    main()
