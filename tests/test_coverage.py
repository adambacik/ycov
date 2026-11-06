"""Tests of coverage/: reading mosdepth and bedGraph files into one table and checking their contents."""

import gzip
from pathlib import Path

import polars as pl
import pytest

from ycov.coverage.readers import read_coverage, read_sample
from ycov.errors import YcovInputError
from ycov.models import CHM13_CHRY_LENGTH, Columns, InputFormat, Sample

# Smallest bedGraph that passes every check: one window on each baseline
# chromosome, the first and the last (shorter) chrY window
VALID_LINES = [
    "chr19\t0\t1000\t30.0",
    "chr20\t0\t1000\t30.0",
    "chr21\t0\t1000\t30.0",
    "chr22\t0\t1000\t30.0",
    "chrY\t0\t1000\t15.0",
    f"chrY\t62460000\t{CHM13_CHRY_LENGTH}\t15.0",
]
FIRST_Y = 4  # index of the first chrY line
LAST_Y = 5  # index of the last chrY line


def replaced(index: int, line: str) -> list[str]:
    """VALID_LINES with the line at index replaced."""
    lines = VALID_LINES.copy()
    lines[index] = line
    return lines


def without(chrom: str) -> list[str]:
    """VALID_LINES without the lines of chrom."""
    return [line for line in VALID_LINES if not line.startswith(f"{chrom}\t")]


def write_bedgraph(folder: Path, lines: list[str], name: str = "S1.bedgraph") -> Sample:
    """Write lines as a bedGraph (gzipped if name ends with .gz) and return its Sample."""
    path = folder / name
    text = "\n".join(lines) + "\n"
    if name.endswith(".gz"):
        with gzip.open(path, "wt") as file:
            file.write(text)
    else:
        path.write_text(text)
    return Sample(id=name.split(".")[0], path=path, format=InputFormat.BEDGRAPH)


def mosdepth_sample(data_dir: Path, sample_id: str) -> Sample:
    """A simulated mosdepth slice from tests/data/sim/."""
    path = data_dir / "sim" / f"{sample_id}.regions.bed.gz"
    return Sample(id=sample_id, path=path, format=InputFormat.MOSDEPTH)


# read_sample: valid input


def test_read_sample_mosdepth(data_dir: Path) -> None:
    data = read_sample(mosdepth_sample(data_dir, "S01"))

    assert data.columns == [
        Columns.CHROM,
        Columns.START,
        Columns.END,
        Columns.DEPTH,
        Columns.SAMPLE_ID,
    ]
    # chrX is in the file but not kept
    assert set(data[Columns.CHROM]) == {"chr19", "chr20", "chr21", "chr22", "chrY"}
    assert data.filter(pl.col(Columns.CHROM) == "chrY").height == 62_461
    assert (data[Columns.SAMPLE_ID] == "S01").all()


def test_read_sample_column_types(data_dir: Path) -> None:
    data = read_sample(mosdepth_sample(data_dir, "S01"))

    assert data.schema[Columns.START] == pl.Int64()
    assert data.schema[Columns.END] == pl.Int64()
    assert data.schema[Columns.DEPTH] == pl.Float64()


def test_read_sample_bedgraph(tmp_path: Path) -> None:
    data = read_sample(write_bedgraph(tmp_path, VALID_LINES))

    assert data.height == len(VALID_LINES)


def test_read_sample_bedgraph_gz(tmp_path: Path) -> None:
    data = read_sample(write_bedgraph(tmp_path, VALID_LINES, "S1.bedgraph.gz"))

    assert data.height == len(VALID_LINES)


def test_read_sample_skips_bedgraph_header(tmp_path: Path) -> None:
    header = [
        "track type=bedGraph name=S1",
        "browser position chrY:1-1000",
        "# comment",
    ]

    data = read_sample(write_bedgraph(tmp_path, header + VALID_LINES))

    assert data.height == len(VALID_LINES)


def test_read_sample_adds_chr_prefix(tmp_path: Path) -> None:
    lines = [line.removeprefix("chr") for line in VALID_LINES]  # Y, 19, ...

    data = read_sample(write_bedgraph(tmp_path, lines))

    assert set(data[Columns.CHROM]) == {"chr19", "chr20", "chr21", "chr22", "chrY"}


# read_coverage


def test_read_coverage_concatenates_samples(data_dir: Path) -> None:
    samples = [mosdepth_sample(data_dir, "S01"), mosdepth_sample(data_dir, "S02")]

    data = read_coverage(samples)

    one = read_sample(samples[0])
    assert data[Columns.SAMPLE_ID].unique(maintain_order=True).to_list() == [
        "S01",
        "S02",
    ]
    assert data.height == 2 * one.height


# read_sample: broken input, each case breaks exactly one rule of VALID_LINES


@pytest.mark.parametrize(
    ("lines", "message"),
    [
        pytest.param(
            replaced(0, "chr19\tabc\t1000\t30.0"), "not a 4-column", id="text-in-start"
        ),
        pytest.param(replaced(1, "chr20\t0\t1000"), "empty values", id="short-line"),
        pytest.param(without("chrY"), "no chrY", id="no-chrY"),
        pytest.param(without("chr20"), "no windows on chr20", id="missing-autosome"),
        pytest.param(replaced(FIRST_Y, "chrY\t500\t1500\t15.0"), "grid", id="off-grid"),
        pytest.param(replaced(FIRST_Y, "chrY\t0\t2000\t15.0"), "grid", id="too-long"),
        pytest.param(
            replaced(FIRST_Y, "chrY\t0\t500\t15.0"), "grid", id="short-not-last"
        ),
        pytest.param(
            replaced(LAST_Y, "chrY\t57227000\t57227415\t15.0"), "GRCh38", id="grch38"
        ),
        pytest.param(
            replaced(FIRST_Y, "chrY\t0\t1000\t-1.0"), "negative", id="negative"
        ),
    ],
)
def test_read_sample_rejects_broken_input(
    tmp_path: Path, lines: list[str], message: str
) -> None:
    sample = write_bedgraph(tmp_path, lines)

    with pytest.raises(YcovInputError, match=message) as error:
        read_sample(sample)

    # Every message starts with the file, so the user knows which one is broken
    assert str(error.value).startswith(str(sample.path))


def test_read_sample_rejects_fake_gz(tmp_path: Path) -> None:
    path = tmp_path / "S1.bedgraph.gz"
    path.write_text("\n".join(VALID_LINES))  # plain text, not gzip
    sample = Sample(id="S1", path=path, format=InputFormat.BEDGRAPH)

    with pytest.raises(YcovInputError, match="cannot be read"):
        read_sample(sample)


def test_read_sample_rejects_binary_file(tmp_path: Path) -> None:
    path = tmp_path / "S1.bedgraph"
    path.write_bytes(b"\xff\xfe\x00\x81binary")
    sample = Sample(id="S1", path=path, format=InputFormat.BEDGRAPH)

    with pytest.raises(YcovInputError, match="cannot be read"):
        read_sample(sample)
