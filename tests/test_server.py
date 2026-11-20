"""Tests of server/: the four API endpoints through TestClient on a project built
from tests/data/sim, the frontend mount and its "not built" fallback, and the
helpers (parse_region, parse_samples, merge_runs, coverage, window_annotations)
on tiny hand-made tables without HTTP."""

from importlib.metadata import version
from itertools import pairwise
from pathlib import Path
from typing import Any

import polars as pl
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from ycov.errors import YcovInputError
from ycov.models import CHM13_CHRY_LENGTH, Columns
from ycov.server.app import create_app, parse_region, parse_samples
from ycov.server.queries import coverage, merge_runs, window_annotations
from ycov.windows.assign import NAME

SIM_SAMPLES = ["S01", "S02", "S03", "S04"]
AZFC = "chrY:23327301-27020249"
HEATMAP_BINS = -(-CHM13_CHRY_LENGTH // 10_000)  # ceil: 6247 bins of 10 kb
API_PATHS = {"/api/project", "/api/samples", "/api/windows", "/api/coverage"}


@pytest.fixture(scope="module")
def client(sim_project: Path) -> TestClient:
    """A TestClient on the simulated project without a frontend, one app for this file."""
    return TestClient(create_app(sim_project))


@pytest.fixture
def frontend(tmp_path: Path) -> Path:
    """A fake Vite build: index.html and one hashed asset, like web/dist."""
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><div id='root'>ycov app</div>")
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log('ycov')")
    return tmp_path


def get_ok(client: TestClient, url: str) -> Any:
    """GET url, check it answered 200 and return the parsed JSON."""
    response = client.get(url)
    assert response.status_code == 200, response.text
    return response.json()


def present(values: list[float | None]) -> list[float]:
    """The non-null values of one coverage row."""
    return [v for v in values if v is not None]


# create_app


def test_create_app_rejects_folder_without_manifest(tmp_path: Path) -> None:
    # The error must come before any server starts, so ycov view can print it
    with pytest.raises(YcovInputError, match="manifest.json missing"):
        create_app(tmp_path)


# Frontend: the built web/dist at /, or the "not built" page


def test_frontend_served_at_root(sim_project: Path, frontend: Path) -> None:
    client = TestClient(create_app(sim_project, frontend))

    page = client.get("/")
    asset = client.get("/assets/index-abc123.js")

    assert page.status_code == 200
    assert "ycov app" in page.text
    assert page.headers["content-type"].startswith("text/html")
    assert asset.status_code == 200
    assert asset.text == "console.log('ycov')"


def test_frontend_mount_does_not_hide_the_api(
    sim_project: Path, frontend: Path
) -> None:
    # The mount at / matches every path, so it must come after the API routes
    client = TestClient(create_app(sim_project, frontend))

    response = client.get("/api/project")

    assert response.status_code == 200
    assert response.json()["chromosome"] == "chrY"


def test_frontend_unknown_file_is_404(sim_project: Path, frontend: Path) -> None:
    client = TestClient(create_app(sim_project, frontend))

    assert client.get("/assets/missing.js").status_code == 404


@pytest.mark.parametrize("given", ["none", "missing", "empty"])
def test_not_built_page_without_frontend(
    sim_project: Path, tmp_path: Path, given: str
) -> None:
    # No folder, a folder that does not exist (StaticFiles would raise) and a
    # folder without index.html (failed build) all fall back to the page
    frontend_dir = {"none": None, "missing": tmp_path / "dist", "empty": tmp_path}[
        given
    ]
    client = TestClient(create_app(sim_project, frontend_dir))

    page = client.get("/")

    assert page.status_code == 200
    assert "npm run build" in page.text
    assert get_ok(client, "/api/project")["chromosome"] == "chrY"


@pytest.mark.parametrize("with_frontend", [True, False])
def test_api_docs_list_only_the_api(
    sim_project: Path, frontend: Path, with_frontend: bool
) -> None:
    # Neither the mount nor the "not built" page belongs in /docs
    client = TestClient(create_app(sim_project, frontend if with_frontend else None))

    assert set(get_ok(client, "/openapi.json")["paths"]) == API_PATHS


# GET /api/project


def test_project_returns_manifest(client: TestClient) -> None:
    project = get_ok(client, "/api/project")

    assert project["ycov_version"] == version("ycov")
    assert project["reference"] == "T2T-CHM13v2.0"
    assert project["chromosome"] == "chrY"
    assert project["length"] == CHM13_CHRY_LENGTH
    assert project["window_size"] == 1000


# GET /api/samples


def test_samples_in_manifest_order_with_baselines(client: TestClient) -> None:
    samples = get_ok(client, "/api/samples")

    assert [s["sample_id"] for s in samples] == SIM_SAMPLES
    assert all(s["format"] == "mosdepth" for s in samples)
    # All simulated at 30x on the autosomes
    assert all(s["baseline"] == pytest.approx(30, rel=0.05) for s in samples)


# GET /api/windows


def test_windows_classes_cover_chromosome_without_gaps(client: TestClient) -> None:
    windows = get_ok(client, "/api/windows")
    classes = windows["classes"]

    assert classes[0]["start"] == 0
    assert classes[-1]["end"] == windows["length"] == CHM13_CHRY_LENGTH
    for left, right in pairwise(classes):
        assert left["end"] == right["start"]  # no gap, no overlap
        assert left["name"] != right["name"]  # neighbours with one class are merged


def test_windows_regions_from_bundled_bed(client: TestClient) -> None:
    regions = get_ok(client, "/api/windows")["regions"]

    assert [r["name"] for r in regions] == ["PAR1", "AZFa", "AZFb", "AZFc", "PAR2"]
    # Exact BED coordinates, not snapped to windows
    assert regions[0] == {"name": "PAR1", "start": 0, "end": 2458320}


def test_windows_masked_are_the_pars(client: TestClient) -> None:
    masked = get_ok(client, "/api/windows")["masked"]

    # Every CHM13 gap is inside a masked PAR, so the PARs are the only masks
    assert masked == [
        {"name": "par", "start": 0, "end": 2459000},
        {"name": "par", "start": 62122000, "end": CHM13_CHRY_LENGTH},
    ]


# GET /api/coverage


def test_coverage_defaults(client: TestClient) -> None:
    # Small region, the default whole chrY at 1 kb would be a 4 x 62 461 matrix
    result = get_ok(client, "/api/coverage?region=chrY:3000000-3005000")

    assert result["resolution"] == 1000
    assert result["mode"] == "rel_copy"
    assert result["samples"] == SIM_SAMPLES
    assert result["region"] == {"chromosome": "chrY", "start": 3000000, "end": 3005000}
    assert result["starts"] == [3000000, 3001000, 3002000, 3003000, 3004000]


def test_coverage_heatmap_shape(client: TestClient) -> None:
    result = get_ok(client, "/api/coverage?resolution=10000")

    assert len(result["starts"]) == HEATMAP_BINS
    assert len(result["values"]) == len(SIM_SAMPLES)
    assert all(len(row) == HEATMAP_BINS for row in result["values"])


def test_coverage_par1_is_null(client: TestClient) -> None:
    result = get_ok(client, "/api/coverage?resolution=10000")

    # Bins fully inside the masked PAR1 have no reliable window
    par_bins = [i for i, s in enumerate(result["starts"]) if s + 10_000 <= 2_458_000]
    for row in result["values"]:
        assert all(row[i] is None for i in par_bins)


def test_coverage_azfc_deletion_is_zero(client: TestClient) -> None:
    result = get_ok(client, f"/api/coverage?region={AZFC}&samples=S02,S01")
    deleted, normal = result["values"]

    # Edge windows are partly outside AZFc, so check the inner ones
    assert set(present(deleted[1:-1])) == {0.0}
    assert sum(present(normal)) > 0


def test_coverage_female_has_no_y(client: TestClient) -> None:
    result = get_ok(client, "/api/coverage?resolution=10000&samples=S04")

    assert set(present(result["values"][0])) == {0.0}


def test_coverage_keeps_requested_sample_order(client: TestClient) -> None:
    result = get_ok(client, "/api/coverage?region=chrY:3000000-3005000&samples=S03,S01")

    assert result["samples"] == ["S03", "S01"]
    assert len(result["values"]) == 2


def test_coverage_depth_mode(client: TestClient) -> None:
    # One 10 kb bin of reliable X-DEG windows: depth = rel_copy * baseline / 2
    url = "/api/coverage?region=chrY:2500000-2510000&resolution=10000&samples=S01"
    rel_copy = get_ok(client, url)["values"][0][0]
    depth = get_ok(client, url + "&mode=depth")["values"][0][0]
    baseline = get_ok(client, "/api/samples")[0]["baseline"]

    assert depth == pytest.approx(rel_copy * baseline / 2, rel=0.01)


@pytest.mark.parametrize(
    "query",
    [
        "region=chrY:10-5",  # start >= end
        "region=chr1:0-1000",  # wrong chromosome
        "region=chrY:abc-1000",  # not a number
        "region=chrY:0-99999999999",  # beyond the chromosome
        "resolution=1500",  # not a multiple of the window size
        "resolution=0",
        "mode=y_ratio",  # not a mode
    ],
)
def test_coverage_invalid_parameters_give_422(client: TestClient, query: str) -> None:
    assert client.get(f"/api/coverage?{query}").status_code == 422


def test_coverage_unknown_sample_gives_404(client: TestClient) -> None:
    response = client.get("/api/coverage?samples=S01,NOPE")

    assert response.status_code == 404
    assert "NOPE" in response.json()["detail"]


# parse_region


def test_parse_region_none_is_whole_chromosome() -> None:
    assert parse_region(None, "chrY", 5000) == (0, 5000)


def test_parse_region_valid() -> None:
    assert parse_region("chrY:100-200", "chrY", 5000) == (100, 200)
    assert parse_region("chrY:0-5000", "chrY", 5000) == (
        0,
        5000,
    )  # end is inclusive limit


@pytest.mark.parametrize(
    "region",
    [
        "",
        "chrY",
        "chrY:5",
        "chrY:-5-10",
        "chrY:+5-10",
        "chrY:1,000-2,000",
        "chrY:0-5001",
    ],
)
def test_parse_region_rejects(region: str) -> None:
    with pytest.raises(HTTPException) as error:
        parse_region(region, "chrY", 5000)

    assert error.value.status_code == 422


# parse_samples

KNOWN = ["S01", "S02", "S03"]


@pytest.mark.parametrize(
    ("param", "expected"),
    [
        (None, KNOWN),  # left out -> all
        ("", KNOWN),  # empty -> all
        (",,", KNOWN),  # only separators -> all
        ("S02,S01", ["S02", "S01"]),  # requested order kept
        (" S01 , S02 ", ["S01", "S02"]),  # spaces stripped
        ("S01,S01", ["S01"]),  # duplicates dropped
    ],
)
def test_parse_samples(param: str | None, expected: list[str]) -> None:
    assert parse_samples(param, KNOWN) == expected


def test_parse_samples_unknown_gives_404() -> None:
    with pytest.raises(HTTPException) as error:
        parse_samples("S01,NOPE", KNOWN)

    assert error.value.status_code == 404
    assert "NOPE" in str(error.value.detail)


# merge_runs


def label_windows(labels: list[str | None]) -> pl.DataFrame:
    """Consecutive 1 kb windows from 0 with the given labels."""
    return pl.DataFrame(
        {
            Columns.START: [i * 1000 for i in range(len(labels))],
            Columns.END: [(i + 1) * 1000 for i in range(len(labels))],
            "label": labels,
        }
    )


def test_merge_runs_keeps_separate_blocks_apart() -> None:
    # A group_by on the label alone would merge both A blocks into 0-4000
    result = merge_runs(label_windows(["A", "A", "B", "A"]), pl.col("label"))

    assert result.rows() == [("A", 0, 2000), ("B", 2000, 3000), ("A", 3000, 4000)]


def test_merge_runs_sorts_by_start() -> None:
    windows = label_windows(["A", "A", "B"]).reverse()

    assert merge_runs(windows, pl.col("label"))[NAME].to_list() == ["A", "B"]


# window_annotations


def test_window_annotations_names_masks_by_reason() -> None:
    windows = pl.DataFrame(
        {
            Columns.CHROM: ["chrY"] * 4,
            Columns.START: [0, 1000, 2000, 3000],
            Columns.END: [1000, 2000, 3000, 3500],  # last window shorter
            Columns.SEQ_CLASS: ["PAR1", "X-DEG", "X-DEG", "AMPL"],
            Columns.IS_GAP: [True, False, True, False],
            Columns.IS_PAR: [True, False, False, False],
            Columns.RELIABLE: [False, True, False, True],
        }
    )

    result = window_annotations(windows)

    assert (result.chromosome, result.length, result.window_size) == (
        "chrY",
        3500,
        1000,
    )
    assert [(m.name, m.start, m.end) for m in result.masked] == [
        ("par", 0, 1000),
        ("gap", 2000, 3000),
    ]
    assert [c.name for c in result.classes] == ["PAR1", "X-DEG", "AMPL"]


# coverage


def coverage_table() -> pl.DataFrame:
    """Samples A and B on six 1 kb windows from 0, depth = 10 * rel_copy.

    A: null 0.9 | 1.0 1.0 | 0.0 1.0    (bins of 2 kb)
    B: null null | 0.5 0.5 | 0.5 0.5
    """
    rel_copy = [None, 0.9, 1.0, 1.0, 0.0, 1.0, None, None, 0.5, 0.5, 0.5, 0.5]
    return pl.DataFrame(
        {
            Columns.SAMPLE_ID: ["A"] * 6 + ["B"] * 6,
            Columns.START: [i * 1000 for i in range(6)] * 2,
            Columns.END: [(i + 1) * 1000 for i in range(6)] * 2,
            Columns.DEPTH: [10.0 * (v or 0) for v in rel_copy],
            Columns.REL_COPY: rel_copy,
        },
        schema_overrides={Columns.REL_COPY: pl.Float64},
    )


def test_coverage_bins_mean_skips_nulls_and_keeps_order() -> None:
    result = coverage(coverage_table(), ["B", "A"], 1500, 6000, 2000, "rel_copy")

    # Region starts at 1500, bins stay on the grid from 0
    assert result.starts == [0, 2000, 4000]
    assert result.samples == ["B", "A"]
    assert result.values == [
        [None, 0.5, 0.5],  # B: an all-null bin stays null
        [0.9, 1.0, 0.5],  # A: null skipped in bin 0, deletion edge in bin 4000
    ]


def test_coverage_window_resolution_returns_stored_values() -> None:
    result = coverage(coverage_table(), ["A"], 0, 6000, 1000, "rel_copy")

    assert result.values == [[None, 0.9, 1.0, 1.0, 0.0, 1.0]]


def test_coverage_region_on_grid_has_no_extra_bin() -> None:
    result = coverage(coverage_table(), ["A"], 0, 4000, 2000, "rel_copy")

    assert result.starts == [0, 2000]  # not a third bin starting at 4000


def test_coverage_depth_mode_uses_depth_column() -> None:
    result = coverage(coverage_table(), ["A"], 0, 2000, 2000, "depth")

    assert result.values == [[4.5]]  # mean of 0 and 9, depth has no nulls


def test_coverage_rows_have_one_value_per_bin() -> None:
    # B has no windows past 6000: its bins there are null, not missing
    result = coverage(coverage_table(), ["A", "B"], 0, 10_000, 2000, "rel_copy")

    assert all(len(row) == len(result.starts) == 5 for row in result.values)
    assert result.values[1][3:] == [None, None]
