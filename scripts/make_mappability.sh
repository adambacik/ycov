#!/usr/bin/env bash
#
# make_mappability.sh
# Streams UCSC Hoffman k=150 mappability track for target chromosomes (chrY, chrX, chr19-22)
# and generates an indexed BigWig (mappability.bw).
#
# Strategy:
#   - Source: Official UCSC T2T-CHM13v2.0 Hoffman Mappability track (k=150):
#     https://hgdownload.soe.ucsc.edu/gbdb/hs1/hoffmanMappability/k150.Umap.MultiTrackMappability.bw
#   - bigWigToBedGraph streams remote HTTP byte-ranges without downloading the full 855 MB file.
#   - Converts extracted intervals back into an indexed BigWig: mappability.bw.
#
# Requirements:
#   - curl, bigWigToBedGraph, bedGraphToBigWig (UCSC userApps / bioconda: ucsc-bigwigtobedgraph, ucsc-bedgraphtobigwig)
#
# Usage:
#   bash make_mappability.sh [output_mappability.bw] [chrom.sizes]
#
# Example:
#   bash make_mappability.sh
#   bash make_mappability.sh ./mappability.bw
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

OUT="${1:-${SCRIPT_DIR}/mappability.bw}"
CHROM_SIZES="${2:-${SCRIPT_DIR}/hs1.chrom.sizes}"

# UCSC track URL (k=150 multi-track mappability for hs1)
UCSC_BW_URL="https://hgdownload.soe.ucsc.edu/gbdb/hs1/hoffmanMappability/k150.Umap.MultiTrackMappability.bw"
CHROM_SIZES_URL="https://hgdownload.soe.ucsc.edu/goldenPath/hs1/bigZips/hs1.chrom.sizes"

# Target chromosomes for ycov: chrY, chrX, and baseline autosomes (chr19-chr22)
TARGET_CHROMS=("chrY" "chrX" "chr19" "chr20" "chr21" "chr22")

# Check required tools
for tool in curl bigWigToBedGraph bedGraphToBigWig; do
    if ! command -v "$tool" &>/dev/null; then
        echo "Error: Required tool '$tool' not found."
        echo "Install via conda/mamba: conda install -c bioconda ucsc-$tool"
        exit 1
    fi
done

mkdir -p "$(dirname "${OUT}")"
TMP_DIR="$(mktemp -d -t mappability_XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT


if [[ ! -f "${CHROM_SIZES}" ]]; then
    echo "[1/4] Fetching hs1 chromosome sizes..."
    curl -fL -s -o "${CHROM_SIZES}" "${CHROM_SIZES_URL}"
else
    echo "[1/4] Chromosome sizes already present: ${CHROM_SIZES}"
fi

# Subset chrom.sizes to only target chromosomes
TARGET_SIZES="${TMP_DIR}/target.chrom.sizes"
for c in "${TARGET_CHROMS[@]}"; do
    awk -v chrom="$c" '$1 == chrom { print $1 "\t" $2 }' "${CHROM_SIZES}"
done > "${TARGET_SIZES}"


echo "[2/4] Streaming target chromosomes (${TARGET_CHROMS[*]}) from UCSC..."

# One chromosome at a time, appended into a single bedGraph
TMP_BG="${TMP_DIR}/target_mappability.bg"
: > "${TMP_BG}"

for c in "${TARGET_CHROMS[@]}"; do
    echo "  -> Streaming ${c}..."
    bigWigToBedGraph -chrom="${c}" "${UCSC_BW_URL}" "${TMP_DIR}/${c}.bg"
    cat "${TMP_DIR}/${c}.bg" >> "${TMP_BG}"
    rm -f "${TMP_DIR}/${c}.bg"
done


echo "[3/4] Converting extracted regions into indexed BigWig: ${OUT}..."

# bedGraphToBigWig needs the input sorted by chrom and start
LC_ALL=C sort -k1,1 -k2,2n "${TMP_BG}" > "${TMP_DIR}/sorted.bg"
bedGraphToBigWig "${TMP_DIR}/sorted.bg" "${TARGET_SIZES}" "${OUT}"


echo "[4/4] Done! Mappability BigWig written to: ${OUT} ($(du -h "${OUT}" | cut -f1))"
