#!/usr/bin/env bash
#
# make_genes_gtf.sh
# Downloads UCSC T2T-CHM13v2.0 gene annotations and filters to chrX and chrY.
#
# Strategy:
#   - Source: UCSC hs1 catLiftOffGenesV1.gtf.gz (GENCODE v35 / Liftoff models).
#   - Filter header lines + chrX and chrY records.
#
# Requirements:
#   - curl, gzip, awk
#
# Usage:
#   bash make_genes_gtf.sh [output_genes.gtf.gz]
#
# Example:
#   bash make_genes_gtf.sh
#   bash make_genes_gtf.sh ../src/ycov/annotations/chm13/genes.gtf.gz
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANNOT_DIR="${SCRIPT_DIR}/../src/ycov/annotations/chm13"
OUT="${1:-${ANNOT_DIR}/genes.gtf.gz}"

mkdir -p "$(dirname "${OUT}")"

T2T_GENES_URL="https://hgdownload.soe.ucsc.edu/hubs/GCA/009/914/755/GCA_009914755.4/genes/catLiftOffGenesV1.gtf.gz"

echo "[1/2] Streaming & filtering chrX and chrY gene annotations from UCSC..."
curl -fL --retry 3 "${T2T_GENES_URL}" \
    | gzip -dc \
    | awk '$1 ~ /^#/ || $1 == "chrX" || $1 == "chrY"' \
    | gzip -c > "${OUT}"

echo "[2/2] Done! genes.gtf.gz written to: ${OUT}"
echo "Size: $(du -h "${OUT}" | cut -f1)"
