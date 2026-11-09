"""Normalisation: autosomal baseline depth per sample and relative copy (RC) per chrY window."""

from dataclasses import replace

import polars as pl

from ycov.errors import YcovInputError
from ycov.models import BASELINE_CHROMS, Columns, Sample

BASELINE = "baseline"


def normalise(
    coverage: pl.DataFrame, windows: pl.DataFrame, samples: list[Sample]
) -> tuple[list[Sample], pl.DataFrame]:
    """Set each sample's baseline and return the chrY coverage with relative copy.

    The baseline is computed from the autosomes, then only chrY is kept and
    joined with the windows, so RC is left empty on windows that are not reliable.
    """
    baselines = compute_baseline(coverage)
    lookup = dict(baselines.iter_rows())
    missing = [s for s in samples if s.id not in lookup]
    if missing:
        raise YcovInputError(
            f"{missing[0].path}: no coverage on {', '.join(BASELINE_CHROMS)}, the baseline depth cannot be computed"
        )

    samples = [replace(s, baseline=lookup[s.id]) for s in samples]

    coverage = coverage.filter(pl.col(Columns.CHROM) == "chrY").join(
        windows, on=[Columns.CHROM, Columns.START, Columns.END]
    )

    coverage = compute_relative_copy(coverage, baselines).select(
        Columns.SAMPLE_ID, Columns.START, Columns.END, Columns.DEPTH, Columns.REL_COPY
    )
    return samples, coverage


def compute_baseline(coverage: pl.DataFrame) -> pl.DataFrame:
    """Median depth of each sample's baseline chromosome windows (sample_id, baseline).

    Windows with depth 0 (centromeres, N-runs) are left out. A sample with no
    covered baseline window gets no row.
    """
    filtered = coverage.filter(
        (pl.col(Columns.CHROM).is_in(BASELINE_CHROMS)) & (pl.col(Columns.DEPTH) > 0)
    )
    return filtered.group_by(Columns.SAMPLE_ID).agg(
        pl.col(Columns.DEPTH).median().alias(BASELINE)
    )


def compute_relative_copy(
    coverage: pl.DataFrame, baselines: pl.DataFrame
) -> pl.DataFrame:
    """Add rel_copy = depth / (baseline / 2), null on windows that are not reliable.

    The baseline is the depth of two copies, so a single-copy chrY region gives
    RC 1 and a deleted one RC 0. Masked PARs and gaps would give a false 0, so
    their RC stays empty.
    """
    temp = coverage.join(baselines, on=Columns.SAMPLE_ID)
    coverage = temp.with_columns(
        pl.when(pl.col(Columns.RELIABLE))
        .then(pl.col(Columns.DEPTH) / (pl.col(BASELINE) / 2))
        .otherwise(None)
        .alias(Columns.REL_COPY)
    )
    return coverage.drop(BASELINE)
