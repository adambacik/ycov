# ycov

An interactive tool for inspecting and comparing coverage of the human Y chromosome across many samples.

> **Status:** v0.1.0, first prototype. This is a bachelor thesis project at Masaryk University.
> `ycov prepare` turns mosdepth or bedGraph coverage into a project folder. `ycov view` shows it
> in the browser: many samples side by side along chrY, with its sequence classes. The analysis
> features below are [planned](#planned).

Sequencing coverage shows which parts of chrY are present, partially lost or missing in each genome. Generic genome browsers show one sample at a time and do not know about the Y chromosome's structure. ycov puts many samples side by side, annotated with chrY sequence classes, and helps separate real loss of DNA from mapping artefacts.

## Quick start

Requirements: Python ≥ 3.11, [uv](https://docs.astral.sh/uv/), Node.js ≥ 22.

```bash
git clone https://github.com/adambacik/ycov.git
cd ycov
uv sync                                     # Python package and dependencies
cd web && npm install && npm run build && cd ..   # frontend → web/dist

# 1. read coverage, annotate and normalise it, write a project folder
uv run ycov prepare example_data/simulated/S??.regions.bed.gz -o /tmp/ycov_sim

# 2. open it in the browser at http://127.0.0.1:8000
uv run ycov view /tmp/ycov_sim
```

`example_data/` has 11 simulated samples with a known answer (deletions of AZFa/b/c, mosaic
loss of Y, a female, XYY and others) and real 1000 Genomes samples. See
[example_data/README.md](example_data/README.md). The glob `S??.regions.bed.gz` leaves out the
`.q20` files: MAPQ-filtered input is not read yet.

`ycov view` serves the frontend from `web/dist` of this checkout. Without a build it serves only
the API and a page that says how to build the frontend. Run `ycov view --help` for the port and
`--no-browser`.

## What v0.1.0 does

**`ycov prepare FILES... -o PROJECT`**

1. Checks every file and the output folder. The sample ID is the file name up to the first dot,
   so `HG00096.regions.bed.gz` becomes `HG00096`.
2. Builds the 1 kb windows of chrY and annotates each with its sequence class. A window is
   marked unreliable if it lies in a gap or a PAR.
3. Reads the coverage of chrY and of the baseline autosomes chr19–chr22.
4. Computes a baseline per sample: the median autosomal depth. For each reliable chrY window it
   then computes the relative copy number `depth / (baseline / 2)`, so 1 means one copy.
5. Writes the project folder: `manifest.json`, `windows.parquet` and
   `coverage/coverage_1kb.parquet`.

**`ycov view PROJECT`** starts a local server on 127.0.0.1 only and opens the browser. The page
shows:

- **Overview:** the whole chrY, with named regions (PAR1/2, AZFa/b/c) and the sequence-class
  bar.
- **Coverage plots:** one relative copy plot per sample, at 10 kb bins. PARs and gaps are
  marked.
- **Navigation:** drag the viewport box in the overview or the track header, zoom −/+, move
  ←/→, Reset, or type coordinates such as `chrY:20,000,000-26,000,000`.
- **Sample list:** show or hide samples.

Details of the interface: [web/README.md](web/README.md).

### Inputs

| Input | Format | Now |
| --- | --- | --- |
| precomputed coverage | mosdepth `--by 1000` `.regions.bed.gz`, or bedGraph (`.bedgraph`, `.bg`, optionally `.gz`) on the 1 kb grid; must contain chrY and chr19–chr22 | yes |
| aligned reads | BAM / CRAM with `.bai` / `.crai` | planned |
| reference sequence | FASTA + `.fai` (for CRAM) | planned |
| sample metadata | CSV / TSV with a `sample_id` column | planned |

Sequence classes, AZF regions, genes, gaps and mappability are bundled for each supported
reference build in `src/ycov/annotations/`.

**Supported reference:** T2T-CHM13v2.0 (GRCh38 planned).

## Planned

- **Cohort overview:** heatmap of all samples across the whole chrY, aligned with the sequence-class bar.
- **Navigation:** 1 kb resolution when zoomed in, scroll to zoom, jump to a gene, sequence class or AZF region, read view with igv.js.
- **Normalisation modes:** besides relative copy (v0.1.0), also raw depth and Y-internal (XDR).
- **Real loss vs artefact:** switch between all reads and MAPQ-filtered reads, with reliability marks for low-mappability, ampliconic and PAR windows.
- **Automatic flags:** deletion candidates, loss of known regions (AZFa/b/c), possible mosaic loss of Y, sex check, outlier samples.
- **Metadata:** filter, group and sort samples by population, age, phenotype or any other column.
- **Export:** figures (PNG/SVG/PDF), tables (CSV/TSV) and flagged regions (BED).

### Normalisation

| Mode | Formula | Meaning | Now |
| --- | --- | --- | --- |
| raw depth | `d(w)` | mean read depth of window `w` | stored, not shown |
| relative copy (default) | `d(w) / (B / 2)` | `B` = median autosomal depth; 1.0 = one copy | yes |
| Y-internal | `d(w) / median d(reliable XDR)` | relative to the sample's own single-copy chrY | planned |
| cohort-relative | `RC(w) / median over samples RC(w)` | removes biases shared by all samples (needs ≥ 5 samples) | planned |

Every value will be computed from all reads and from reads with MAPQ ≥ 20. v0.1.0 reads only
the all-reads coverage.

## Development

```bash
uv sync                       # backend with dev tools
uv run pytest                 # backend tests
uv run ruff check . && uv run ruff format --check .
uv run mypy src tests
```

Frontend commands (dev server with hot reload, tests, lint, build) are in
[web/README.md](web/README.md). CI runs all checks for both parts on every push, with
Python 3.11 and 3.13. The backend tests must cover at least 70 % of the code.

**Stack:** Python (Typer, FastAPI, polars) for processing and the server; TypeScript (React,
Vite, Tailwind CSS, Plotly.js) for the interface.

```
src/ycov/      Python package: cli, validate, coverage, windows, analysis, project, server, annotations
web/           TypeScript frontend (web/README.md)
tests/         backend tests
example_data/  simulated and real example coverage (example_data/README.md)
scripts/       data preparation: annotations, simulation, test data
docs/          developer documentation (docs/architecture.md)
```

## Intended use

ycov is a research tool, not a clinical diagnostic tool. Flags are hints for closer inspection, not diagnoses.

## License

[MIT](LICENSE)
