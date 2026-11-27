# Architecture

How the Python package `ycov` is organised: which layer does what, how a command
travels through the code, where data and types live, and the rules that keep the
pieces independent. Updates the "Main components" table of
`software_design.docx` (Phase 1).

## Layers

ycov has two commands, `ycov prepare` and `ycov view`. Every command passes
through three layers, and dependencies only point downwards:

```
 cli/                 parse the command line, print progress, turn errors into messages
  │
  ▼
 prepare.py, view.py  one orchestrator per command: the order of the steps
  │
  ▼
 validate/ coverage/  the work itself, each module knows only its own piece
 windows/ analysis/
 project/ server/
  │
  ▼
 models.py, errors.py  shared vocabulary: sample record, table schemas, the error type
```

- **CLI (`cli/`)** is thin. Typer reads the command line, picks the command
  function by name (`prepare` or `view`) and calls it with the arguments
  already parsed into typed parameters. The command function calls exactly one
  orchestrator, catches `YcovInputError` and prints it as one line with exit
  code 1, and prints the summary. It does no data processing.
- **Orchestrators (`prepare.py`, `view.py`)** hold the sequence of steps of one
  command and nothing else: call the reader, the windows, the normalisation,
  the writer, and return a short summary. They are plain functions, so pytest
  runs the whole pipeline without the command line.
- **Modules** do the work. They never import from `cli/` or from the
  orchestrators, so each can be tested alone on a small hand-made table.
- **Shared vocabulary (`models.py`, `errors.py`)** imports nothing from ycov, so
  every layer can use it without circular imports.

The entry point in `pyproject.toml` (`[project.scripts]`) points straight at the
Typer app in `cli/`. There is no separate "main" function in between and no
logic in `__init__.py`.

## Module map

| Location | Responsibility | Used by |
| --- | --- | --- |
| `src/ycov/cli/` | Typer app, `prepare` and `view` commands, error messages, exit codes | entry point |
| `src/ycov/prepare.py` | Order of the prepare steps, returns a summary | `cli` |
| `src/ycov/view.py` | Opens and checks the project, starts the server | `cli` |
| `src/ycov/validate/` | Checks before any file is opened: paths exist and are readable, format from the extension, unique sample ids; turns the paths into `Sample` records | `prepare`, `view` |
| `src/ycov/coverage/` | Reads input files, checks their contents while parsing, converts every format into the one coverage table | `prepare` |
| `src/ycov/windows/` | 1 kb grid, sequence classes, gap / PAR / `reliable` flags | `prepare` |
| `src/ycov/analysis/` | Baseline, relative copy (later summaries and flags) | `prepare` |
| `src/ycov/project/` | Writes and reads the project folder (manifest + parquet) | `prepare` writes, `view` and `server` read |
| `src/ycov/server/` | FastAPI app, reads data only through `project/` | `view` |
| `src/ycov/models.py` | `Sample` record, input formats, table column names | everyone |
| `src/ycov/errors.py` | `YcovInputError` | everyone |
| `src/ycov/annotations/` | Bundled CHM13 annotation files | `windows` |

Changes against the Phase 1 design: the orchestrators, `models.py` and
`errors.py` are new; `validate/` only checks what is known without opening a
file (see "Input checks").

## Input checks

Checks are split by what they need, so no file is read twice and no format is
known in two places:

| Where | Needs | Checks |
| --- | --- | --- |
| `validate/` | only the paths | file exists and is readable, supported extension, sample id not empty and unique, at least one input; in `view` the project folder and its manifest exist |
| `coverage/` | the file contents, while parsing | 4 columns, integer coordinates, numeric depth, chrY and chr19-22 present, 1 kb windows, chrY length of CHM13 |

`validate/` runs first, so wrong paths or names fail before any expensive
reading (UC12: problems are reported before any processing). It checks file
existence itself instead of leaving it to Typer, so the checks hold for every
caller of the orchestrators, pytest included. Both raise `YcovInputError`.

## Flow of a command

**`ycov prepare HG*.regions.bed.gz -o proj`**

1. Typer calls the CLI's `prepare` with a list of paths and the output folder.
2. The CLI calls the prepare orchestrator with them.
3. `validate/` checks the paths and turns every one into a `Sample` record (id
   from the file name, format from the extension).
4. `coverage/` reads all samples into one coverage table and checks the contents.
5. `windows/` builds the annotated window table, the coverage is joined to it.
6. `analysis/` adds the relative copy.
7. `project/` writes the tables and `manifest.json` into `proj/`.
8. The orchestrator returns a summary, the CLI prints
   "10 samples, 62 461 chrY windows -> proj/".

**`ycov view proj`**

1. Typer calls the CLI's `view` with the project folder.
2. `validate/` checks that the project folder and its manifest exist, the view
   orchestrator reads the manifest through `project/` and starts the server.
3. The server answers the frontend's requests by reading through `project/`.

**Bad input anywhere**: the module that finds the problem raises
`YcovInputError` with the file and the reason. It passes through the
orchestrator untouched and the CLI prints it as one line, for example
`Error: HG00096.regions.bed.gz: no chrY windows`.

## Data: records and tables

Two kinds of data, kept apart on purpose.

**Records describe things.** A `Sample` is a small immutable (frozen) dataclass:
sample id, path, input format, later computed facts such as the baseline depth.
The list of samples is what `manifest.json` stores. A step that learns
something new about a sample returns a new record instead of changing a shared
one, so no step depends on hidden state left by another.

**Tables hold the measurements.** Coverage of all samples lives in one long
polars table, one row per sample and window (`sample_id, chrom, start, end,
depth`, later `rel_copy`). Normalisation, the heatmap and the summaries work
across samples, which is one vectorised operation on a table and a loop over
objects otherwise. The same table is written to parquet as it is.

The prepare pipeline is therefore a chain of transformations, each step taking
data in and returning new data:

```
list of Sample records
  -> coverage table                (coverage/)
  -> joined with the windows table (windows/)
  -> normalised table              (analysis/)
  -> project folder + manifest     (project/)
```

Formats are converted at the start: every input format becomes the same
coverage table in `coverage/`, everything after it is format-agnostic. BAM/CRAM
input (Phase 3/4) runs mosdepth first and then goes through the same reader,
which is why the input format is part of the `Sample` record from the start.

## Arguments between layers

Typer passes each command-line option as its own typed parameter (a list of
paths, an output path, ...),  and the CLI passes them on to the
orchestrator the same way. When a command gets more settings than a
handful of parameters (window size, MAPQ threshold, metadata file in later
phases), they are grouped into one frozen settings dataclass in `models.py` that
is built once in the CLI and passed down.

## Where types live

- **Shared types** (used by more than one module): `models.py`. The `Sample`
  record, the input-format enum, the settings dataclasses, the column names of
  the shared tables and the type aliases that go with them.
- **Local types** (used by one module only): in that module, next to the code
  that uses them.
- `models.py` stays a vocabulary, not a dumping ground: a type moves there only
  when a second module needs it.

## Rules

1. Dependencies only point downwards: `cli` -> orchestrators -> modules ->
   `models.py` / `errors.py`.
2. Only `cli/` prints to the user and decides exit codes; modules raise
   `YcovInputError` or return data.
3. Only `project/` knows the layout of the project folder; the server reads
   through it.
4. Records are immutable, tables are returned, not changed in place.
