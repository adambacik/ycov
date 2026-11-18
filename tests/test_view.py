"""Tests of view.py and the `ycov view` command: the project check, the port
check, starting uvicorn on localhost and opening the browser.

No real server or browser is started: uvicorn.Server.run and webbrowser.open
are replaced by fakes that only record how they were called.
"""

import logging
import socket
import threading
import webbrowser
from collections.abc import Iterator
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace

import pytest
import uvicorn
from fastapi import FastAPI
from fastapi.testclient import TestClient
from typer.testing import CliRunner

import ycov.view
from ycov.cli import cli_parser
from ycov.errors import YcovInputError
from ycov.view import check_port, open_when_started, view_project

HOST = "127.0.0.1"


@dataclass
class FakeServer:
    """Records every uvicorn.Server.run call instead of serving."""

    configs: list[uvicorn.Config] = field(default_factory=list)
    raises: BaseException | None = None  # e.g. KeyboardInterrupt for Ctrl+C

    def client(self) -> TestClient:
        """A TestClient on the app uvicorn was given (must be the FastAPI app)."""
        app = self.configs[0].app
        assert isinstance(app, FastAPI)  # Config.app may also be an import string
        return TestClient(app)


@dataclass
class FakeBrowser:
    """Records every webbrowser.open call instead of opening a browser."""

    urls: list[str] = field(default_factory=list)
    opened: threading.Event = field(default_factory=threading.Event)


@pytest.fixture
def fake_server(monkeypatch: pytest.MonkeyPatch) -> FakeServer:
    """Replace uvicorn.Server.run: record the config, mark the server started, return."""
    fake = FakeServer()

    def run(self: uvicorn.Server, sockets: object = None) -> None:
        fake.configs.append(self.config)
        self.started = True  # lets open_when_started go on, like a real start
        if fake.raises is not None:
            raise fake.raises

    monkeypatch.setattr(uvicorn.Server, "run", run)
    return fake


@pytest.fixture
def fake_browser(monkeypatch: pytest.MonkeyPatch) -> FakeBrowser:
    """Replace webbrowser.open: record the URL."""
    fake = FakeBrowser()

    def open_url(url: str, *args: object, **kwargs: object) -> bool:
        fake.urls.append(url)
        fake.opened.set()
        return True

    monkeypatch.setattr(webbrowser, "open", open_url)
    return fake


@pytest.fixture
def free_port() -> int:
    """A port nothing listens on: the system picks one, the socket is closed again."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        port: int = s.getsockname()[1]
    return port


@pytest.fixture
def busy_port() -> Iterator[int]:
    """A port another program is listening on for the whole test."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((HOST, 0))
        s.listen()
        yield s.getsockname()[1]


@pytest.fixture
def ycov_logs(caplog: pytest.LogCaptureFixture) -> pytest.LogCaptureFixture:
    """caplog with ycov's INFO messages, as setup_logging shows them."""
    caplog.set_level(logging.INFO, logger="ycov")
    return caplog


# view_project: starting


def test_view_serves_on_localhost_and_opens_browser(
    sim_project: Path,
    fake_server: FakeServer,
    fake_browser: FakeBrowser,
    free_port: int,
) -> None:
    view_project(sim_project, free_port)

    [config] = fake_server.configs
    assert config.host == HOST  # NFR2: localhost only
    assert config.port == free_port
    # The browser opens from a background thread once the server has started
    assert fake_browser.opened.wait(timeout=2)
    assert fake_browser.urls == [f"http://{HOST}:{free_port}/"]


def test_view_serves_the_given_project(
    sim_project: Path,
    fake_server: FakeServer,
    fake_browser: FakeBrowser,
    free_port: int,
) -> None:
    view_project(sim_project, free_port, open_browser=False)

    # The app handed to uvicorn answers with the project's samples
    client = fake_server.client()
    samples = client.get("/api/samples").json()
    assert [s["sample_id"] for s in samples] == ["S01", "S02", "S03", "S04"]


def test_view_without_browser(
    sim_project: Path,
    fake_server: FakeServer,
    fake_browser: FakeBrowser,
    free_port: int,
) -> None:
    view_project(sim_project, free_port, open_browser=False)

    assert len(fake_server.configs) == 1  # still served
    assert fake_browser.urls == []  # no thread was started, nothing to wait for


def test_view_logs_address_and_stops_cleanly_on_ctrl_c(
    sim_project: Path,
    fake_server: FakeServer,
    fake_browser: FakeBrowser,
    free_port: int,
    ycov_logs: pytest.LogCaptureFixture,
) -> None:
    # uvicorn shuts down on Ctrl+C and raises KeyboardInterrupt again
    fake_server.raises = KeyboardInterrupt()

    view_project(sim_project, free_port, open_browser=False)  # must not raise

    assert f"http://{HOST}:{free_port}/" in ycov_logs.text
    assert "Ctrl+C" in ycov_logs.text
    assert ycov_logs.records[-1].getMessage() == "Stopped"


