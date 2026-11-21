/**
 * Pure operations on the region in view (viewport slider, later zoom/move buttons). Every
 * function returns a valid view: whole bases, inside bounds, at least minSpan long. The slider
 * always starts from the view at pointerdown plus the total drag distance (never step by
 * step), so rounding does not add up and the box does not drift.
 */
import type { GenomeRange } from "@/lib/genome";

/** Start that puts a view of this span inside bounds (moved as little as possible). */
function shiftInto(start: number, span: number, bounds: GenomeRange): number {
  return Math.min(Math.max(start, bounds.start), bounds.end - span);
}

/** Span limited to [minSpan, bounds length]; a minSpan larger than the bounds gives the bounds. */
function limitSpan(span: number, bounds: GenomeRange, minSpan: number): number {
  const boundsSpan = bounds.end - bounds.start;
  return Math.min(Math.max(span, minSpan), boundsSpan);
}

/**
 * Make any range a valid view: round to whole bases, widen around its centre to minSpan if
 * too short, shrink to the bounds if too long, then shift inside the bounds.
 */
export function clampView(view: GenomeRange, bounds: GenomeRange, minSpan: number): GenomeRange {
  const low = Math.round(Math.min(view.start, view.end));
  const high = Math.round(Math.max(view.start, view.end));
  const span = limitSpan(high - low, bounds, minSpan);
  const centre = (low + high) / 2;
  const start = shiftInto(Math.round(centre - span / 2), span, bounds);
  return { start, end: start + span };
}

/** Move the view by deltaBp (positive = right); the span stays, it stops at the edges. */
export function moveView(origin: GenomeRange, deltaBp: number, bounds: GenomeRange): GenomeRange {
  const span = origin.end - origin.start;
  const start = shiftInto(Math.round(origin.start + deltaBp), span, bounds);
  return { start, end: start + span };
}

/** Drag the left edge by deltaBp; the right edge stays, the span never drops below minSpan. */
export function resizeViewStart(
  origin: GenomeRange,
  deltaBp: number,
  bounds: GenomeRange,
  minSpan: number,
): GenomeRange {
  const latest = origin.end - minSpan;
  const start = Math.max(bounds.start, Math.min(Math.round(origin.start + deltaBp), latest));
  return { start, end: origin.end };
}

/** Drag the right edge by deltaBp; the left edge stays, the span never drops below minSpan. */
export function resizeViewEnd(
  origin: GenomeRange,
  deltaBp: number,
  bounds: GenomeRange,
  minSpan: number,
): GenomeRange {
  const earliest = origin.start + minSpan;
  const end = Math.min(bounds.end, Math.max(Math.round(origin.end + deltaBp), earliest));
  return { start: origin.start, end };
}

/** Same span, centred on position; near an edge it stops at the edge (not centred then). */
export function centreViewOn(
  view: GenomeRange,
  position: number,
  bounds: GenomeRange,
): GenomeRange {
  const span = view.end - view.start;
  const start = shiftInto(Math.round(position - span / 2), span, bounds);
  return { start, end: start + span };
}
