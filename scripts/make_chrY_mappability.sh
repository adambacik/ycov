#!/usr/bin/env bash
#
# make_chrY_mappability.sh
# Extracts chrY mappability from full hs1 mappability and produces mappability_chrY.bw.
#
# Requirements:
#   - bigWigToBedGraph, bedGraphToBigWig (UCSC userApps / bioconda)
#
# Usage:
#   bash make_chrY_mappability.sh [input_mappability.bw] [output_chrY.bw] [chrom.sizes]
#
# Example:
#   bash make_chrY_mappability.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANNOT_DIR="${SCRIPT_DIR}/../src/ycov/annotations/chm13"

IN="${1:-${SCRIPT_DIR}/mappability.bw}"
OUT="${2:-${ANNOT_DIR}/mappability_chrY.bw}"
CHROM_SIZES="${3:-${SCRIPT_DIR}/hs1.chrom.sizes}"

for tool in bigWigToBedGraph bedGraphToBigWig; do
    if ! command -v "$tool" &>/dev/null; then
        echo "Error: Required tool '$tool' not found. Install from bioconda: conda install -c bioconda ucsc-$tool"
        exit 1
    fi
done

if [[ ! -f "${IN}" ]]; then
    echo "Error: Input BigWig not found at ${IN}. Run make_mappability.sh first."
    exit 1
fi

TMP_DIR="$(mktemp -d -t chry_map_XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "$(dirname "${OUT}")"

echo "[1/3] Extracting chrY from ${IN}..."
TMP_BG="${TMP_DIR}/chrY.bg"
bigWigToBedGraph -chrom=chrY "${IN}" "${TMP_BG}"

echo "[2/3] Preparing chrY chromosome sizes..."
CHR_Y_SIZES="${TMP_DIR}/chrY.chrom.sizes"
if [[ -f "${CHROM_SIZES}" ]]; then
    awk '$1 == "chrY" { print $1 "\t" $2 }' "${CHROM_SIZES}" > "${CHR_Y_SIZES}"
else
    # Default T2T-CHM13v2.0 chrY length
    echo -e "chrY\t62460029" > "${CHR_Y_SIZES}"
fi

echo "[3/3] Creating chrY-only BigWig: ${OUT}..."
bedGraphToBigWig "${TMP_BG}" "${CHR_Y_SIZES}" "${OUT}"

echo "Done! Output written to: ${OUT} ($(du -h "${OUT}" | cut -f1))"