# view_project: errors before anything starts


@pytest.mark.parametrize("folder", ["missing", "empty"])
def test_view_rejects_folder_that_is_not_a_project(
    tmp_path: Path,
    fake_server: FakeServer,
    fake_browser: FakeBrowser,
    free_port: int,
    folder: str,
) -> None:
    project = tmp_path / "missing" if folder == "missing" else tmp_path

    with pytest.raises(YcovInputError, match="not a ycov project"):
        view_project(project, free_port)

    assert fake_server.configs == []
    assert fake_browser.urls == []


def test_view_rejects_busy_port(
    sim_project: Path,
    fake_server: FakeServer,
    fake_browser: FakeBrowser,
    busy_port: int,
) -> None:
    with pytest.raises(YcovInputError, match=f"port {busy_port} cannot be used"):
        view_project(sim_project, busy_port)

    assert fake_server.configs == []
    assert fake_browser.urls == []


# view_project: frontend


def test_view_warns_when_frontend_not_built(
    sim_project: Path,
    fake_server: FakeServer,
    free_port: int,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    ycov_logs: pytest.LogCaptureFixture,
) -> None:
    monkeypatch.setattr(ycov.view, "FRONTEND_DIR", tmp_path / "dist")  # no build

    view_project(sim_project, free_port, open_browser=False)

    assert "Frontend not built" in ycov_logs.text
    client = fake_server.client()
    assert "npm run build" in client.get("/").text


def test_view_serves_built_frontend(
    sim_project: Path,
    fake_server: FakeServer,
    free_port: int,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    ycov_logs: pytest.LogCaptureFixture,
) -> None:
    (tmp_path / "index.html").write_text("<div id='root'>ycov app</div>")
    monkeypatch.setattr(ycov.view, "FRONTEND_DIR", tmp_path)

    view_project(sim_project, free_port, open_browser=False)

    assert "Frontend not built" not in ycov_logs.text
    client = fake_server.client()
    assert "ycov app" in client.get("/").text


def test_frontend_dir_is_web_dist_in_the_repo() -> None:
    # src/ycov/view.py -> repo root -> web/dist, next to pyproject.toml
    repo = ycov.view.FRONTEND_DIR.parents[1]

    assert ycov.view.FRONTEND_DIR.parts[-2:] == ("web", "dist")
    assert (repo / "pyproject.toml").is_file()


# check_port


def test_check_port_accepts_free_port(free_port: int) -> None:
    check_port(free_port)  # no error


def test_check_port_rejects_busy_port(busy_port: int) -> None:
    with pytest.raises(YcovInputError, match=f"try --port {busy_port + 1}") as error:
        check_port(busy_port)

    assert "in use" in str(error.value)  # strerror: "Address already in use"


# open_when_started


def test_open_when_started_opens_url(fake_browser: FakeBrowser) -> None:
    server = SimpleNamespace(started=True)

    open_when_started(server, "http://127.0.0.1:8000/")  # type: ignore[arg-type]

    assert fake_browser.urls == ["http://127.0.0.1:8000/"]


def test_open_when_started_waits_for_server(fake_browser: FakeBrowser) -> None:
    server = SimpleNamespace(started=False)
    threading.Timer(0.2, lambda: setattr(server, "started", True)).start()

    open_when_started(server, "http://127.0.0.1:8000/")  # type: ignore[arg-type]

    # Returns only after the flag was set, and opens exactly once
    assert server.started
    assert fake_browser.urls == ["http://127.0.0.1:8000/"]


# The `ycov view` command


def test_cli_view_wrong_folder_gives_one_line_error(tmp_path: Path) -> None:
    result = CliRunner().invoke(cli_parser.app, ["view", str(tmp_path / "missing")])

    assert result.exit_code == 1
    assert "Error:" in result.output
    assert "not a ycov project" in result.output
    assert "Traceback" not in result.output


@pytest.mark.parametrize(
    ("options", "port", "open_browser"),
    [
        ([], 8000, True),  # defaults
        (["--port", "8123"], 8123, True),
        (["-p", "8123", "--no-browser"], 8123, False),
    ],
)
def test_cli_view_passes_options(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    options: list[str],
    port: int,
    open_browser: bool,
) -> None:
    calls: list[tuple[Path, int, bool]] = []

    def fake_view(
        project_dir: Path, port: int = 8000, open_browser: bool = True
    ) -> None:
        calls.append((project_dir, port, open_browser))

    monkeypatch.setattr(cli_parser, "view_project", fake_view)

    result = CliRunner().invoke(cli_parser.app, ["view", str(tmp_path), *options])

    assert result.exit_code == 0, result.output
    assert calls == [(tmp_path, port, open_browser)]
