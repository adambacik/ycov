#!/usr/bin/env bash
#
# simulate_reads.sh
# Simulates CRAM files with mosaic loss 50 % and AZFc region deletion
#
# Strategy:
#   - AZFc deletion: reads overlapping AZFc (from regions.bed) removed with samtools view -L, using the complement BED
#   - mLOY: chrY reads split off, subsampled to 50% (SEED), merged back with the rest
#   - mosdepth (1 kb, all reads + MAPQ 20) on the original and both copies, plus truth.tsv
#
# Requirements:
#   - mosdepth, awk, bedtools, samtools
#
# Usage:
#   bash simulate_reads.sh <sample.cram> <reference.fasta> [regions.bed] [output_folder]
#
# Example:
#   bash simulate_reads.sh ~/ycov_data/HG00096.subset.cram ~/ycov_data/chm13v2.0.XY.fasta
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANNOT_DIR="${SCRIPT_DIR}/../src/ycov/annotations/chm13"

CRAM="${1:?Usage: bash simulate_reads.sh <sample.cram> <reference.fasta> [regions.bed] [output_folder]}"
FASTA="${2:?Missing reference FASTA}"
REGIONS_BED="${3:-${ANNOT_DIR}/regions.bed}"
OUT="${4:-./sim_reads}"
THREADS="${THREADS:-4}"
SEED="${SEED:-42}"

for f in "${CRAM}" "${CRAM}.crai" "${FASTA}" "${FASTA}.fai" "${REGIONS_BED}"; do
    if [[ ! -f "${f}" ]]; then
        echo "Error: ${f} not found"
        exit 1
    fi
done

# Sample name from the SM tag (ycov reads it from there), must be one unique value
SAMPLE="$(samtools view -H "${CRAM}" \
    | awk -F'\t' '$1 == "@RG" {for (i = 2; i <= NF; i++) if ($i ~ /^SM:/) print substr($i, 4)}' \
    | sort -u)"
if [[ -z "${SAMPLE}" || "$(wc -l <<< "${SAMPLE}")" -ne 1 ]]; then
    echo "Error: expected exactly one SM tag in the @RG lines of ${CRAM}, found: ${SAMPLE:-none}"
    exit 1
fi
COV_DIR="${OUT}/mosdepth/${SAMPLE}"

mkdir -p "${OUT}"
TMP_DIR="$(mktemp -d -p "${OUT}" sim_reads_XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT

# Copy <in.cram> to <out.cram> with SM in every @RG line renamed to <new_sm>, then index it
rename_sample() {
    local in="$1" out="$2" new_sm="$3"
    local header="${TMP_DIR}/header.sam"
    samtools view -H "${in}" \
        | awk -F'\t' -v OFS='\t' -v sm="${new_sm}" '$1 == "@RG" {for (i = 2; i <= NF; i++) if ($i ~ /^SM:/) $i = "SM:" sm} {print}' \
        > "${header}"
    samtools reheader "${header}" "${in}" > "${out}"
    samtools index -@ "${THREADS}" "${out}"
}


echo "[1/5] Simulating AZFc deletion..."

AZFC_BED="${TMP_DIR}/azfc.bed"
GENOME="${TMP_DIR}/genome.txt"
KEEP_BED="${TMP_DIR}/keep.bed"
AZFC_CRAM="${OUT}/${SAMPLE}_azfc_del.cram"

# Pick AZFc row from regions and check the output
awk -v OFS='\t' '$1 == "chrY" && $4 == "AZFc"' "${REGIONS_BED}" > "${AZFC_BED}"
if [[ "$(wc -l < "${AZFC_BED}")" -ne 1 ]]; then
    echo "Expected one AZFc region line in ${REGIONS_BED}"
    exit 1
fi

# Create genome txt with chromosome names and lengths + create complement of everything except AZFc region
cut -f1,2 "${FASTA}.fai" > "${GENOME}"
bedtools complement -i "${AZFC_BED}" -g "${GENOME}" > "${KEEP_BED}"

# Write reads that overlap kept regions, rename the sample + make index
samtools view -@ "${THREADS}" -C -T "${FASTA}" -L "${KEEP_BED}" -o "${TMP_DIR}/azfc_del.cram" "${CRAM}"
rename_sample "${TMP_DIR}/azfc_del.cram" "${AZFC_CRAM}" "${SAMPLE}_azfc_del"


echo "[2/5] Simulating mLOY 50 % loss..."

