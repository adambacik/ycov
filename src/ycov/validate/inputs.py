"""Checks of the `ycov prepare` inputs that need only the paths, before any file is opened."""

import os
from pathlib import Path

from ycov.errors import YcovInputError
from ycov.models import InputFormat, Sample

MOSDEPTH_ENDING = ".regions.bed.gz"
MOSDEPTH_Q20_ENDING = ".q20.regions.bed.gz"
BEDGRAPH_ENDINGS = (".bedgraph", ".bedgraph.gz", ".bg", ".bg.gz")


def detect_format(file: Path) -> InputFormat:
    """Input format from the file ending (case-insensitive)."""
    name = file.name.lower()

    # Checked before MOSDEPTH_ENDING, which it also matches
    if name.endswith(MOSDEPTH_Q20_ENDING):
        raise YcovInputError(
            f"{file}: MAPQ-filtered coverage is not supported yet, pass the all-reads "
            f"<sample>{MOSDEPTH_ENDING} file instead"
        )
    if name.endswith(MOSDEPTH_ENDING):
        return InputFormat.MOSDEPTH
    if name.endswith(BEDGRAPH_ENDINGS):
        return InputFormat.BEDGRAPH

    raise YcovInputError(
        f"{file}: unsupported file type, expected mosdepth {MOSDEPTH_ENDING} "
        f"or bedGraph {', '.join(BEDGRAPH_ENDINGS)}"
    )


def validate_files(files: list[Path]) -> list[Sample]:
    """Check every input file and turn it into a Sample: id = file name up to the first dot, format from the ending."""
    if not files:
        raise YcovInputError("no input files given, pass at least one coverage file")

    samples: list[Sample] = []
    seen: dict[str, Path] = {}  # sample id -> file it came from

    for file in files:
        if not file.exists():
            raise YcovInputError(f"{file}: file does not exist")
        if not file.is_file():
            raise YcovInputError(f"{file}: is a folder, expected a coverage file")
        if not os.access(file, os.R_OK):
            raise YcovInputError(f"{file}: file is not readable, check its permissions")

        fmt = detect_format(file)

        sample_id = file.name.split(".")[0]
        if not sample_id:
            raise YcovInputError(
                f"{file}: no sample id, the file name must start with it (e.g. HG00096{MOSDEPTH_ENDING})"
            )
        if sample_id in seen:
            raise YcovInputError(
                f"sample {sample_id} comes from two files: {seen[sample_id]} and {file}"
            )

        seen[sample_id] = file
        samples.append(Sample(id=sample_id, path=file, format=fmt))

    return samples


def validate_output_dir(outdir: Path) -> None:
    """The project folder may be missing or empty, an existing file or non-empty folder is not overwritten."""
    if outdir.is_file():
        raise YcovInputError(f"{outdir}: is a file, expected a folder for the project")
    if outdir.is_dir() and any(outdir.iterdir()):
        raise YcovInputError(
            f"{outdir}: folder is not empty, choose a new or empty folder for the project"
        )
