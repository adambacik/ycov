"""FastAPI app of ycov view: serves one project folder as JSON to the frontend.

Errors: 404 for an unknown sample, 422 for invalid parameters.
The project is read only through project/, the data work
is in queries.py, the JSON shapes in schemas.py.
"""

from importlib.metadata import version
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query

from ycov.models import WINDOW_SIZE
from ycov.project.handle_project import load_manifest, read_project
from ycov.server import queries
from ycov.server.schemas import (
    Coverage,
    Mode,
    ProjectInfo,
    SampleInfo,
    WindowAnnotations,
)

HOST = "127.0.0.1"


def create_app(project_dir: Path) -> FastAPI:
    """Load the project once and return the app that serves it.

    Everything except /api/coverage is built here and served unchanged.
    Raises YcovInputError if the folder is not a valid project, before any
    server is started.
    """
    samples, windows, coverage = read_project(project_dir)
    manifest = load_manifest(project_dir)

    # build once
    ids = [s.id for s in samples]
    project = queries.project_info(manifest)
    annotations = queries.window_annotations(windows)
    samples_list = queries.sample_info(samples)

    # create app
    app = FastAPI(title="ycov", version=version("ycov"))

    # register APIs
    @app.get("/api/project", response_model=ProjectInfo)
    def get_project() -> ProjectInfo:
        """The manifest: version, reference, chromosome, window size (top bar, compatibility check)."""
        return project

    @app.get("/api/samples", response_model=list[SampleInfo])
    def get_samples() -> list[SampleInfo]:
        """All samples in manifest order (sidebar; sort, group and filter in Phase 3)."""
        return samples_list

    @app.get("/api/windows", response_model=WindowAnnotations)
    def get_windows() -> WindowAnnotations:
        """Window annotations as intervals: sequence classes, regions, masked (class bar, axis)."""
        return annotations

    @app.get("/api/coverage", response_model=Coverage)
    def get_coverage(
        region: str | None = None,
        resolution: Annotated[
            int, Query(ge=WINDOW_SIZE, multiple_of=WINDOW_SIZE)
        ] = WINDOW_SIZE,
        mode: Mode = "rel_copy",
        samples_param: Annotated[str | None, Query(alias="samples")] = None,
    ) -> Coverage:
        """Values per sample aligned to the bins of `region` (default whole chrY).

        Heatmap:       /api/coverage?resolution=10000
        Coverage plot: /api/coverage?region=chrY:23327301-27020249&samples=S01,S02
        """
        start, end = parse_region(
            region, annotations.chromosome, annotations.length
        )  # raises 422
        requested = parse_samples(samples_param, ids)
        return queries.coverage(coverage, requested, start, end, resolution, mode)

    return app


def parse_region(region: str | None, chromosome: str, length: int) -> tuple[int, int]:
    """'chrY:<start>-<end>' -> (start, end), 0-based half-open like BED.

    None -> the whole chromosome. Wrong chromosome, non-numeric coordinates,
    start >= end or end beyond the chromosome -> 422.
    """
    if region is None:
        return 0, length

    chrom, _, span = region.partition(":")
    start_text, _, end_text = span.partition("-")
    if chrom != chromosome or not start_text.isdigit() or not end_text.isdigit():
        raise HTTPException(
            422, f"region {region!r}: expected {chromosome}:<start>-<end>"
        )

    start, end = int(start_text), int(end_text)
    if not start < end <= length:
        raise HTTPException(422, f"region {region!r}: needs start < end <= {length}")

    return start, end


def parse_samples(samples_param: str | None, known: list[str]) -> list[str]:
    """Comma-separated sample ids -> list in the given order, spaces and duplicates dropped.

    None or empty -> all samples in manifest order. Unknown id -> 404.
    """
    if not samples_param:
        return known

    requested = [s.strip() for s in samples_param.split(",") if s.strip()]
    requested = list(dict.fromkeys(requested))  # drop duplicates, keep order
    unknown = [s for s in requested if s not in known]
    if unknown:
        raise HTTPException(404, f"unknown sample(s): {', '.join(unknown)}")

    return requested or known
