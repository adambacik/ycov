"""Read coverage files of every input format into one long polars table (sample_id, chrom, start, end, depth)."""

import gzip
import logging
from pathlib import Path

import polars as pl

from ycov.coverage.check import check_contents
from ycov.errors import YcovInputError
from ycov.models import BASELINE_CHROMS, WINDOW_SIZE, Columns, InputFormat, Sample

logger = logging.getLogger(__name__)

HEADER_PREFIXES = ("track", "browser", "#")  # for bedgraph files
COLUMN_NAMES = [Columns.CHROM, Columns.START, Columns.END, Columns.DEPTH]
COLUMN_TYPES: dict[str, pl.DataType] = {
    Columns.CHROM: pl.String(),
    Columns.START: pl.Int64(),
    Columns.END: pl.Int64(),
    Columns.DEPTH: pl.Float64(),
}


def read_coverage(samples: list[Sample]) -> pl.DataFrame:
    """Read and combine all samples into one table with a sample_id column."""
    polar_data: list[pl.DataFrame] = []

    for number, sample in enumerate(samples, start=1):
        data = read_sample(sample)
        polar_data.append(data)
        logger.info("      %s coverage ✓  (%d/%d)", sample.id, number, len(samples))

    return pl.concat(polar_data)


def read_sample(sample: Sample) -> pl.DataFrame:
    """Read one sample by its format, normalise chromosome names, keep chrY and the baseline chromosomes, check the contents."""
    try:
        if sample.format == InputFormat.MOSDEPTH:
            data = read_data(sample.path, 0)
        else:  # BEDGRAPH
            data = read_data(sample.path, count_header_rows(sample.path))
    except pl.exceptions.PolarsError as read_error:
        # First line only, the rest are polars hints (infer_schema...) that do not apply here
        reason = str(read_error).splitlines()[0]
        raise YcovInputError(
            f"{sample.path}: not a 4-column tab-separated coverage file "
            f"(chrom, start, end, depth): {reason}"
        ) from read_error

    data = normalise_chrom_names(data)
    data = filter_chroms(data, BASELINE_CHROMS + ("chrY",))

    check_contents(data, sample, WINDOW_SIZE)

    return data.with_columns(pl.lit(sample.id).alias(Columns.SAMPLE_ID))


def count_header_rows(path: Path) -> int:
    """Number of track / browser / # lines at the top of a bedGraph (plain or .gz)."""
    try:
        opener = gzip.open if path.name.lower().endswith(".gz") else open
        count = 0

        with opener(path, "rt") as file:
            for line in file:
                if not line.startswith(HEADER_PREFIXES):
                    break
                count += 1
    # BadGzipFile (an OSError): ends with .gz but is not gzip; UnicodeDecodeError: binary, not text
    except (OSError, UnicodeDecodeError) as open_error:
        raise YcovInputError(
            f"{path}: cannot be read as a bedGraph text file ({open_error})"
        ) from open_error

    return count


def read_data(path: Path, skip: int) -> pl.DataFrame:
    """Read 4-column coverage (chrom, start, end, depth, no header), skipping the first `skip` lines (bedGraph header)."""
    return pl.read_csv(
        path,
        separator="\t",
        has_header=False,
        new_columns=COLUMN_NAMES,
        schema_overrides=COLUMN_TYPES,
        skip_rows=skip,
    )


def normalise_chrom_names(data: pl.DataFrame) -> pl.DataFrame:
    """Add the chr prefix where it is missing (Y -> chrY, 19 -> chr19)."""
    return data.with_columns(
        pl.when(pl.col(Columns.CHROM).str.starts_with("chr"))
        .then(pl.col(Columns.CHROM))
        .otherwise(pl.lit("chr") + pl.col(Columns.CHROM))
        .alias(Columns.CHROM)
    )


def filter_chroms(data: pl.DataFrame, chroms: tuple[str, ...]) -> pl.DataFrame:
    """Keep only the windows on the given chromosomes."""
    return data.filter(pl.col(Columns.CHROM).is_in(chroms))
