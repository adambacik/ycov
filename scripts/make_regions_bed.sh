#!/usr/bin/env bash
#
# make_regions_bed.sh
# Combines PAR1, PAR2, and AZFa/b/c into a 0-based BED4 file on T2T-CHM13v2.0 coordinates.
#
# Strategy:
#   - PAR1 & PAR2: Extracted from sequence_classes.bed (Rhie et al. 2023)
#   - AZFa, AZFb, AZFc: Official T2T Consortium curated coordinates from MARBL
#
# Usage:
#   bash make_regions_bed.sh [output_regions.bed] [input_sequence_classes.bed]
#
# Example:
#   bash make_regions_bed.sh
#   bash make_regions_bed.sh ../src/ycov/annotations/chm13/regions.bed
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANNOT_DIR="${SCRIPT_DIR}/../src/ycov/annotations/chm13"

OUT="${1:-${ANNOT_DIR}/regions.bed}"
CLASSES_BED="${2:-${ANNOT_DIR}/sequence_classes.bed}"
TMP_DIR="$(mktemp -d -t regions_XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT

mkdir -p "$(dirname "${OUT}")"

if [[ ! -f "${CLASSES_BED}" ]]; then
    echo "Error: sequence_classes.bed not found at ${CLASSES_BED}"
    echo "Run extract_class_annotations.py first."
    exit 1
fi

T2T_AZF_BED="${TMP_DIR}/chm13v2.0Y_AZF_DYZ_v1.bed"
T2T_AZF_URL="https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/CHM13/assemblies/annotation/chm13v2.0Y_AZF_DYZ_v1.bed"

echo "[1/3] Fetching official T2T AZF coordinates..."
curl -fL -s -o "${T2T_AZF_BED}" "${T2T_AZF_URL}"

echo "[2/3] Extracting PAR1/2 and AZFa/b/c..."
{
    # PAR1 and PAR2 from sequence_classes.bed (strip \r for CRLF safety)
    awk '{ sub(/\r$/, ""); if ($4 == "PAR1" || $4 == "PAR2") print $1 "\t" $2 "\t" $3 "\t" $4 }' "${CLASSES_BED}"

    # AZFa, AZFb, AZFc from official T2T annotation
    awk '{ sub(/\r$/, ""); if ($4 ~ /^AZF/) print $1 "\t" $2 "\t" $3 "\t" $4 }' "${T2T_AZF_BED}"
} | sort -k1,1 -k2,2n > "${OUT}"

echo "[3/3] Done! regions.bed written to: ${OUT}"
echo ""
column -t "${OUT}"
