"""Orchestrator of `ycov prepare`: the order of the steps from coverage files to a project folder."""

from pathlib import Path

from ycov.coverage.readers import read_coverage
from ycov.models import Sample
from ycov.validate.inputs import validate_files, validate_output_dir


def prepare_project(files: list[Path], outdir: Path) -> None:
    """Read the coverage files, annotate and normalise them and write the project folder."""
    # validate
    samples: list[Sample] = validate_files(files)
    validate_output_dir(outdir)

    # coverage
    coverages = read_coverage(samples)

    # windows with annotations

    # save to outdir folder
