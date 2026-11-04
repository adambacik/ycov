"""Build the shared chrY window table: the CHM13 window grid annotated from the bundled BED files."""

from importlib.resources import files
from importlib.resources.abc import Traversable

import polars as pl

from ycov.models import CHM13_CHRY_LENGTH, Columns
from ycov.windows.assign import NAME, annotate

CHM13_DIR = files("ycov") / "annotations" / "chm13"
SEQUENCE_CLASSES = CHM13_DIR / "sequence_classes.bed"
REGIONS = CHM13_DIR / "regions.bed"
GAPS = CHM13_DIR / "gaps.bed"

ANNOT_COLUMNS: list[str] = [Columns.CHROM, Columns.START, Columns.END, NAME]
ANNOT_SCHEMA: dict[str, pl.DataType] = {
    Columns.CHROM: pl.String(),
    Columns.START: pl.Int64(),
    Columns.END: pl.Int64(),
}


def build_windows(window_size: int) -> pl.DataFrame:
    """One row per chrY window with its sequence class, gap and PAR flags and reliability, same for every sample."""
    classes = sort_bed(read_bed(SEQUENCE_CLASSES))
    regions = sort_bed(read_bed(REGIONS))
    gaps = sort_bed(read_bed(GAPS))

    windows = create_grid(CHM13_CHRY_LENGTH, window_size)
    return annotate(windows, classes, regions, gaps)


def read_bed(file: Traversable) -> pl.DataFrame:
    """Read a bundled 4-column BED annotation (chrom, start, end, name)."""
    return pl.read_csv(
        file.read_bytes(),
        separator="\t",
        has_header=False,
        new_columns=ANNOT_COLUMNS,
        schema_overrides=ANNOT_SCHEMA,
    )


def sort_bed(data: pl.DataFrame) -> pl.DataFrame:
    """Sort intervals by start position."""
    return data.sort(by=[Columns.START])


def create_grid(chrom_size: int, window_size: int) -> pl.DataFrame:
    """Windows of window_size bp from 0 to chrom_size, the last one shorter (ends at chrom_size), like mosdepth --by."""
    windows: pl.DataFrame = pl.DataFrame(
        {Columns.START: pl.int_range(0, chrom_size, window_size, eager=True)}
    )
    windows = windows.with_columns(pl.lit("chrY").alias(Columns.CHROM))
    windows = windows.with_columns(
        pl.min_horizontal(pl.col(Columns.START) + window_size, chrom_size).alias(
            Columns.END
        )
    )
    return windows
