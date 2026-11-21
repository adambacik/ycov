/**
 * The real bundled annotations of the backend (src/ycov/annotations/chm13), for tests only.
 * Loaded with Vite's ?raw import, so tests run on the same files /api/windows serves and fail
 * when the backend data changes in a way the frontend does not handle.
 */
import regionsBed from "../../../src/ycov/annotations/chm13/regions.bed?raw";
import sequenceClassesBed from "../../../src/ycov/annotations/chm13/sequence_classes.bed?raw";

import type { Interval } from "@/api/types";

/** BED lines "chrom start end name" -> intervals (0-based half-open, like the API). */
function parseBed(text: string): Interval[] {
  return text
    .trim()
    .split("\n")
    .map((line) => {
      const [, start, end, name] = line.split("\t");
      if (start === undefined || end === undefined || name === undefined) {
        throw new Error(`not a BED line with a name: "${line}"`);
      }
      return { name, start: Number(start), end: Number(end) };
    });
}

/** Length of chrY in T2T-CHM13v2.0 (end of PAR2). */
export const CHRY_LENGTH = 62_460_029;

/** PAR1, AZFa, AZFb, AZFc, PAR2. */
export const REGIONS = parseBed(regionsBed);

/** Sequence classes covering the whole chromosome. */
export const SEQUENCE_CLASSES = parseBed(sequenceClassesBed);
