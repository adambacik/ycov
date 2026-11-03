"""Checks of the coverage contents while reading; each raises YcovInputError naming the file and the problem."""

import polars as pl

from ycov.errors import YcovInputError
from ycov.models import BASELINE_CHROMS, CHM13_CHRY_LENGTH, Columns, Sample


def check_contents(data: pl.DataFrame, sample: Sample, window_size: int) -> None:
    """Run all checks below on one sample's coverage (after names are normalised and filtered)."""
    check_missings(data, sample)
    check_y_present(data, sample)
    check_autosomes_present(data, sample, BASELINE_CHROMS)
    check_windows(data, sample, window_size)
    check_y_end(data, sample, CHM13_CHRY_LENGTH)
    check_depth(data, sample)


def check_missings(data: pl.DataFrame, sample: Sample) -> None:
    """No empty values (polars reads short lines and leftover header lines as nulls)."""
    missing = data.null_count().sum_horizontal().item()
    if missing:
        raise YcovInputError(
            f"{sample.path}: {missing} empty values, every line needs chrom, start, end and depth"
        )


def check_y_present(data: pl.DataFrame, sample: Sample) -> None:
    """chrY has at least one window."""
    if not (data[Columns.CHROM] == "chrY").any():
        raise YcovInputError(
            f"{sample.path}: no chrY windows, the file must contain chrY coverage"
        )


def check_autosomes_present(
    data: pl.DataFrame, sample: Sample, autosomes: tuple[str, ...]
) -> None:
    """Every baseline chromosome has at least one window."""
    unique_chroms = set(data[Columns.CHROM].unique())
    missing = [a for a in autosomes if a not in unique_chroms]
    if missing:
        raise YcovInputError(
            f"{sample.path}: no windows on {', '.join(missing)}, "
            f"{', '.join(autosomes)} are needed for the baseline depth"
        )


def check_windows(data: pl.DataFrame, sample: Sample, window_size: int) -> None:
    """Windows lie on the window_size grid: start at a multiple of it and are window_size long,
    only the last window of each chromosome may be shorter (it ends at the chromosome end)."""
    length = pl.col(Columns.END) - pl.col(Columns.START)
    # .over() takes the max per chromosome and puts it on every row of that chromosome
    is_last = pl.col(Columns.END) == pl.col(Columns.END).max().over(Columns.CHROM)

    off_grid = data.filter(
        (pl.col(Columns.START) % window_size != 0)
        | (length <= 0)
        | (length > window_size)
        | ((length != window_size) & ~is_last)
    )
    if not off_grid.is_empty():
        first = off_grid.row(0, named=True)
        raise YcovInputError(
            f"{sample.path}: {off_grid.height} windows are not on the {window_size} bp grid "
            f"(first: {first[Columns.CHROM]}:{first[Columns.START]}-{first[Columns.END]}), "
            f"expected mosdepth --by {window_size} output"
        )


def check_y_end(data: pl.DataFrame, sample: Sample, end_at: int) -> None:
    """The last chrY window ends at end_at (CHM13 chrY length, catches other builds)."""
    y_end = (
        data.filter(pl.col(Columns.CHROM) == "chrY")
        .select(pl.col(Columns.END).max())
        .item()
    )
    if y_end != end_at:
        raise YcovInputError(
            f"{sample.path}: chrY ends at {y_end}, expected {end_at} (T2T-CHM13v2.0), "
            f"is the file aligned to another reference (GRCh38 chrY ends at 57227415)?"
        )


def check_depth(data: pl.DataFrame, sample: Sample) -> None:
    """No negative depth."""
    negative = data.filter(pl.col(Columns.DEPTH) < 0)
    if not negative.is_empty():
        raise YcovInputError(
            f"{sample.path}: {negative.height} windows with negative depth, "
            f"depth must be >= 0"
        )
