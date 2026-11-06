"""Tests of windows/: the chrY window grid and its class, gap, PAR and reliable annotation."""

import polars as pl
import pytest

from ycov.models import CHM13_CHRY_LENGTH, WINDOW_SIZE, Columns
from ycov.windows.build import build_windows

N_WINDOWS = 62_461  # 62 460 full 1 kb windows + the last 29 bp one
N_PAR_WINDOWS = 2_798  # windows overlapping PAR1 or PAR2 by at least 1 bp


@pytest.fixture(scope="module")
def windows() -> pl.DataFrame:
    """The 1 kb window table, built once for all tests in this file."""
    return build_windows(WINDOW_SIZE)


def window_at(windows: pl.DataFrame, start: int) -> dict[str, object]:
    """The row of the window starting at start, as a dict."""
    return windows.filter(pl.col(Columns.START) == start).row(0, named=True)


# grid


def test_build_windows_columns(windows: pl.DataFrame) -> None:
    expected: dict[str, pl.DataType] = {
        Columns.CHROM: pl.String(),
        Columns.START: pl.Int64(),
        Columns.END: pl.Int64(),
        Columns.SEQ_CLASS: pl.String(),
        Columns.IS_GAP: pl.Boolean(),
        Columns.IS_PAR: pl.Boolean(),
        Columns.RELIABLE: pl.Boolean(),
    }

    assert windows.schema == pl.Schema(expected)


def test_build_windows_grid(windows: pl.DataFrame) -> None:
    length = windows[Columns.END] - windows[Columns.START]

    assert windows.height == N_WINDOWS
    assert (windows[Columns.CHROM] == "chrY").all()
    assert (windows[Columns.START] % WINDOW_SIZE == 0).all()
    assert (length[:-1] == WINDOW_SIZE).all()
    # Same last window as mosdepth --by 1000: shorter, ends at the chromosome end
    assert windows.row(-1)[1:3] == (62_460_000, CHM13_CHRY_LENGTH)


def test_build_windows_other_window_size() -> None:
    windows = build_windows(10_000)

    assert windows.height == 6_247
    assert windows.row(-1)[1:3] == (62_460_000, CHM13_CHRY_LENGTH)


# annotation


def test_every_window_has_a_class(windows: pl.DataFrame) -> None:
    assert windows[Columns.SEQ_CLASS].null_count() == 0


@pytest.mark.parametrize(
    ("start", "seq_class", "is_gap", "is_par", "reliable"),
    [
        (0, "PAR1", True, True, False),  # first window
        (2_457_000, "PAR1", True, True, False),  # last window fully in PAR1
        # crosses the PAR1 end: class by midpoint, gap and PAR by overlap
        (2_458_000, "X-DEG", True, True, False),
        (2_459_000, "X-DEG", False, False, True),  # first window after PAR1
        (13_500_000, "X-DEG", False, False, True),  # inside AZFa, not a PAR
        (25_000_000, "AMPL", False, False, True),  # inside AZFc
        (62_121_000, "OTHER", False, False, True),  # last window before PAR2
        (62_122_000, "OTHER", True, True, False),  # crosses the PAR2 start
        (62_460_000, "PAR2", True, True, False),  # last, shorter window
    ],
)
def test_known_windows(
    windows: pl.DataFrame,
    start: int,
    seq_class: str,
    is_gap: bool,
    is_par: bool,
    reliable: bool,
) -> None:
    window = window_at(windows, start)

    assert window[Columns.SEQ_CLASS] == seq_class
    assert window[Columns.IS_GAP] == is_gap
    assert window[Columns.IS_PAR] == is_par
    assert window[Columns.RELIABLE] == reliable


def test_reliable_is_not_gap_and_not_par(windows: pl.DataFrame) -> None:
    expected = ~windows[Columns.IS_GAP] & ~windows[Columns.IS_PAR]

    assert (windows[Columns.RELIABLE] == expected).all()


def test_par_and_gap_totals(windows: pl.DataFrame) -> None:
    assert windows[Columns.IS_PAR].sum() == N_PAR_WINDOWS
    # gaps.bed of the XY reference is exactly the two masked PARs
    assert windows[Columns.IS_GAP].sum() == N_PAR_WINDOWS
    assert windows[Columns.RELIABLE].sum() == N_WINDOWS - N_PAR_WINDOWS
