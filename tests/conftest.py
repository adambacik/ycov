"""Fixtures shared by all test files (pytest loads this file automatically)."""

from pathlib import Path

import pytest

from ycov.prepare import prepare_project

DATA_DIR = Path(__file__).parent / "data"
SIM_DIR = DATA_DIR / "sim"


@pytest.fixture
def data_dir() -> Path:
    """tests/data/: the slices written by scripts/make_test_data.sh."""
    return DATA_DIR


@pytest.fixture(scope="session")
def sim_project(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A ycov project of tests/data/sim (S01-S04), built once per test run.

    Shared read-only by the server and view tests; a test that changes a
    project must build its own.
    """
    files = sorted(
        f
        for f in SIM_DIR.glob("*.regions.bed.gz")
        if not f.name.endswith(".q20.regions.bed.gz")
    )
    project = tmp_path_factory.mktemp("sim") / "project"
    prepare_project(files, project)
    return project
