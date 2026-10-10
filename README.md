# ycov

An interactive tool for inspecting and comparing coverage of the human Y chromosome across many samples.

> **Status:** early development, bachelor thesis project at Masaryk University. Nothing is usable yet; the commands below describe the planned interface.

Sequencing coverage shows which parts of chrY are present, partially lost or missing in each genome. Generic genome browsers show one sample at a time and do not know about the Y chromosome's structure. ycov puts many samples side by side, annotated with chrY sequence classes, and helps separate real loss of DNA from mapping artefacts.

## Features

- **Cohort overview:** heatmap of all samples across the whole chrY, aligned with a sequence-class bar (PAR, X-transposed, X-degenerate, ampliconic, palindromes, heterochromatin).
- **Navigation:** zoom and pan, jump to a coordinate, gene, sequence class or AZF region. Read view with igv.js when zoomed in.
- **Normalisation modes:** raw depth, relative copy number (autosomal baseline), Y-internal (XDR) and cohort-relative.
- **Real loss vs artefact:** switch between all reads and MAPQ-filtered reads, with reliability marks for low-mappability, ampliconic and PAR windows.
- **Automatic flags:** deletion candidates, loss of known regions (AZFa/b/c), possible mosaic loss of Y, sex check, outlier samples.
- **Metadata:** filter, group and sort samples by population, age, phenotype or any other column.
- **Export:** figures (PNG/SVG/PDF), tables (CSV/TSV) and flagged regions (BED).

## Usage (planned)

ycov works in two steps. `prepare` does the heavy processing once; `view` opens the results in the browser.

```bash
# 1. compute, normalise and annotate coverage, write a project folder
ycov prepare data/*.cram --fasta CHM13.fa --metadata samples.csv -o my_project/

# 2. open the interactive interface at http://127.0.0.1:8765
ycov view my_project/
```

### Inputs

| Input | Format | Required |
| --- | --- | --- |
| aligned reads | BAM / CRAM with `.bai` / `.crai` | one of these two |
| precomputed coverage | bedGraph, bigWig, mosdepth output | one of these two |
| reference sequence | FASTA + `.fai` | for CRAM only |
| sample metadata | CSV / TSV with a `sample_id` column | no |

Sequence classes, AZF regions, genes and mappability are bundled for each supported reference build.

**Supported reference:** T2T-CHM13v2.0 (GRCh38 planned).

### Normalisation

| Mode | Formula | Meaning |
| --- | --- | --- |
| raw depth | `d(w)` | mean read depth of window `w` |
| relative copy (default) | `d(w) / (B / 2)` | `B` = median autosomal depth; 1.0 = one copy |
| Y-internal | `d(w) / median d(reliable XDR)` | relative to the sample's own single-copy chrY |
| cohort-relative | `RC(w) / median over samples RC(w)` | removes biases shared by all samples (needs ≥ 5 samples) |

Every value is computed from all reads and from reads with MAPQ ≥ 20.

## Development

Requirements: Python ≥ 3.11, [uv](https://docs.astral.sh/uv/), Node.js ≥ 22.

```bash
git clone https://github.com/adambacik/ycov.git
cd ycov
uv sync                       # backend dependencies
uv run pytest                 # backend tests
cd web && npm install && npm run dev   # frontend dev server
```

**Stack:** Python (Typer, FastAPI, polars, pysam, mosdepth) for processing and the server; TypeScript (React, Vite, Plotly.js, igv.js) for the interface.

```
src/ycov/      Python package (cli, coverage, windows, analysis, validate, project, server, annotations)
web/           TypeScript frontend
tests/         automated tests
example_data/  small simulated dataset for the tutorial
docs/          user documentation
```

## Intended use

ycov is a research tool, not a clinical diagnostic tool. Flags are hints for closer inspection, not diagnoses.

## License

[MIT](LICENSE)
