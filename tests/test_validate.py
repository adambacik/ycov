"""Tests of validate/: input file paths, formats, sample ids and the output folder."""

import os
from pathlib import Path

import pytest

from ycov.errors import YcovInputError
from ycov.models import InputFormat
from ycov.validate.inputs import detect_format, validate_files, validate_output_dir


def touch(folder: Path, name: str) -> Path:
    """Create an empty file in folder and return its path (validate/ never opens it)."""
    path = folder / name
    path.touch()
    return path


# detect_format


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("S1.regions.bed.gz", InputFormat.MOSDEPTH),
        ("S1.REGIONS.BED.GZ", InputFormat.MOSDEPTH),
        ("S1.bedgraph", InputFormat.BEDGRAPH),
        ("S1.bedGraph.gz", InputFormat.BEDGRAPH),
        ("S1.bg", InputFormat.BEDGRAPH),
        ("S1.bg.gz", InputFormat.BEDGRAPH),
    ],
)
def test_detect_format_from_ending(name: str, expected: InputFormat) -> None:
    assert detect_format(Path(name)) == expected


def test_detect_format_rejects_q20() -> None:
    with pytest.raises(YcovInputError, match="MAPQ-filtered"):
        detect_format(Path("S1.q20.regions.bed.gz"))


@pytest.mark.parametrize("name", ["S1.txt", "S1.bed.gz", "S1.bw", "S1"])
def test_detect_format_rejects_unknown_ending(name: str) -> None:
    with pytest.raises(YcovInputError, match="unsupported file type"):
        detect_format(Path(name))


# validate_files


def test_validate_files_returns_samples(tmp_path: Path) -> None:
    mosdepth = touch(tmp_path, "HG00096.regions.bed.gz")
    bedgraph = touch(tmp_path, "S2.bedgraph")

    samples = validate_files([mosdepth, bedgraph])

    assert [s.id for s in samples] == ["HG00096", "S2"]
    assert [s.format for s in samples] == [InputFormat.MOSDEPTH, InputFormat.BEDGRAPH]
    assert [s.path for s in samples] == [mosdepth, bedgraph]


def test_validate_files_rejects_empty_list() -> None:
    with pytest.raises(YcovInputError, match="no input files"):
        validate_files([])


def test_validate_files_rejects_missing_file(tmp_path: Path) -> None:
    with pytest.raises(YcovInputError, match="does not exist"):
        validate_files([tmp_path / "S1.regions.bed.gz"])


def test_validate_files_rejects_folder(tmp_path: Path) -> None:
    folder = tmp_path / "S1.regions.bed.gz"
    folder.mkdir()

    with pytest.raises(YcovInputError, match="is a folder"):
        validate_files([folder])


@pytest.mark.skipif(os.geteuid() == 0, reason="root can read any file")
def test_validate_files_rejects_unreadable_file(tmp_path: Path) -> None:
    file = touch(tmp_path, "S1.regions.bed.gz")
    file.chmod(0o000)

    try:
        with pytest.raises(YcovInputError, match="not readable"):
            validate_files([file])
    finally:
        file.chmod(0o644)  # so pytest can delete tmp_path afterwards


def test_validate_files_rejects_unknown_format(tmp_path: Path) -> None:
    file = touch(tmp_path, "S1.txt")

    with pytest.raises(YcovInputError, match="unsupported file type"):
        validate_files([file])


def test_validate_files_rejects_empty_sample_id(tmp_path: Path) -> None:
    file = touch(tmp_path, ".regions.bed.gz")

    with pytest.raises(YcovInputError, match="no sample id"):
        validate_files([file])


def test_validate_files_rejects_duplicate_id(tmp_path: Path) -> None:
    (tmp_path / "a").mkdir()
    (tmp_path / "b").mkdir()
    first = touch(tmp_path / "a", "S1.regions.bed.gz")
    second = touch(tmp_path / "b", "S1.bedgraph")

    with pytest.raises(YcovInputError, match="sample S1 comes from two files"):
        validate_files([first, second])


# validate_output_dir


def test_validate_output_dir_accepts_new_folder(tmp_path: Path) -> None:
    validate_output_dir(tmp_path / "project")


def test_validate_output_dir_accepts_empty_folder(tmp_path: Path) -> None:
    validate_output_dir(tmp_path)


def test_validate_output_dir_rejects_file(tmp_path: Path) -> None:
    file = touch(tmp_path, "project")

    with pytest.raises(YcovInputError, match="is a file"):
        validate_output_dir(file)


def test_validate_output_dir_rejects_non_empty_folder(tmp_path: Path) -> None:
    touch(tmp_path, "something.txt")

    with pytest.raises(YcovInputError, match="not empty"):
        validate_output_dir(tmp_path)
