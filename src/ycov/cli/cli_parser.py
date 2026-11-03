"""Command line interface of ycov: `ycov prepare` and `ycov view`.

Only parses the arguments, calls the orchestrator of the command and turns
YcovInputError into a one-line message with exit code 1.
"""

from pathlib import Path
from typing import Annotated

import typer

from ycov.errors import YcovInputError
from ycov.prepare import prepare_project
from ycov.view import view_project

app = typer.Typer(
    help="Visualise and compare Y chromosome coverage across many samples.",
    no_args_is_help=True,
    add_completion=False,
)


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
        typer.Option("--out", "-o", help="Project folder to create", file_okay=False),
    ],
) -> None:
    """Read coverage files and write them into a ycov project folder."""
    try:
        prepare_project(files, out)
    except YcovInputError as error:
        typer.echo(f"Error: {error}", err=True)
        raise typer.Exit(code=1) from error


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
    try:
        view_project(project)
    except YcovInputError as error:
        typer.echo(f"Error: {error}", err=True)
        raise typer.Exit(code=1) from error
