#!/usr/bin/env bash
#
# make_test_data.sh
# Generates the full simulated datasets (if missing) and cuts small slices of them
# into tests/data/ (pytest, CI) and example_data/ (README tutorial).
#
# Strategy:
#   - Full data: runs simulate.py and simulate_reads.sh into WORK_DIR, only when their
#     truth.tsv is missing (FORCE=1 reruns both).
#   - Slices: tabix extracts the windows overlapping REGIONS from every chosen sample's
#     all-reads and MAPQ 20 coverage, so a slice is identical to the full file there.
#   - truth.tsv / metadata.tsv: rows of the chosen samples only; warns about truth events
#     that lie outside REGIONS.
#   - tests/data/ gets deliberate metadata errors (mislabelled sex, missing row, extra row)
#     and a tiny BAM across the AZFc start; example_data/ stays clean.
#
# Requirements:
#   - python3 with numpy, pandas (for simulate.py)
#   - bgzip, tabix, samtools, mosdepth, bedtools, awk
#
# Usage:
#   bash make_test_data.sh <reference.fasta> <sample.cram> [work_folder] [real_mosdepth_folder]
#
#   Environment: THREADS (default 4), SEED (default 42), FORCE=1 (rerun the simulations),
#                PYTHON (default: the project's .venv python, else python3)
#
# Example:
#   bash make_test_data.sh ~/ycov_data/chm13v2.0.XY.fasta ~/ycov_data/HG00096.subset.cram
#   bash make_test_data.sh ~/ycov_data/chm13v2.0.XY.fasta ~/ycov_data/HG00096.subset.cram /media/ext/ycov_work /media/ext/mosdepth
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANNOT_DIR="${REPO_DIR}/src/ycov/annotations/chm13"

FASTA="${1:?Usage: bash make_test_data.sh <reference.fasta> <sample.cram> [work_folder] [real_mosdepth_folder]}"
CRAM="${2:?Missing sample CRAM for simulate_reads.sh}"
WORK_DIR="${3:-${REPO_DIR}/data/test_data_work}"
REAL_DIR="${4:-}"
THREADS="${THREADS:-4}"
SEED="${SEED:-42}"
FORCE="${FORCE:-0}"

if [[ -z "${PYTHON:-}" ]]; then
    if [[ -x "${REPO_DIR}/.venv/bin/python" ]]; then
        PYTHON="${REPO_DIR}/.venv/bin/python"
    else
        PYTHON="python3"
    fi
fi

SIM_DIR="${WORK_DIR}/sim"
READS_DIR="${WORK_DIR}/sim_reads"
TESTS_DIR="${REPO_DIR}/tests/data"
EXAMPLE_DIR="${REPO_DIR}/example_data"

# Kept slices (0-based BED, in .fai order: chr21, chrX, chrY).
#   chrY: all of AZFc, end of AZFb, the partial AZFc interval, X-DEG, DYZ19, AMPL, OTHER, start of HET
#   chrX: outside the PARs, for X ratio and sex check
#   chr21: autosomal baseline
REGIONS=(
    "chr21 20000000 25000000"
    "chrX 10000000 15000000"
    "chrY 20000000 28000000"
)

# Samples per destination (their events must lie inside REGIONS; S07 = AZFa does not)
TESTS_SAMPLES="S01,S02,S03,S04"
EXAMPLE_SAMPLES="S01,S02,S03,S04,S05,S06,S08,S09,S10,S11"

# Deliberate metadata errors, tests/data/ only (sex check, FR30)
TEST_MISLABELLED="S04"   # female written as reported_sex M
TEST_NO_METADATA="S03"   # sample without a metadata row
TEST_EXTRA_ROW="S99"     # metadata row without a sample

# Tiny BAM for the mosdepth runner tests: this many bp on each side of the AZFc start
TINY_BAM_FLANK=50000

for f in "${FASTA}" "${FASTA}.fai" "${CRAM}" "${CRAM}.crai"; do
    if [[ ! -f "${f}" ]]; then
        echo "Error: ${f} not found"
        exit 1
    fi
done
if [[ -n "${REAL_DIR}" && ! -d "${REAL_DIR}" ]]; then
    echo "Error: real mosdepth folder ${REAL_DIR} not found"
    exit 1
fi

