/**
 * Where text labels go in the genome drawings (axis, class bar, region lanes). Widths are
 * estimated from the number of characters: close enough to decide whether a label fits, and
 * no DOM measuring while the slider is dragged.
 */
import { toPercent, type GenomeRange } from "@/lib/genome";
import type { AxisTick } from "@/lib/ticks";

/** Average character width in px at caption size (11 px): mono fonts 6.05-6.62, sans about 6.6. */
const CAPTION_CHAR_WIDTH = 6.7;

/** Free space in px on each side of a label inside its bar, and between bar and label. */
export const LABEL_PADDING = 4;

/** Estimated width in px of a text in caption size. */
export function estimateLabelWidth(text: string): number {
  return text.length * CAPTION_CHAR_WIDTH;
}

/** Whether a label fits into a bar of this width, with LABEL_PADDING on both sides. */
export function labelFits(text: string, barWidth: number): boolean {
  return estimateLabelWidth(text) + 2 * LABEL_PADDING <= barWidth;
}

/** Position of a label relative to its bar. */
export type BarLabelSide = "inside" | "left" | "right";

/**
 * Where the label of a bar [startPx, endPx) goes: inside when it fits, otherwise left of the
 * bar (AZFa), or right of it when there is no room on the left (PAR1 on a narrow window).
 */
export function barLabelSide(text: string, startPx: number, endPx: number): BarLabelSide {
  if (labelFits(text, endPx - startPx)) return "inside";
  return estimateLabelWidth(text) + LABEL_PADDING <= startPx ? "left" : "right";
}

/** An axis tick with the SVG position of its label: x in px and the matching text-anchor. */
export interface PlacedTickLabel extends AxisTick {
  x: number;
  anchor: "start" | "middle" | "end";
}

/**
 * Labels centred on their ticks, the first and last one moved inside the edges of an axis
 * `width` px wide. A moved label that would run into its neighbour is dropped (its tick mark
 * stays): with long labels ("15.25 Mb") this happens at almost every slider position.
 */
export function placeTickLabels(
  ticks: readonly AxisTick[],
  domain: GenomeRange,
  width: number,
): PlacedTickLabel[] {
  const placed = ticks.map((tick) => {
    const centre = (toPercent(tick.position, domain) / 100) * width;
    const labelWidth = estimateLabelWidth(tick.label);
    const left = Math.min(Math.max(0, centre - labelWidth / 2), width - labelWidth);
    return { tick, centre, left, right: left + labelWidth };
  });

  return placed.flatMap(({ tick, centre, left, right }, index): PlacedTickLabel[] => {
    if (centre < (right - left) / 2) {
      const next = placed[index + 1];
      const free = next === undefined || right + LABEL_PADDING <= next.left;
      return free ? [{ ...tick, x: 0, anchor: "start" }] : [];
    }
    if (centre > width - (right - left) / 2) {
      const previous = placed[index - 1];
      const free = previous === undefined || previous.right + LABEL_PADDING <= left;
      return free ? [{ ...tick, x: width, anchor: "end" }] : [];
    }
    return [{ ...tick, x: centre, anchor: "middle" }];
  });
}
