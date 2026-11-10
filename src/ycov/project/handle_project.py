"""The project folder: the only module that knows its layout.

manifest.json                    what the project is: version, reference, files, samples
windows.parquet                  annotated chrY windows, shared by all samples
coverage/coverage_<n>kb.parquet  depth and relative copy per sample and window
"""

import json
from datetime import UTC, datetime
from importlib.metadata import version
from pathlib import Path
from typing import Any

import polars as pl

from ycov.errors import YcovInputError
from ycov.models import InputFormat, Sample

MANIFEST_FILE = "manifest.json"
WINDOWS_FILE = "windows.parquet"
COVERAGE_DIR = "coverage"


def coverage_file(window_size: int) -> str:
    """Coverage file of one resolution, relative to the project folder."""
    return f"{COVERAGE_DIR}/coverage_{window_size // 1000}kb.parquet"


def write_project(
    outdir: Path,
    windows: pl.DataFrame,
    samples: list[Sample],
    coverage: pl.DataFrame,
    window_size: int,
) -> None:
    """Write the project folder. The manifest goes last, so a folder without one is unfinished."""
    create_dir(outdir)
    write_windows(outdir, windows)
    write_coverage(outdir, coverage, window_size)
    write_manifest(outdir, samples, window_size)


def create_dir(outdir: Path) -> None:
    """Create the project folder (validate/ has checked it is new or empty)."""
    outdir.mkdir(parents=True, exist_ok=True)


def write_windows(outdir: Path, windows: pl.DataFrame) -> None:
    """Write the annotated window table."""
    windows.write_parquet(outdir / WINDOWS_FILE)


def write_coverage(outdir: Path, coverage: pl.DataFrame, window_size: int) -> None:
    """Write the coverage table of one resolution, creating the coverage folder if needed."""
    coverage_folder_path = outdir / coverage_file(window_size)
    coverage_folder_path.parent.mkdir(parents=True, exist_ok=True)
    coverage.write_parquet(coverage_folder_path)


def write_manifest(outdir: Path, samples: list[Sample], window_size: int) -> None:
    """Write manifest.json: ycov version, reference, window size, creation time (UTC),
    the data files relative to the folder and one entry per sample with its baseline."""
    manifest = {
        "ycov_version": version("ycov"),
        "reference": "T2T-CHM13v2.0",
        "window_size": window_size,
        "annotations": "chm13",
        "created": datetime.now(UTC).isoformat(timespec="seconds"),
        "files": {
            "windows": WINDOWS_FILE,
            "coverage": {str(window_size): coverage_file(window_size)},
        },
        "samples": [
            {
                "id": s.id,
                "path": str(s.path),
                "format": s.format,
                "baseline": s.baseline,
            }
            for s in samples
        ],
    }

    path = outdir / MANIFEST_FILE
    path.write_text(json.dumps(manifest, indent=2))


def read_project(project_dir: Path) -> tuple[list[Sample], pl.DataFrame, pl.DataFrame]:
    """Load a project folder written by write_project: (samples, windows, coverage)."""
    check_for_manifest(project_dir)
    manifest = load_manifest(project_dir)

    samples: list[Sample] = rebuild_samples(manifest)
    windows: pl.DataFrame = read_windows(project_dir, manifest)
    coverage: pl.DataFrame = read_coverage(project_dir, manifest)

    return samples, windows, coverage


def check_for_manifest(project_dir: Path) -> None:
    """A folder is a ycov project only if it has a manifest.json."""
    manifest_path = project_dir / MANIFEST_FILE
    if not manifest_path.is_file():
        raise YcovInputError(
            f"{project_dir}: not a ycov project (manifest.json missing)"
        )


def load_manifest(project_dir: Path) -> dict[str, Any]:
    """Parse manifest.json into a dict, invalid JSON is a YcovInputError."""
    try:
        return json.loads((project_dir / MANIFEST_FILE).read_text())
    except json.JSONDecodeError as error:
        raise YcovInputError(
            f"{project_dir / MANIFEST_FILE}: not valid JSON ({error})"
        ) from error


def rebuild_samples(manifest: dict[str, Any]) -> list[Sample]:
    """Turn the manifest's sample entries back into Sample records (str -> Path, InputFormat)."""
    return [
        Sample(s["id"], Path(s["path"]), InputFormat(s["format"]), s["baseline"])
        for s in manifest["samples"]
    ]


def read_windows(project_dir: Path, manifest: dict[str, Any]) -> pl.DataFrame:
    """Read the window table named in the manifest."""
    path = project_dir / manifest["files"]["windows"]
    try:
        return pl.read_parquet(path)
    except (FileNotFoundError, pl.exceptions.PolarsError) as error:
        raise YcovInputError(f"{path}: cannot read project file ({error})") from error


def read_coverage(project_dir: Path, manifest: dict[str, Any]) -> pl.DataFrame:
    """Read the coverage table of the manifest's window size."""
    path = project_dir / manifest["files"]["coverage"][str(manifest["window_size"])]
    try:
        return pl.read_parquet(path)
    except (FileNotFoundError, pl.exceptions.PolarsError) as error:
        raise YcovInputError(f"{path}: cannot read project file ({error})") from error
