"""JSON shapes of the ycov API: one pydantic
model per object the server returns.

FastAPI validates every response against these models and lists them under
"Schemas" at /docs. The models only describe shapes, queries.py builds them.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Value shown per window, design modes; later y_internal, cohort_relative
Mode = Literal["rel_copy", "depth"]


class Schema(BaseModel):
    """Base of all response models: frozen, built once and served unchanged."""

    model_config = ConfigDict(frozen=True)


class ProjectInfo(Schema):
    """GET /api/project: the manifest with project folder name, for the top bar and the compatibility check."""

    name: str = Field(description="project folder name", examples=["project"])
    ycov_version: str = Field(description="ycov version that wrote the project")
    created: str = Field(description="creation time, ISO 8601 UTC")
    reference: str = Field(examples=["T2T-CHM13v2.0"])
    annotations: str = Field(description="bundled annotation set", examples=["chm13"])
    chromosome: str = Field(examples=["chrY"])
    length: int = Field(description="chromosome length in bp")
    window_size: int = Field(description="window size of the stored coverage in bp")


class SampleInfo(Schema):
    """One entry of GET /api/samples."""

    sample_id: str
    path: str = Field(description="coverage file the sample was read from")
    format: str = Field(examples=["mosdepth", "bedgraph"])
    baseline: float = Field(description="median depth of chr19-22 (two copies)")


class Interval(Schema):
    """A named half-open interval [start, end) on the chromosome, 0-based like BED."""

    name: str
    start: int
    end: int


class WindowAnnotations(Schema):
    """GET /api/windows: the window annotations merged into intervals."""

    chromosome: str
    length: int
    window_size: int
    classes: list[Interval] = Field(
        description="sequence classes, cover the whole chromosome"
    )
    regions: list[Interval] = Field(description="PAR1, PAR2, AZFa, AZFb, AZFc")
    masked: list[Interval] = Field(
        description="windows without relative copy, name is the reason (PAR, gap)"
    )


class Region(Schema):
    """The part of the chromosome a coverage response covers."""

    chromosome: str
    start: int
    end: int


class Coverage(Schema):
    """GET /api/coverage: values per sample aligned to shared bins.

    values[i][j] is the value of samples[i] in the bin starting at starts[j];
    null where the bin has no reliable window (gap, PAR) - Plotly leaves it empty.
    """

    region: Region
    resolution: int = Field(description="bin size in bp")
    mode: Mode
    samples: list[str]
    starts: list[int]
    values: list[list[float | None]]