for tool in bgzip tabix samtools mosdepth bedtools awk "${PYTHON}"; do
    if ! command -v "${tool}" &>/dev/null; then
        echo "Error: Required tool '${tool}' not found."
        exit 1
    fi
done

mkdir -p "${WORK_DIR}"
TMP_DIR="$(mktemp -d -p "${WORK_DIR}" test_data_XXXXXX)"
trap 'rm -rf "${TMP_DIR}"' EXIT

REGIONS_BED="${TMP_DIR}/keep.bed"
printf '%s\n' "${REGIONS[@]}" | tr ' ' '\t' > "${REGIONS_BED}"

# Cut <in.regions.bed.gz> to REGIONS into <out.regions.bed.gz> + .csi
slice_coverage() {
    local in="$1" out="$2"
    tabix -R "${REGIONS_BED}" "${in}" | bgzip -c > "${out}"
    tabix -f -C -p bed "${out}"
}

# Copy the header + rows of <in.tsv> whose sample_id (column 1) is in the comma list <samples>
filter_samples() {
    local in="$1" out="$2" samples="$3"
    awk -F'\t' -v keep="${samples}" '
        BEGIN { n = split(keep, ids, ","); for (i = 1; i <= n; i++) wanted[ids[i]] = 1 }
        NR == 1 || ($1 in wanted)
    ' "${in}" > "${out}"
}

# Warn about truth rows with coordinates (start != ".") that overlap none of REGIONS
check_truth() {
    local truth="$1"
    awk -F'\t' '
        NR == FNR { chrom[NR] = $1; from[NR] = $2 + 0; to[NR] = $3 + 0; n = NR; next }
        FNR > 1 && $10 != "." {
            inside = 0
            for (i = 1; i <= n; i++)
                if (chrom[i] == $9 && $10 + 0 < to[i] && $11 + 0 > from[i]) inside = 1
            if (!inside) printf "  Warning: %s %s %s:%s-%s is outside the kept regions\n", $1, $7, $9, $10, $11
        }
    ' "${REGIONS_BED}" "${truth}"
}

