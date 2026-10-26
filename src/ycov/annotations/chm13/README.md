# Reference Annotations: T2T-CHM13v2.0 (hs1)

This directory contains bundled reference annotations for the human **T2T-CHM13v2.0** genome assembly (focusing on `chrY` and `chrX`) used by `ycov` for window binning, sequence-class attribution, normalisation, and quality metrics.

- **Assembly**: T2T-CHM13v2.0 (`hs1`)
- **GenBank Accession**: GCA_009914755.4
- **chrY Accession**: CP086569.2 (length: 62,460,029 bp)
- **chrX Accession**: CP068255.2 (length: 154,259,566 bp)
- **Coordinate System**: 0-based, half-open `[start, end)` (standard BED format per NFR10)

---

## Bundled Files Overview

| File | Format | Records / Size | MD5 Checksum | Description |
| :--- | :--- | :--- | :--- | :--- |
| `sequence_classes.bed` | BED4 | 27 intervals | `730f30dc4a52f71438f10b744375eb5b` | Detailed structural sequence classes on chrY |
| `regions.bed` | BED4 | 5 intervals | `9c9029cd26790e58c107558871c6f8b8` | PAR1, PAR2, and AZFa/b/c boundaries |
| `genes.gtf.gz` | GTF (gzip) | ~646 KB | `6c9696497eec6f26996a375870a6c047` | Ensembl / GENCODE gene models on chrY and chrX |
| `gaps.bed` | BED4 | 2 intervals | `4a9fd727bc43f97d15e83b43c15fcf19` | Hard-masked N-runs / assembly gap coordinates |
| `mappability_chrY.bw` | BigWig | ~35.7 MB | `b5e0660fa07d3378537055f9130d8fe4` | Multi-track mappability score track for chrY (k=150) |

---

## Provenance & Reproduction Commands

### 1. `sequence_classes.bed`
- **Purpose**: Annotates chrY windows with their sequence class (PAR1, PAR2, X-DEG, XTR1, XTR2, AMPL, SAT, CEN, DYZ17, DYZ19, HET, OTHER).
- **Source**: Rhie et al. (2023) *The complete sequence of a human Y chromosome*, Nature 621, 344–354. [DOI: 10.1038/s41586-023-06457-y](https://doi.org/10.1038/s41586-023-06457-y). Supplementary Table 21 (`41586_2023_6457_MOESM4_ESM.xlsx`).
- **Generation Command**:
  ```bash
  python scripts/extract_class_annotations.py
  ```
- **Notes**: Extracted chrY records using the detailed `class` column and converted to 0-based BED4 format.

---

### 2. `regions.bed`
- **Purpose**: Defines regions of clinical interest (AZFa, AZFb, AZFc) and boundary regions (PAR1, PAR2) for summary statistics and automatic deletion flagging.
- **Source**:
  - **PAR1 & PAR2**: Rhie et al. (2023) Supplementary Table 21 (via `sequence_classes.bed`).
  - **AZFa, AZFb, AZFc**: Official T2T Consortium / MARBL curated coordinates from [`chm13v2.0Y_AZF_DYZ_v1.bed`](https://s3-us-west-2.amazonaws.com/human-pangenomics/T2T/CHM13/assemblies/annotation/chm13v2.0Y_AZF_DYZ_v1.bed).
- **Generation Command**:
  ```bash
  bash scripts/make_regions_bed.sh
  ```
- **Coordinates (T2T-CHM13v2.0)**:
  - `PAR1`: `chrY:0-2458320`
  - `AZFa`: `chrY:13228406-14019819` (~791.41 kb)
  - `AZFb`: `chrY:18730346-26490936` (~7760.59 kb)
  - `AZFc`: `chrY:23327301-27020249` (~3692.95 kb)
  - `PAR2`: `chrY:62122809-62460029`

---

### 3. `genes.gtf.gz`
- **Purpose**: Gene coordinate track for navigation, search, and detail view in the viewer.
- **Source**: UCSC Genome Browser `hs1` Assembly Hub – CAT/Liftoff GENCODE v35 / v38 annotations:
  [`catLiftOffGenesV1.gtf.gz`](https://hgdownload.soe.ucsc.edu/hubs/GCA/009/914/755/GCA_009914755.4/genes/catLiftOffGenesV1.gtf.gz).
- **Generation Command**:
  ```bash
  bash scripts/make_genes_gtf.sh
  ```
- **Notes**: Stream-decompressed and filtered strictly to header rows and features on `chrX` and `chrY`.

---

### 4. `gaps.bed`
- **Purpose**: Flags windows covering unsequenced assembly gaps or reference-masked stretches.
- **Source**: Scanned directly from reference FASTA (`chm13v2.0.XY.fasta` / `chm13v2.0.fasta`).
- **Generation Command**:
  ```bash
  bash scripts/make_gaps_bed.sh path/to/chm13v2.0.XY.fasta gaps.bed
  ```
- **Notes**: Continuous runs of `N`/`n` bases written to standard BED4 (`<chrom> <start> <end> gap`).

---

### 5. `mappability_chrY.bw`
- **Purpose**: Annotates 1 kb windows with their mean mappability score to identify reliable vs. unreliable windows.
- **Source**: Official UCSC Genome Browser `hs1` multi-track Hoffman mappability track (k=150):
  [`k150.Umap.MultiTrackMappability.bw`](https://hgdownload.soe.ucsc.edu/gbdb/hs1/hoffmanMappability/k150.Umap.MultiTrackMappability.bw).
- **Generation Commands**:
  ```bash
  bash scripts/make_mappability.sh
  bash scripts/make_chrY_mappability.sh
  ```
- **Notes**: Extracted using `bigWigToBedGraph` filtered to `chrY` and rebuilt into a compact BigWig using `bedGraphToBigWig` against `hs1.chrom.sizes`.
