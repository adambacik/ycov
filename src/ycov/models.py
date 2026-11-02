from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class InputFormat(StrEnum):
    MOSDEPTH = "mosdepth"
    BEDGRAPH = "bedgraph"
    # bigwig, cram, crai, fasta, fai ... in phase 3


@dataclass(frozen=True)
class Sample:
    id: str
    path: Path
    format: InputFormat
    # baseline, sex, population, Y ratio ... in phase 3


# class Settings in phase 3
