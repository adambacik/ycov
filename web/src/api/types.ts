/**
 * JSON shapes of the ycov API, written by hand to match
 * src/ycov/server/schemas.py (one interface per pydantic model).
 *
 * Keep the two in sync: a field renamed on the server must be renamed here.
 * Generated types (openapi-typescript from /openapi.json) are left for Phase 3.
 */

/** Value shown per window (schemas.Mode). */
export type Mode = "rel_copy" | "depth";

/** GET /api/project: the manifest. */
export interface ProjectInfo {
  name: string;
  ycov_version: string;
  /** creation time, ISO 8601 UTC */
  created: string;
  /** e.g. "T2T-CHM13v2.0" */
  reference: string;
  /** bundled annotation set, e.g. "chm13" */
  annotations: string;
  /** e.g. "chrY" */
  chromosome: string;
  /** chromosome length in bp */
  length: number;
  /** window size of the stored coverage in bp */
  window_size: number;
}

/** One entry of GET /api/samples. */
export interface SampleInfo {
  sample_id: string;
  /** coverage file the sample was read from */
  path: string;
  /** e.g. "mosdepth", "bedgraph" */
  format: string;
  /** median depth of chr19-22 (two copies) */
  baseline: number;
}

/** A named half-open interval [start, end), 0-based like BED. */
export interface Interval {
  name: string;
  start: number;
  end: number;
}

/** GET /api/windows: window annotations merged into intervals. */
export interface WindowAnnotations {
  chromosome: string;
  length: number;
  window_size: number;
  /** sequence classes, cover the whole chromosome */
  classes: Interval[];
  /** PAR1, PAR2, AZFa, AZFb, AZFc */
  regions: Interval[];
  /** windows without relative copy, name is the reason (PAR, gap) */
  masked: Interval[];
}

/** The part of the chromosome a coverage response covers. */
export interface Region {
  chromosome: string;
  start: number;
  end: number;
}

/**
 * GET /api/coverage: values per sample aligned to shared bins.
 *
 * values[i][j] is the value of samples[i] in the bin starting at starts[j];
 * null where the bin has no reliable window (gap, PAR).
 */
export interface Coverage {
  region: Region;
  /** bin size in bp */
  resolution: number;
  mode: Mode;
  samples: string[];
  starts: number[];
  values: (number | null)[][];
}