MLOY_CRAM="${OUT}/${SAMPLE}_mloy50.cram"
CHRY_PART="${TMP_DIR}/chrYcram.cram"
REST_PART="${TMP_DIR}/restcram.cram"
CHRY_SUB="${TMP_DIR}/chrYsub.cram"
REST_BED="${TMP_DIR}/rest.bed"

# Pick all chromosomes except chrY into bed
awk -v OFS='\t' '$1 != "chrY" {print $1, 0, $2}' "${FASTA}.fai" > "${REST_BED}"

# Write rest and chrY crams from beds
samtools view -@ "${THREADS}" -C -T "${FASTA}" -L "${REST_BED}" -o "${REST_PART}" "${CRAM}"
samtools view -@ "${THREADS}" -C -T "${FASTA}" -o "${CHRY_PART}" "${CRAM}" chrY

# Downsample chrY reads
samtools view -@ "${THREADS}" -C -T "${FASTA}" -s "${SEED}".5 "${CHRY_PART}" -o "${CHRY_SUB}"

# Merge crams into one, rename the sample + make index
samtools merge -@ "${THREADS}" -O CRAM --reference "${FASTA}" -o "${TMP_DIR}/mloy50.cram" "${REST_PART}" "${CHRY_SUB}"
rename_sample "${TMP_DIR}/mloy50.cram" "${MLOY_CRAM}" "${SAMPLE}_mloy50"


echo "[3/5] Running mosdepth..."

mkdir -p "${COV_DIR}/original"
mosdepth --no-per-base --threads "${THREADS}" --fasta "${FASTA}" --by 1000 "${COV_DIR}/original/${SAMPLE}" "${CRAM}"
mosdepth --no-per-base --threads "${THREADS}" --mapq 20 --fasta "${FASTA}" --by 1000 "${COV_DIR}/original/${SAMPLE}.q20" "${CRAM}"

mkdir -p "${COV_DIR}/azfc_del"
mosdepth --no-per-base --threads "${THREADS}" --fasta "${FASTA}" --by 1000 "${COV_DIR}/azfc_del/${SAMPLE}_azfc_del" "${AZFC_CRAM}"
mosdepth --no-per-base --threads "${THREADS}" --mapq 20 --fasta "${FASTA}" --by 1000 "${COV_DIR}/azfc_del/${SAMPLE}_azfc_del.q20" "${AZFC_CRAM}"

mkdir -p "${COV_DIR}/mloy50"
mosdepth --no-per-base --threads "${THREADS}" --fasta "${FASTA}" --by 1000 "${COV_DIR}/mloy50/${SAMPLE}_mloy50" "${MLOY_CRAM}"
mosdepth --no-per-base --threads "${THREADS}" --mapq 20 --fasta "${FASTA}" --by 1000 "${COV_DIR}/mloy50/${SAMPLE}_mloy50.q20" "${MLOY_CRAM}"


echo "[4/5] Writing truth.tsv..."

TRUTH="${OUT}/truth.tsv"

# AZFc coordinates exactly as used for the deletion
read -r _ AZFC_START AZFC_END _ < "${AZFC_BED}"

# Measured fraction of chrY reads kept
chry_reads() { samtools idxstats "$1" | awk '$1 == "chrY" {print $3}'; }
ORIG_Y="$(chry_reads "${CRAM}")"
MLOY_Y="$(chry_reads "${MLOY_CRAM}")"
MLOY_FRAC="$(awk -v a="${MLOY_Y}" -v b="${ORIG_Y}" 'BEGIN {printf "%.3f", a / b}')"

# Same columns as truth.tsv from simulate.py; "." = no value
{
    printf 'sample_id\tscenario\tsex\tdepth\tx_copies\ty_copies\tevent\tregion\tchrom\tstart\tend\texpected_rel_copy\n'
    printf '%s\tnormal_male\tM\t.\t1.0\t1.0\tnone\t.\t.\t.\t.\t1.0\n' "${SAMPLE}"
    printf '%s_azfc_del\tazfc_del\tM\t.\t1.0\t1.0\tdeletion\tAZFc\tchrY\t%s\t%s\t0.0\n' "${SAMPLE}" "${AZFC_START}" "${AZFC_END}"
    printf '%s_mloy50\tmloy_50\tM\t.\t1.0\t%s\tmloy\t.\tchrY\t.\t.\t%s\n' "${SAMPLE}" "${MLOY_FRAC}" "${MLOY_FRAC}"
} > "${TRUTH}"

echo "chrY reads kept in mLOY: ${MLOY_Y} / ${ORIG_Y} (${MLOY_FRAC})"


echo "[5/5] Done! Simulated reads written to: ${OUT}"
