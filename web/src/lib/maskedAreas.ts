/** Masked windows (FR59) as filled areas of a plot: one look for the PARs, one for everything else. */
import type { Interval } from "@/api/types";

/** Why there is no relative copy: PAR (reads are on chrX) or no data (gap). */
export type MaskKind = "par" | "gap";

/** Corner points of rectangles, null between two of them (Plotly fill "toself"). */
export interface MaskedArea {
  x: (number | null)[];
  y: (number | null)[];
}

/** Kind of a masked interval; any reason other than "par" looks like a gap. */
export function maskKind(interval: Interval): MaskKind {
  return interval.name === "par" ? "par" : "gap";
}

/** The intervals of one kind as rectangles from 0 to `top`. */
export function maskedArea(masked: readonly Interval[], kind: MaskKind, top: number): MaskedArea {
  const area: MaskedArea = { x: [], y: [] };
  for (const interval of masked) {
    if (maskKind(interval) !== kind) continue;
    const { start, end } = interval;
    if (area.x.length > 0) {
      area.x.push(null);
      area.y.push(null);
    }
    area.x.push(start, start, end, end);
    area.y.push(0, top, top, 0);
  }
  return area;
}
