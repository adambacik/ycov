"""Tests of analysis/normalise.py: baseline per sample and relative copy on tiny in-memory tables."""

from pathlib import Path

import polars as pl
import pytest

from ycov.analysis.normalise import (
    BASELINE,
    compute_baseline,
    compute_relative_copy,
    normalise,
)
from ycov.errors import YcovInputError
from ycov.models import BASELINE_CHROMS, Columns, InputFormat, Sample

# Two chrY windows: a normal one and a masked PAR one
WINDOWS = pl.DataFrame(
    {
        Columns.CHROM: ["chrY", "chrY"],
        Columns.START: [0, 1000],
        Columns.END: [1000, 2000],
        Columns.SEQ_CLASS: ["X-DEG", "PAR1"],
        Columns.IS_GAP: [False, True],
        Columns.IS_PAR: [False, True],
        Columns.RELIABLE: [True, False],
    }
)


def coverage(
    sample_id: str, autosome_depths: list[float], y_depths: list[float]
) -> pl.DataFrame:
    """Coverage of one sample: autosome_depths spread over the baseline chromosomes
    (one window per depth), y_depths on consecutive chrY windows from 0."""
    chroms = [
        BASELINE_CHROMS[i % len(BASELINE_CHROMS)] for i in range(len(autosome_depths))
    ]
    rows = [
        (chrom, i * 1000, (i + 1) * 1000, depth)
        for i, (chrom, depth) in enumerate(zip(chroms, autosome_depths, strict=True))
    ]
    rows += [
        ("chrY", i * 1000, (i + 1) * 1000, depth) for i, depth in enumerate(y_depths)
    ]

    # Same types as coverage/ produces, so 30 and 30.0 are both Float64 depth
    schema: dict[str, pl.DataType] = {
        Columns.CHROM: pl.String(),
        Columns.START: pl.Int64(),
        Columns.END: pl.Int64(),
        Columns.DEPTH: pl.Float64(),
    }
    return pl.DataFrame(rows, schema=schema, orient="row").with_columns(
        pl.lit(sample_id).alias(Columns.SAMPLE_ID)
    )


def sample(sample_id: str) -> Sample:
    """A Sample record, the file itself is never opened here."""
    return Sample(
        id=sample_id, path=Path(f"{sample_id}.bedgraph"), format=InputFormat.BEDGRAPH
    )


def baselines_of(table: pl.DataFrame) -> dict[str, float]:
    """compute_baseline's table as {sample_id: baseline}."""
    return dict(table.iter_rows())


# compute_baseline


def test_compute_baseline_is_median_per_sample() -> None:
    data = pl.concat(
        [coverage("A", [10, 30, 50], []), coverage("B", [4, 5, 6, 100], [])]
    )

    assert baselines_of(compute_baseline(data)) == {"A": 30, "B": 5.5}


def test_compute_baseline_skips_zero_depth() -> None:
    # Median with the zeros would be 0, without them 30
    data = coverage("A", [0, 0, 0, 20, 30, 40], [])

    assert baselines_of(compute_baseline(data)) == {"A": 30}


def test_compute_baseline_ignores_chry() -> None:
    data = coverage("A", [30, 30], [1000, 1000, 1000])

    assert baselines_of(compute_baseline(data)) == {"A": 30}


def test_compute_baseline_no_row_without_covered_autosomes() -> None:
    data = pl.concat([coverage("A", [30], []), coverage("B", [0, 0], [15])])

    assert baselines_of(compute_baseline(data)) == {"A": 30}


# compute_relative_copy


@pytest.mark.parametrize(
    ("depth", "expected"),
    [
        (15.0, 1.0),  # one copy: half of the two-copy baseline
        (0.0, 0.0),  # deleted
        (7.5, 0.5),  # mosaic loss in half of the cells
        (30.0, 2.0),  # two copies (XYY)
    ],
)
def test_compute_relative_copy_formula(depth: float, expected: float) -> None:
    data = coverage("A", [], [depth]).join(
        WINDOWS, on=[Columns.CHROM, Columns.START, Columns.END]
    )
    baselines = pl.DataFrame({Columns.SAMPLE_ID: ["A"], BASELINE: [30.0]})

    result = compute_relative_copy(data, baselines)

    assert result[Columns.REL_COPY].to_list() == [expected]


def test_compute_relative_copy_null_when_not_reliable() -> None:
    data = coverage("A", [], [15, 0]).join(
        WINDOWS, on=[Columns.CHROM, Columns.START, Columns.END]
    )
    baselines = pl.DataFrame({Columns.SAMPLE_ID: ["A"], BASELINE: [30.0]})

    result = compute_relative_copy(data, baselines)

    # The PAR window's depth 0 must not become RC 0 (it would look like a deletion)
    assert result[Columns.REL_COPY].to_list() == [1.0, None]


# normalise


def test_normalise_sets_sample_baselines() -> None:
    data = pl.concat(
        [coverage("A", [30, 30], [15, 0]), coverage("B", [5, 5], [2.5, 0])]
    )

    samples, _ = normalise(data, WINDOWS, [sample("A"), sample("B")])

    assert [(s.id, s.baseline) for s in samples] == [("A", 30), ("B", 5)]


def test_normalise_returns_chry_coverage_columns() -> None:
    data = coverage("A", [30, 30], [15, 0])

    _, result = normalise(data, WINDOWS, [sample("A")])

    assert result.columns == [
        Columns.SAMPLE_ID,
        Columns.START,
        Columns.END,
        Columns.DEPTH,
        Columns.REL_COPY,
    ]
    assert result.height == WINDOWS.height  # autosome rows dropped


def test_normalise_removes_depth_differences() -> None:
    # A at 30x and B at 5x: same single-copy chrY, so the same RC
    data = pl.concat(
        [coverage("A", [30, 30], [15, 0]), coverage("B", [5, 5], [2.5, 0])]
    )

    _, result = normalise(data, WINDOWS, [sample("A"), sample("B")])

    reliable = result.filter(pl.col(Columns.START) == 0).sort(Columns.SAMPLE_ID)
    assert reliable[Columns.REL_COPY].to_list() == [1.0, 1.0]


def test_normalise_rejects_sample_without_baseline() -> None:
    data = pl.concat([coverage("A", [30], [15, 0]), coverage("B", [0, 0], [15, 0])])

    with pytest.raises(
        YcovInputError, match="baseline depth cannot be computed"
    ) as error:
        normalise(data, WINDOWS, [sample("A"), sample("B")])

    assert str(error.value).startswith("B.bedgraph")
