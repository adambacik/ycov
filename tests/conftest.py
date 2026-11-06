"""Fixtures shared by all test files (pytest loads this file automatically)."""

from pathlib import Path

import pytest

DATA_DIR = Path(__file__).parent / "data"


@pytest.fixture
def data_dir() -> Path:
    """tests/data/: the slices written by scripts/make_test_data.sh."""
    return DATA_DIR
