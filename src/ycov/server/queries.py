"""Data work of the server: turn the loaded project into the response models.

Every function takes plain tables or records and returns a model from
schemas.py.
"""

from typing import Any

import polars as pl

from ycov.errors import YcovInputError
from ycov.models import CHM13_CHRY_LENGTH, Columns, Sample
from ycov.server.schemas import (
    Coverage,
    Interval,
    Mode,
    ProjectInfo,
    Region,
    SampleInfo,
    WindowAnnotations,
)
from ycov.windows.assign import NAME
from ycov.windows.build import REGIONS, read_bed

RUN = "run"
BIN = "bin"
ORDER = "order"


def project_info(manifest: dict[str, Any]) -> ProjectInfo:
    """The manifest as /api/project returns it, without its file and sample lists.

    Chromosome and length are not in the manifest yet, they are the CHM13 chrY.
    """
    return ProjectInfo(
        ycov_version=manifest["ycov_version"],
        created=manifest["created"],
        reference=manifest["reference"],
        annotations=manifest["annotations"],
        chromosome="chrY",
        length=CHM13_CHRY_LENGTH,
        window_size=manifest["window_size"],
    )


def sample_info(samples: list[Sample]) -> list[SampleInfo]:
    """One SampleInfo per Sample record, in manifest order."""
    missing = [s.id for s in samples if s.baseline is None]
    if missing:
        raise YcovInputError(f"manifest.json: no baseline for {', '.join(missing)}")
    return [
        SampleInfo(
            sample_id=s.id, path=str(s.path), format=str(s.format), baseline=s.baseline
        )
        for s in samples
        if s.baseline is not None
    ]


def window_annotations(windows: pl.DataFrame) -> WindowAnnotations:
    """Window annotations merged into intervals for the class bar, region list and masks.

    Classes and masked come from the project's windows table (snapped to window
    edges), regions from the bundled regions.bed (exact coordinates). A masked
    interval is named by its reason: "par" before "gap", as a masked PAR is
    also a gap.
    """
    windows = windows.sort(Columns.START)

    window_size = windows[Columns.END][0] - windows[Columns.START][0]
    chromosome = windows[Columns.CHROM][0]
    length = windows[Columns.END][-1]

    classes = merge_runs(windows, pl.col(Columns.SEQ_CLASS))
    regions = (
        read_bed(REGIONS).sort(Columns.START).select(NAME, Columns.START, Columns.END)
    )
    reason = (
        pl.when(pl.col(Columns.IS_PAR))
        .then(pl.lit("par"))
        .when(pl.col(Columns.IS_GAP))
        .then(pl.lit("gap"))
    )
    masked = merge_runs(windows, reason).filter(pl.col(NAME).is_not_null())

    return WindowAnnotations(
        chromosome=chromosome,
        length=length,
        window_size=window_size,
        classes=to_intervals(classes),
        regions=to_intervals(regions),
        masked=to_intervals(masked),
    )


def merge_runs(windows: pl.DataFrame, label: pl.Expr) -> pl.DataFrame:
    """Merge consecutive windows with the same label into intervals (name, start, end)."""
    return (
        windows.sort(Columns.START)
        .with_columns(label.alias(NAME))
        .group_by(pl.col(NAME).rle_id().alias(RUN), maintain_order=True)
        .agg(
            pl.col(NAME).first(),
            pl.col(Columns.START).first(),
            pl.col(Columns.END).last(),
        )
        .drop(RUN)
    )


def to_intervals(data: pl.DataFrame) -> list[Interval]:
    """Rows (name, start, end) -> Interval models."""
    return [Interval(**row) for row in data.iter_rows(named=True)]


def coverage(
    table: pl.DataFrame,
    sample_ids: list[str],
    start: int,
    end: int,
    resolution: int,
    mode: Mode,
) -> Coverage:
    """Values of `mode` per sample in [start, end), aligned to shared bins.

    Bins are `resolution` bp on a fixed grid from 0, so the same resolution
    always gives the same bin edges. A bin is the mean of its windows, nulls
    (gap, PAR) skipped; a bin without any value is null. Rows follow the order
    of `sample_ids`, every row has one value per bin.
    """
    # 1. Bin starts: from the bin containing `start` up to the last one before `end`
    first_bin = start // resolution * resolution
    starts = list(range(first_bin, end, resolution))

    # 2-4. Requested samples, windows overlapping [start, end), mean per bin
    binned = (
        table.filter(
            pl.col(Columns.SAMPLE_ID).is_in(sample_ids)
            & (pl.col(Columns.START) < end)
            & (pl.col(Columns.END) > start)
        )
        .with_columns((pl.col(Columns.START) // resolution * resolution).alias(BIN))
        .group_by(Columns.SAMPLE_ID, BIN)
        .agg(pl.col(mode).mean().round(3))
    )

    # 5. Every sample x every bin, so all rows are equally long; missing -> null
    grid = pl.DataFrame(
        {Columns.SAMPLE_ID: sample_ids, ORDER: list(range(len(sample_ids)))}
    ).join(pl.DataFrame({BIN: starts}), how="cross")

    # 6-7. Rows in the requested sample order, bins in order, one list per sample
    matrix = (
        grid.join(binned, on=[Columns.SAMPLE_ID, BIN], how="left")
        .sort(ORDER, BIN)
        .group_by(ORDER, maintain_order=True)
        .agg(pl.col(mode))
    )

    return Coverage(
        region=Region(chromosome="chrY", start=start, end=end),
        resolution=resolution,
        mode=mode,
        samples=sample_ids,
        starts=starts,
        values=matrix[mode].to_list(),
    )
