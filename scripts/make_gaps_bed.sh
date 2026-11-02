#!/usr/bin/env bash
#
# make_gaps_bed.sh
# Scans a reference FASTA file for N-runs (assembly gaps or hard-masked regions)
# and produces a 0-based BED4 file: <chrom> <start> <end> gap
#
# Strategy:
#   - Embedded Python streams the FASTA line by line (plain or gzipped), so the genome is never held in memory.
#   - A gap is any run of N/n, also when it spans several FASTA lines.
#
# Requirements:
#   - python3 (with standard library), column
#
# Usage:
#   bash make_gaps_bed.sh <reference.fasta[.gz]> [output_gaps.bed]
#
# Example:
#   bash make_gaps_bed.sh chm13v2.0.XY.fasta
#   bash make_gaps_bed.sh chm13v2.0.XY.fasta ../src/ycov/annotations/chm13/gaps.bed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANNOT_DIR="${SCRIPT_DIR}/../src/ycov/annotations/chm13"

FASTA="${1:-}"
OUT="${2:-${ANNOT_DIR}/gaps.bed}"

if [[ -z "${FASTA}" ]]; then
    echo "Usage: bash make_gaps_bed.sh <reference.fasta[.gz]> [output_gaps.bed]"
    exit 1
fi

mkdir -p "$(dirname "${OUT}")"

echo "[1/2] Scanning ${FASTA} for N-runs..."

python3 - "${FASTA}" "${OUT}" << 'EOF'
import sys
import gzip
import re

fasta_path, out_path = sys.argv[1], sys.argv[2]
opener = gzip.open if fasta_path.endswith('.gz') else open

with opener(fasta_path, 'rt') as f_in, open(out_path, 'w', encoding='utf-8') as f_out:
    chrom = None
    offset = 0
    in_gap = False
    gap_start = 0

    for line in f_in:
        line = line.rstrip('\r\n')
        if not line:
            continue
        if line.startswith('>'):
            if in_gap:
                f_out.write(f"{chrom}\t{gap_start}\t{offset}\tgap\n")
                in_gap = False
            chrom = line[1:].split()[0]
            offset = 0
            continue

        for match in re.finditer(r'[Nn]+|[^Nn]+', line):
            seg = match.group(0)
            if seg[0] in 'Nn':
                if not in_gap:
                    gap_start = offset
                    in_gap = True
            else:
                if in_gap:
                    f_out.write(f"{chrom}\t{gap_start}\t{offset}\tgap\n")
                    in_gap = False
            offset += len(seg)

    if in_gap:
        f_out.write(f"{chrom}\t{gap_start}\t{offset}\tgap\n")
EOF

echo "[2/2] Done! Gaps written to: ${OUT}"
column -t "${OUT}"
