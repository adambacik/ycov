# ycov web

The browser interface of ycov. `ycov view` serves it together with the API from one local
server. It shows the coverage of many samples along chrY, with the chrY sequence classes.

> **Status:** Phase 2 prototype (v0.1.0). It shows the data and lets you move around chrY.
> Analysis features (normalisation modes, MAPQ switch, flags, exports) come in Phase 3. Their
> controls are already on the page, disabled, with the tooltip "Available in a later version".

## What works

| Part of the page    | Works now                                                                                                                                                                                                           | Not yet (Phase 3)                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Top bar             | project name, reference                                                                                                                                                                                             | Reads `All / MAPQ ≥ 20`, Normalisation, Export (disabled)           |
| Navigation bar      | region input with typed coordinates (`chrY:20,000,000-26,000,000`, `20M-26M`, one position, `chrY`); zoom −/+; move ←/→; Reset; span in view                                                                        | gene and AZF names in the input, "Jump to…" class select (disabled) |
| Chromosome overview | whole chrY: named regions (PAR1/2, AZFa/b/c), sequence-class bar, Mb axis; red viewport box: drag to move, drag its edges to resize, click to centre, arrow keys                                                    | –                                                                   |
| Sample list         | all samples with baseline depth; tick boxes show/hide a sample; All / None / Invert                                                                                                                                 | search, sort, group, filters                                        |
| Track panel         | sticky header with the axis and sequence classes of the region in view (drag it to pan); one coverage plot per shown sample, relative copy on a fixed 0–2.2 scale, PARs dotted, gaps hatched, hover shows the value | heatmap strip, 1 kb resolution, scroll to zoom                      |
| Cohort bar          | – (empty, keeps its height)                                                                                                                                                                                         | Flags, Summary, Boxplots, X/Y ratio, Legend                         |

Limits of the prototype:

- **One resolution:** the whole chrY is loaded once at 10 kb bins. The smallest view is 100 kb
  (10 bins).
- **Values:** only relative copy number from all reads is shown.

## Quick start

Requirements: Node.js ≥ 22 and the Python package (see the [main README](../README.md)).

```bash
cd web
npm install
npm run build                 # → web/dist, which ycov view serves
cd ..
uv run ycov prepare example_data/simulated/S??.regions.bed.gz -o /tmp/ycov_sim
uv run ycov view /tmp/ycov_sim                 # opens http://127.0.0.1:8000
```

After a new build, reload the page with Ctrl+F5. The browser may otherwise keep the old
`index.html`.

### Development with hot reload

```bash
uv run ycov view /tmp/ycov_sim --no-browser    # API on 127.0.0.1:8000
cd web && npm run dev                          # page on http://127.0.0.1:5173
```

Vite forwards `/api` to port 8000, so the page and the API share one origin and the server needs
no CORS.

## Scripts

| Command                           | What it does                                       |
| --------------------------------- | -------------------------------------------------- |
| `npm run dev`                     | dev server on 127.0.0.1:5173 with hot reload       |
| `npm run build`                   | type check, then production build into `dist/`     |
| `npm test`                        | Vitest unit tests of `src/lib/` (Node, no browser) |
| `npm run typecheck`               | `tsc -b`                                           |
| `npm run lint`                    | ESLint (TypeScript, React hooks rules)             |
| `npm run format` / `format:check` | Prettier, with Tailwind class sorting              |

## Stack

React 19 + TypeScript, Vite, Tailwind CSS 4, shadcn/ui (Radix) for controls, zustand for shared
UI state, and Plotly.js (`plotly.js-basic-dist-min`) for the coverage plots. Data is loaded with
plain `fetch`.

## Structure

```
src/
  api/          fetch client and response types of /api/project, /samples, /windows, /coverage
  state/        projectData (read-only server data, React context), viewStore and sampleStore (zustand)
  hooks/        useProjectLoader, useViewDrag, useElementWidth, useInView
  lib/          pure TypeScript, unit-tested: view range maths, region parser, ticks, labels, formats
  components/
    layout/         AppLayout: the six containers of the mockup
    top-bar/        project summary, Reads, Normalisation, Export
    nav-bar/        region input, class select, zoom/move/Reset, span in view
    overview/       chromosome overview and viewport slider
    genome/         shared drawings: GenomeAxis, SequenceClassBar, RegionLanes
    sample-sidebar/ sample list with tick boxes
    tracks/         TrackPanel, TrackHeader, one SampleTrackRow + CoveragePlot per sample
    cohort-bar/     empty footer for Phase 3
    common/, ui/    small shared parts, shadcn/ui components
  styles/       globals.css: design tokens (colours, sizes, fonts)
```

## How it works

- **Loading:** on start, `useProjectLoader` sends four requests in parallel (project, samples,
  window annotations, coverage of the whole chrY). Nothing is fetched again while you navigate.
- **Region in view:** `viewStore` holds it. Every control changes it through `setView`, which
  clamps it into the chromosome and to at least 100 kb. The view maths are pure functions in
  `lib/viewRange.ts`. Components subscribe to single fields, so a drag re-renders only what
  shows the view.
- **Coordinates:** 0-based half-open `[start, end)` in code and in the API, as in BED. Text
  shown to the user and typed into the region input is 1-based and inclusive, as in IGV and
  samtools (`lib/format.ts`, `lib/regionQuery.ts`).
- **Smooth dragging:** `useViewDrag` (slider and track header) writes at most one view per
  animation frame. `lib/drawQueue.ts` spreads Plotly redraws over several frames, and
  `useInView` redraws only the rows on screen.
- **Measured** with 100 samples (4-core VM): first load 2.5 s in Chrome and 2.2 s in Firefox,
  pan update ≤ 0.35 s.
