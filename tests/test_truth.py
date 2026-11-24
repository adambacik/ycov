"""End-to-end tests against the simulation truth: ycov prepare on tests/data/sim/
must give the relative copy that tests/data/truth.tsv says was simulated.

Unlike test_normalise.py (formulas on tiny hand-made tables), these run the whole
pipeline: validate -> read -> windows -> normalise -> write -> read the project back.
"""

from pathlib import Path
from typing import Any

import polars as pl
import pytest

from ycov.models import Columns, Sample
from ycov.prepare import prepare_project
from ycov.project.handle_project import read_project

DATA_DIR = Path(__file__).parent / "data"
SIM_DIR = DATA_DIR / "sim"
TRUTH_FILE = DATA_DIR / "truth.tsv"

# Background rows are checked on X-DEG only: the simulator gives every class the
# depth bias measured on real data (HET ~0.76x, AMPL ~0.94x), so a whole-chrY
# median of a normal male is ~0.84, not 1. X-DEG is single-copy and well mappable.
BACKGROUND_CLASS = "X-DEG"
BACKGROUND_TOLERANCE = 0.1  # X-DEG median of a normal male is ~0.95
EVENT_TOLERANCE = 0.05  # a deleted region has no reads at all, RC is exactly 0
BASELINE_TOLERANCE = 0.05  # relative, baseline vs the simulated autosome depth

# Read at import time: parametrize needs the rows when pytest collects the tests
TRUTH = pl.read_csv(TRUTH_FILE, separator="\t", null_values=".")
TRUTH_ROWS: list[dict[str, Any]] = list(TRUTH.iter_rows(named=True))


def is_background(row: dict[str, Any]) -> bool:
    """A background row describes the whole chrY (no coordinates), an event row one region."""
    return row["start"] is None


@pytest.fixture(scope="module")
def project(
    tmp_path_factory: pytest.TempPathFactory,
) -> tuple[list[Sample], pl.DataFrame]:
    """Run ycov prepare once for this file and read the project back.

    Returns the samples (with baselines) and the reliable chrY windows of all
    samples with their seq_class and rel_copy.
    """
    files = sorted(
        f
        for f in SIM_DIR.glob("*.regions.bed.gz")
        if not f.name.endswith(".q20.regions.bed.gz")  # all reads only, MAPQ is Phase 3
    )
    outdir = tmp_path_factory.mktemp("truth") / "project"
    prepare_project(files, outdir)

    samples, windows, coverage = read_project(outdir)
    table = coverage.join(windows, on=[Columns.START, Columns.END]).filter(
        pl.col(Columns.REL_COPY).is_not_null()
    )
    return samples, table


def select_windows(table: pl.DataFrame, row: dict[str, Any]) -> pl.DataFrame:
    """The windows of one truth row.

    Event row: the sample's windows lying fully inside [start, end), so the
    partly deleted edge windows do not blur the result.
    Background row: the sample's X-DEG windows that overlap none of its events.
    """
    sample = table.filter(pl.col(Columns.SAMPLE_ID) == row["sample_id"])

    if not is_background(row):
        return sample.filter(
            (pl.col(Columns.START) >= row["start"])
            & (pl.col(Columns.END) <= row["end"])
        )

    background = sample.filter(pl.col(Columns.SEQ_CLASS) == BACKGROUND_CLASS)
    events = [
        r
        for r in TRUTH_ROWS
        if r["sample_id"] == row["sample_id"] and not is_background(r)
    ]
    for event in events:
        overlaps = (pl.col(Columns.END) > event["start"]) & (
            pl.col(Columns.START) < event["end"]
        )
        background = background.filter(~overlaps)
    return background


def test_all_truth_samples_in_project(
    project: tuple[list[Sample], pl.DataFrame],
) -> None:
    samples, _ = project

    assert {s.id for s in samples} == set(TRUTH["sample_id"])


@pytest.mark.parametrize(
    "row",
    # One baseline check per sample, not per truth row
    [r for r in TRUTH_ROWS if is_background(r)],
    ids=lambda r: r["sample_id"],
)
def test_baseline_matches_simulated_depth(
    project: tuple[list[Sample], pl.DataFrame], row: dict[str, Any]
) -> None:
    samples, _ = project
    baseline = next(s.baseline for s in samples if s.id == row["sample_id"])

    # The autosomes have two copies, simulated at `depth`, so the median is ~depth
    assert baseline == pytest.approx(row["depth"], rel=BASELINE_TOLERANCE)


@pytest.mark.parametrize(
    "row", TRUTH_ROWS, ids=lambda r: f"{r['sample_id']}-{r['scenario']}-{r['region']}"
)
def test_relative_copy_matches_truth(
    project: tuple[list[Sample], pl.DataFrame], row: dict[str, Any]
) -> None:
    _, table = project
    selected = select_windows(table, row)

    # An empty selection would make the median None and hide a bug in the selection
    assert selected.height > 0, "no reliable windows selected for this truth row"

    measured = selected[Columns.REL_COPY].median()
    tolerance = BACKGROUND_TOLERANCE if is_background(row) else EVENT_TOLERANCE
    assert measured == pytest.approx(row["expected_rel_copy"], abs=tolerance)