# Slice both coverage files (all reads + .q20) of every sample in <samples> from <src> into <dest>
slice_samples() {
    local src="$1" dest="$2" samples="$3"
    local id suffix
    for id in ${samples//,/ }; do
        for suffix in "" ".q20"; do
            slice_coverage "${src}/${id}${suffix}.regions.bed.gz" "${dest}/${id}${suffix}.regions.bed.gz"
        done
    done
}

# Remove coverage slices from an earlier run, so dropped samples do not stay behind
clean_coverage() {
    rm -f "$1"/*.regions.bed.gz "$1"/*.regions.bed.gz.csi
}


echo "[1/5] Simulating coverage (simulate.py)..."

if [[ "${FORCE}" == "1" || ! -f "${SIM_DIR}/truth.tsv" ]]; then
    "${PYTHON}" "${SCRIPT_DIR}/simulate.py" \
        "${FASTA}" \
        "${ANNOT_DIR}/sequence_classes.bed" \
        "${ANNOT_DIR}/gaps.bed" \
        "${ANNOT_DIR}/regions.bed" \
        --outdir "${SIM_DIR}" --seed "${SEED}"
else
    echo "  Reusing existing ${SIM_DIR} (FORCE=1 to regenerate)"
fi


echo "[2/5] Simulating reads (simulate_reads.sh)..."

if [[ "${FORCE}" == "1" || ! -f "${READS_DIR}/truth.tsv" ]]; then
    THREADS="${THREADS}" SEED="${SEED}" bash "${SCRIPT_DIR}/simulate_reads.sh" \
        "${CRAM}" "${FASTA}" "${ANNOT_DIR}/regions.bed" "${READS_DIR}"
else
    echo "  Reusing existing ${READS_DIR} (FORCE=1 to regenerate)"
fi


echo "[3/5] Writing tests/data/..."

mkdir -p "${TESTS_DIR}/sim" "${TESTS_DIR}/reads"
clean_coverage "${TESTS_DIR}/sim"
slice_samples "${SIM_DIR}" "${TESTS_DIR}/sim" "${TESTS_SAMPLES}"

filter_samples "${SIM_DIR}/truth.tsv" "${TESTS_DIR}/truth.tsv" "${TESTS_SAMPLES}"
check_truth "${TESTS_DIR}/truth.tsv"

# Metadata with the deliberate errors: mislabelled sex, one missing row, one extra row
filter_samples "${SIM_DIR}/metadata.tsv" "${TMP_DIR}/metadata.tsv" "${TESTS_SAMPLES}"
awk -F'\t' -v OFS='\t' -v bad_sex="${TEST_MISLABELLED}" -v no_row="${TEST_NO_METADATA}" '
    NR > 1 && $1 == no_row { next }
    NR > 1 && $1 == bad_sex { $2 = "M" }
    { print }
' "${TMP_DIR}/metadata.tsv" > "${TESTS_DIR}/metadata.tsv"
printf '%s\tM\tSIM_A\t50\tfertile\n' "${TEST_EXTRA_ROW}" >> "${TESTS_DIR}/metadata.tsv"

# Tiny BAM across the AZFc start of the read-level deletion: normal depth, then ~0
AZFC_DEL_CRAM="$(find "${READS_DIR}" -maxdepth 1 -name '*_azfc_del.cram' | head -n 1)"
if [[ -z "${AZFC_DEL_CRAM}" ]]; then
    echo "Error: no *_azfc_del.cram in ${READS_DIR}"
    exit 1
fi
AZFC_START="$(awk '$1 == "chrY" && $4 == "AZFc" {print $2}' "${ANNOT_DIR}/regions.bed")"
TINY_REGION="chrY:$((AZFC_START - TINY_BAM_FLANK + 1))-$((AZFC_START + TINY_BAM_FLANK))"
TINY_ID="$(basename "${AZFC_DEL_CRAM}" .cram)"

samtools view -@ "${THREADS}" -b -T "${FASTA}" -o "${TESTS_DIR}/reads/${TINY_ID}.bam" "${AZFC_DEL_CRAM}" "${TINY_REGION}"
samtools index "${TESTS_DIR}/reads/${TINY_ID}.bam"
filter_samples "${READS_DIR}/truth.tsv" "${TESTS_DIR}/reads/truth.tsv" "${TINY_ID}"
echo "  Tiny BAM: ${TINY_ID}.bam (${TINY_REGION})"


echo "[4/5] Writing example_data/..."

mkdir -p "${EXAMPLE_DIR}/simulated" "${EXAMPLE_DIR}/simulated_reads" "${EXAMPLE_DIR}/real"

clean_coverage "${EXAMPLE_DIR}/simulated"
slice_samples "${SIM_DIR}" "${EXAMPLE_DIR}/simulated" "${EXAMPLE_SAMPLES}"
filter_samples "${SIM_DIR}/truth.tsv" "${EXAMPLE_DIR}/simulated/truth.tsv" "${EXAMPLE_SAMPLES}"
filter_samples "${SIM_DIR}/metadata.tsv" "${EXAMPLE_DIR}/simulated/metadata.tsv" "${EXAMPLE_SAMPLES}"
check_truth "${EXAMPLE_DIR}/simulated/truth.tsv"

# Read-level coverage: original, azfc_del and mloy50, all reads + .q20
clean_coverage "${EXAMPLE_DIR}/simulated_reads"
while IFS= read -r cov; do
    slice_coverage "${cov}" "${EXAMPLE_DIR}/simulated_reads/$(basename "${cov}")"
done < <(find "${READS_DIR}/mosdepth" -name '*.regions.bed.gz' | sort)
cp "${READS_DIR}/truth.tsv" "${EXAMPLE_DIR}/simulated_reads/truth.tsv"
check_truth "${EXAMPLE_DIR}/simulated_reads/truth.tsv"

# Real 1KGP mosdepth output, only cut (optional)
if [[ -n "${REAL_DIR}" ]]; then
    clean_coverage "${EXAMPLE_DIR}/real"
    while IFS= read -r cov; do
        slice_coverage "${cov}" "${EXAMPLE_DIR}/real/$(basename "${cov}")"
    done < <(find "${REAL_DIR}" -name '*.regions.bed.gz' | sort)
else
    echo "  No real mosdepth folder given, example_data/real/ left unchanged"
fi


echo "[5/5] Done! Test data written to:"
echo "  ${TESTS_DIR} ($(du -sh "${TESTS_DIR}" | cut -f1))"
echo "  ${EXAMPLE_DIR} ($(du -sh "${EXAMPLE_DIR}" | cut -f1))"
