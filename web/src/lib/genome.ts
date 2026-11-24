/**
 * Genome coordinates. Ranges are 0-based half-open [start, end) everywhere in code, like BED
 * and the API; only text shown to the user is 1-based (lib/format.ts).
 */
import type { WindowAnnotations } from "@/api/types";

/** A stretch of the chromosome, 0-based half-open [start, end). */
export interface GenomeRange {
  start: number;
  end: number;
}

/** Position as percent of the domain width: 0 at domain.start, 100 at domain.end. */
export function toPercent(position: number, domain: GenomeRange): number {
  return ((position - domain.start) / (domain.end - domain.start)) * 100;
}

/**
 * The part of an interval inside the domain, other fields (name) kept; null when they do not
 * overlap. Touching ranges ([0, 10) and [10, 20)) do not overlap.
 */
export function clipToRange<T extends GenomeRange>(interval: T, domain: GenomeRange): T | null {
  const start = Math.max(interval.start, domain.start);
  const end = Math.min(interval.end, domain.end);
  return start < end ? { ...interval, start, end } : null;
}

/** Result of assignLanes: each interval with its lane (0 = top) and the number of lanes. */
export interface LaneLayout<T> {
  items: (T & { lane: number })[];
  laneCount: number;
}

/**
 * Stack overlapping intervals into lanes, greedy by start: each interval goes to the first
 * lane whose last interval ends at or before its start. Real regions: AZFc overlaps AZFb, so
 * AZFc gets lane 1 and everything else lane 0. Items come back sorted by start.
 */
export function assignLanes<T extends GenomeRange>(intervals: readonly T[]): LaneLayout<T> {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = []; // end of the last interval in each lane
  const items = sorted.map((interval) => {
    let lane = laneEnds.findIndex((end) => end <= interval.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = interval.end;
    return { ...interval, lane };
  });
  return { items, laneCount: laneEnds.length };
}

/**
 * Default view: from the end of PAR1 to the end of AZFc, the male-specific euchromatin
 * (mockup 2.5-27 Mb). The whole chromosome if one of the two regions is missing.
 */
export function initialView(annotations: WindowAnnotations): GenomeRange {
  const par1 = annotations.regions.find((region) => region.name === "PAR1");
  const azfc = annotations.regions.find((region) => region.name === "AZFc");
  if (par1 === undefined || azfc === undefined || par1.end >= azfc.end) {
    return { start: 0, end: annotations.length };
  }
  return { start: par1.end, end: azfc.end };
}
