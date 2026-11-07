"""Annotate windows: sequence class by midpoint, gap and PAR flags by overlap, reliability from both."""

import polars as pl

from ycov.models import Columns

NAME = "name"
MID = "mid"
PAR_NAMES = ("PAR1", "PAR2")


def annotate(
    windows: pl.DataFrame,
    classes: pl.DataFrame,
    regions: pl.DataFrame,
    gaps: pl.DataFrame,
) -> pl.DataFrame:
    """Add seq_class, is_gap, is_par and reliable columns, return them in a fixed column order."""
    windows = assign_classes(windows, classes)
    windows = mark_overlaps(windows, gaps, Columns.IS_GAP)
    windows = mark_overlaps(
        windows, regions.filter(pl.col(NAME).is_in(PAR_NAMES)), Columns.IS_PAR
    )
    windows = mark_reliability(windows)
    return windows.select(
        Columns.CHROM,
        Columns.START,
        Columns.END,
        Columns.SEQ_CLASS,
        Columns.IS_GAP,
        Columns.IS_PAR,
        Columns.RELIABLE,
    )


def assign_classes(data: pl.DataFrame, classes: pl.DataFrame) -> pl.DataFrame:
    """Give each window the class whose interval contains its midpoint (one class per window)."""
    data = data.with_columns(
        ((pl.col(Columns.START) + pl.col(Columns.END)) // 2).alias(MID)
    )

    data = data.with_columns(pl.lit(None, dtype=pl.String).alias(Columns.SEQ_CLASS))
    for _, start, end, seq_class in classes.iter_rows():
        data = data.with_columns(
            pl.when((pl.col(MID) >= start) & (pl.col(MID) < end))
            .then(pl.lit(seq_class))
            .otherwise(pl.col(Columns.SEQ_CLASS))
            .alias(Columns.SEQ_CLASS)
        )

    data = data.drop(MID)
    return data


def mark_overlaps(
    data: pl.DataFrame, intervals: pl.DataFrame, column: Columns
) -> pl.DataFrame:
    """Add a boolean column, True for windows that overlap any of the intervals by at least 1 bp."""
    data = data.with_columns(pl.lit(False).alias(column))
    for _, start, end, _ in intervals.iter_rows():
        data = data.with_columns(
            pl.when((pl.col(Columns.START) < end) & (pl.col(Columns.END) > start))
            .then(pl.lit(True))
            .otherwise(column)
            .alias(column)
        )

    return data


def mark_reliability(data: pl.DataFrame) -> pl.DataFrame:
    """A window is reliable when it is neither a gap nor a PAR (PARs are masked on chrY in the XY reference)."""
    return data.with_columns(
        (~pl.col(Columns.IS_GAP) & ~pl.col(Columns.IS_PAR)).alias(Columns.RELIABLE)
    )
