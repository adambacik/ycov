"""Command line interface of ycov: `ycov prepare` and `ycov view`.

Only parses the arguments, calls the orchestrator of the command and turns
YcovInputError into a one-line message with exit code 1.
"""

import logging
from pathlib import Path
from typing import Annotated

import typer
from rich.console import Console
from rich.logging import RichHandler

from ycov.errors import YcovInputError
from ycov.prepare import prepare_project
from ycov.view import view_project

app = typer.Typer(
    help="Visualise and compare Y chromosome coverage across many samples.",
    no_args_is_help=True,
    add_completion=False,
)


def setup_logging() -> None:
    """Show ycov's log messages on stderr: progress (INFO).

    Modules only call logging.getLogger(__name__).info(...), this decides how it looks.
    Other libraries stay at WARNING, so their messages do not clutter the output.
    """
    handler = RichHandler(
        console=Console(stderr=True),  # stderr, stdout stays for results
        show_path=False,  # no "prepare.py:42" column, it is for users
        log_time_format="[%H:%M:%S]",
    )
    logging.basicConfig(
        level=logging.WARNING, format="%(message)s", handlers=[handler], force=True
    )
    logging.getLogger("ycov").setLevel(logging.INFO)


@app.command()
def prepare(
    files: Annotated[
        list[Path],
        typer.Argument(
            help="Coverage files: mosdepth .regions.bed.gz or bedGraph (.bedgraph, .bg, optionally .gz)",
            exists=False,
            dir_okay=False,
            readable=True,
        ),
    ],
    out: Annotated[
        Path,
        typer.Option(
            "--output", "-o", help="Project folder to create", file_okay=False
        ),
    ],
) -> None:
    """Read coverage files and write them into a ycov project folder."""
    setup_logging()

    try:
        prepare_project(files, out)
    except YcovInputError as error:
        typer.echo(f"Error: {error}", err=True)
        raise typer.Exit(code=1) from error

    typer.echo(f"Open with: ycov view {out}")


@app.command()
def view(
    project: Annotated[
        Path,
        typer.Argument(
            help="Project folder made by ycov prepare", exists=False, file_okay=False
        ),
    ],
) -> None:
    """Open a ycov project folder in the browser."""
    setup_logging()

    try:
        view_project(project)
    except YcovInputError as error:
        typer.echo(f"Error: {error}", err=True)
        raise typer.Exit(code=1) from error
