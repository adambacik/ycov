/**
 * Text typed into the region input (FR36) → where to go. The user writes 1-based inclusive
 * coordinates, as shown in the input (lib/format.ts); the result is 0-based half-open like
 * every range in code. Gene and region names (FR37) are not read yet.
 */
import { formatPosition } from "@/lib/format";
import type { GenomeRange } from "@/lib/genome";

export type RegionQuery =
  /** go to this range (end already cut to the chromosome length) */
  | { kind: "range"; range: GenomeRange }
  /** one position (0-based): keep the span in view, centre it there */
  | { kind: "position"; position: number }
  /** not readable or outside the chromosome; message is shown next to the input */
  | { kind: "error"; message: string };

const UNREADABLE = "Type a region as chrY:start-end";

// number with optional thousands commas and decimals, then an optional unit
const NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?)(bp|kb?|mb?)?`;
// [chromosome:]number[-number]; also en and em dash, as copied from papers
const QUERY = new RegExp(String.raw`^(?:([^:]+):)?${NUMBER}(?:[-–—]${NUMBER})?$`, "i");

/** "chrY", "Y", "chry" → "y": the same chromosome however it is written. */
function chromosomeKey(name: string): string {
  return name.toLowerCase().replace(/^chr/, "");
}

/** Base pairs of a matched number: "2,458,321" → 2458321, "20.5" + "M" → 20500000. */
function toBp(digits: string, unit: string | undefined): number {
  const value = Number.parseFloat(digits.replaceAll(",", ""));
  const scale = { k: 1e3, m: 1e6 }[unit?.[0]?.toLowerCase() ?? ""] ?? 1;
  return Math.round(value * scale);
}

/**
 * Read a region: "chrY:2,458,321-27,020,249", "Y:20M-26M", "20-26 Mb" (a single unit is used
 * for both numbers), "chrY:15000000" (a position), "chrY" (the whole chromosome). Spaces and
 * letter case do not matter, the chromosome may be left out.
 */
export function parseRegionQuery(text: string, chromosome: string, length: number): RegionQuery {
  const compact = text.replace(/\s+/g, "");
  if (chromosomeKey(compact) === chromosomeKey(chromosome)) {
    return { kind: "range", range: { start: 0, end: length } };
  }

  const [, name, startDigits, startUnit, endDigits, endUnit] = QUERY.exec(compact) ?? [];
  // the first number is not optional in QUERY: undefined only when nothing matched
  if (startDigits === undefined) return { kind: "error", message: UNREADABLE };

  if (name !== undefined && chromosomeKey(name) !== chromosomeKey(chromosome)) {
    return { kind: "error", message: `Only ${chromosome} is in this project` };
  }
  const pastEnd = `${chromosome} is ${formatPosition(length)} bp long`;

  if (endDigits === undefined) {
    const position = toBp(startDigits, startUnit);
    if (position < 1) return { kind: "error", message: "Positions start at 1" };
    if (position > length) return { kind: "error", message: pastEnd };
    return { kind: "position", position: position - 1 };
  }

  const start = toBp(startDigits, startUnit ?? endUnit);
  const end = toBp(endDigits, endUnit ?? startUnit);
  if (start < 1) return { kind: "error", message: "Positions start at 1" };
  if (end < start) return { kind: "error", message: "The start is after the end" };
  if (start > length) return { kind: "error", message: pastEnd };
  return { kind: "range", range: { start: start - 1, end: Math.min(end, length) } };
}
