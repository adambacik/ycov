"""Orchestrator of `ycov prepare`: the order of the steps from coverage files to a project folder."""

from pathlib import Path

from ycov.analysis.normalise import normalise
from ycov.coverage.readers import read_coverage
from ycov.models import WINDOW_SIZE, Sample
from ycov.project.handle_project import write_project
from ycov.validate.inputs import validate_files, validate_output_dir
from ycov.windows.build import build_windows


def prepare_project(files: list[Path], outdir: Path) -> None:
    """Read the coverage files, annotate and normalise them and write the project folder."""
    # validate
    samples: list[Sample] = validate_files(files)
    validate_output_dir(outdir)

    # coverage
    coverage = read_coverage(samples)

    # windows with annotations
    windows = build_windows(WINDOW_SIZE)

    # normalise
    samples, coverage = normalise(coverage, windows, samples)

    # write outdir folder
    write_project(outdir, windows, samples, coverage, WINDOW_SIZE)
