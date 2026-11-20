"""Orchestrator of `ycov view`: load a project folder, serve it on localhost and
open it in the browser."""

import logging
import socket
import threading
import time
import webbrowser
from pathlib import Path

import uvicorn

from ycov.errors import YcovInputError
from ycov.server.app import HOST, create_app

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "web" / "dist"
logger = logging.getLogger(__name__)


def view_project(
    project_dir: Path, port: int = 8000, open_browser: bool = True
) -> None:
    """Load the project, serve it on http://127.0.0.1:<port> and open the browser.

    Blocks until Ctrl+C. Raises YcovInputError if the folder is not a valid
    project or the port cannot be used, before anything is started.
    """
    # load project
    app = create_app(project_dir, FRONTEND_DIR)

    if not (FRONTEND_DIR / "index.html").is_file():
        logger.warning(
            "Frontend not built (%s missing), serving API only", FRONTEND_DIR
        )

    check_port(port)

    url = f"http://{HOST}:{port}/"
    # start uvicorn and open browser
    uvicorn_server = uvicorn.Server(
        uvicorn.Config(app, host=HOST, port=port, log_level="warning", log_config=None)
    )
    if open_browser:
        threading.Thread(
            target=open_when_started, args=(uvicorn_server, url), daemon=True
        ).start()

    # start the server
    logger.info("Serving %s at %s, press Ctrl+C to stop", project_dir, url)
    try:
        uvicorn_server.run()
    except KeyboardInterrupt:
        pass
    logger.info("Stopped")


def check_port(port: int) -> None:
    """Raise YcovInputError if HOST:port cannot be used (in use, or below 1024 without root).

    Binds a socket the way uvicorn will and closes it again. SO_REUSEADDR as in
    uvicorn, so a port closed seconds ago (TIME_WAIT) does not count as in use.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind((HOST, port))
        except OSError as error:
            raise YcovInputError(
                f"port {port} cannot be used ({error.strerror}), try --port {port + 1}"
            ) from error


def open_when_started(server: uvicorn.Server, url: str) -> None:
    """Wait until uvicorn is listening, then open url in the default browser.

    Runs in a background thread while server.run() blocks the main one, so the
    page never opens on "connection refused". Without a browser (e.g. over SSH)
    nothing opens, the logged URL stays to copy.
    """
    while not server.started:
        time.sleep(0.05)
    webbrowser.open(url)
