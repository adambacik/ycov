"""Tests of project/: writing the project folder and reading it back."""

import json
from datetime import datetime
from importlib.metadata import version
from pathlib import Path

import polars as pl
import pytest
from polars.testing import assert_frame_equal

from ycov.errors import YcovInputError
from ycov.models import Columns, InputFormat, Sample
from ycov.project.handle_project import (
    MANIFEST_FILE,
    WINDOWS_FILE,
    coverage_file,
    read_project,
    write_project,
)

WINDOW_SIZE = 1000

SAMPLES = [
    Sample("S01", Path("data/S01.regions.bed.gz"), InputFormat.MOSDEPTH, 30.1),
    Sample("S02", Path("data/S02.bedgraph"), InputFormat.BEDGRAPH, 5.0),
]

# Two windows, one reliable and one masked PAR
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

# Null rel_copy on the PAR window must survive the round trip
COVERAGE = pl.DataFrame(
    {
        Columns.SAMPLE_ID: ["S01", "S01", "S02", "S02"],
        Columns.START: [0, 1000, 0, 1000],
        Columns.END: [1000, 2000, 1000, 2000],
        Columns.DEPTH: [15.0, 0.0, 2.5, 0.0],
        Columns.REL_COPY: [1.0, None, 1.0, None],
    }
)


@pytest.fixture
def project(tmp_path: Path) -> Path:
    """A project folder written from the tables above."""
    folder = tmp_path / "project"
    write_project(folder, WINDOWS, SAMPLES, COVERAGE, WINDOW_SIZE)
    return folder


def manifest_of(folder: Path) -> dict[str, object]:
    """The project's manifest.json as a dict."""
    return json.loads((folder / MANIFEST_FILE).read_text())


# write_project


def test_write_project_creates_files(project: Path) -> None:
    assert (project / MANIFEST_FILE).is_file()
    assert (project / WINDOWS_FILE).is_file()
    assert (project / "coverage" / "coverage_1kb.parquet").is_file()


def test_write_project_manifest_contents(project: Path) -> None:
    manifest = manifest_of(project)

    assert manifest["ycov_version"] == version("ycov")
    assert manifest["reference"] == "T2T-CHM13v2.0"
    assert manifest["window_size"] == WINDOW_SIZE
    assert manifest["files"] == {
        "windows": WINDOWS_FILE,
        "coverage": {"1000": "coverage/coverage_1kb.parquet"},
    }
    assert manifest["samples"] == [
        {
            "id": "S01",
            "path": "data/S01.regions.bed.gz",
            "format": "mosdepth",
            "baseline": 30.1,
        },
        {
            "id": "S02",
            "path": "data/S02.bedgraph",
            "format": "bedgraph",
            "baseline": 5.0,
        },
    ]


def test_write_project_created_time_has_timezone(project: Path) -> None:
    created = datetime.fromisoformat(str(manifest_of(project)["created"]))

    assert created.utcoffset() is not None


def test_write_project_coverage_file_per_window_size(tmp_path: Path) -> None:
    write_project(tmp_path, WINDOWS, SAMPLES, COVERAGE, 10_000)

    assert (tmp_path / coverage_file(10_000)).is_file()
    assert coverage_file(10_000) == "coverage/coverage_10kb.parquet"


# read_project: round trip


def test_read_project_returns_samples(project: Path) -> None:
    samples, _, _ = read_project(project)

    # Equal dataclasses: same id, Path, InputFormat and baseline
    assert samples == SAMPLES


def test_read_project_returns_tables(project: Path) -> None:
    _, windows, coverage = read_project(project)

    # Same columns, types, values and nulls as written
    assert_frame_equal(windows, WINDOWS)
    assert_frame_equal(coverage, COVERAGE)


def test_read_project_other_window_size(tmp_path: Path) -> None:
    write_project(tmp_path, WINDOWS, SAMPLES, COVERAGE, 10_000)

    _, _, coverage = read_project(tmp_path)

    assert_frame_equal(coverage, COVERAGE)


# read_project: broken folders


def test_read_project_rejects_folder_without_manifest(tmp_path: Path) -> None:
    with pytest.raises(YcovInputError, match="not a ycov project"):
        read_project(tmp_path)


def test_read_project_rejects_missing_folder(tmp_path: Path) -> None:
    with pytest.raises(YcovInputError, match="not a ycov project"):
        read_project(tmp_path / "does_not_exist")


def test_read_project_rejects_invalid_json(project: Path) -> None:
    (project / MANIFEST_FILE).write_text("{ not json")

    with pytest.raises(YcovInputError, match="not valid JSON"):
        read_project(project)


@pytest.mark.parametrize("file", [WINDOWS_FILE, coverage_file(WINDOW_SIZE)])
def test_read_project_rejects_missing_data_file(project: Path, file: str) -> None:
    (project / file).unlink()

    with pytest.raises(YcovInputError, match="cannot read project file") as error:
        read_project(project)

    assert str(error.value).startswith(str(project / file))


@pytest.mark.parametrize("file", [WINDOWS_FILE, coverage_file(WINDOW_SIZE)])
def test_read_project_rejects_broken_data_file(project: Path, file: str) -> None:
    (project / file).write_bytes(b"not a parquet file")

    with pytest.raises(YcovInputError, match="cannot read project file") as error:
        read_project(project)

    assert str(error.value).startswith(str(project / file))
