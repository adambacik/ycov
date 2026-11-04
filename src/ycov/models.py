"""Shared vocabulary of ycov: input formats, column names, the Sample record and fixed reference facts."""

from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

WINDOW_SIZE = 1000
CHM13_CHRY_LENGTH = 62_460_029
BASELINE_CHROMS = ("chr19", "chr20", "chr21", "chr22")


class InputFormat(StrEnum):
    MOSDEPTH = "mosdepth"
    BEDGRAPH = "bedgraph"
    # bigwig, cram, crai, fasta, fai ... in phase 3


class Columns(StrEnum):
    SAMPLE_ID = "sample_id"
    CHROM = "chrom"
    START = "start"
    END = "end"
    DEPTH = "depth"
    SEQ_CLASS = "seq_class"
    IS_GAP = "is_gap"
    IS_PAR = "is_par"
    RELIABLE = "reliable"


@dataclass(frozen=True)
class Sample:
    id: str
    path: Path
    format: InputFormat
    # baseline, sex, population, Y ratio ... in phase 3


# class Settings in phase 3
