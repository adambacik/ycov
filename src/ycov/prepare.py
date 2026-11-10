"""Orchestrator of `ycov prepare`: the order of the steps from coverage files to a project folder."""

import logging
import time
from pathlib import Path

from ycov.analysis.normalise import normalise
from ycov.coverage.readers import read_coverage
from ycov.models import WINDOW_SIZE, Columns, Sample
from ycov.project.handle_project import write_project
from ycov.validate.inputs import validate_files, validate_output_dir
from ycov.windows.build import build_windows

logger = logging.getLogger(__name__)


def prepare_project(files: list[Path], outdir: Path) -> None:
    """Read the coverage files, annotate and normalise them and write the project folder.

    Progress goes to the ycov loggers, one "[step/total]" line per step and an
    indented line per result, the CLI decides how it is shown.
    """
    started = time.perf_counter()

    logger.info("[1/5] Validating %d inputs", len(files))
    samples: list[Sample] = validate_files(files)
    validate_output_dir(outdir)

    logger.info("[2/5] Annotating chrY windows")
    windows = build_windows(WINDOW_SIZE)
    logger.info(
        "      %s windows of %d bp, %s reliable",
        f"{windows.height:,}",
        WINDOW_SIZE,
        f"{windows[Columns.RELIABLE].sum():,}",
    )

    logger.info("[3/5] Reading %d samples", len(samples))
    coverage = read_coverage(samples)  # logs one line per sample

    logger.info("[4/5] Normalising")
    samples, coverage = normalise(coverage, windows, samples)
    for sample in samples:
        logger.info("      %s  baseline %.1fx", sample.id, sample.baseline)

    logger.info("[5/5] Writing project to %s", outdir)
    write_project(outdir, windows, samples, coverage, WINDOW_SIZE)

    logger.info(
        "Finished in %.1f s: %d samples", time.perf_counter() - started, len(samples)
    )
