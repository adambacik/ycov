/**
 * Coverage bins as points of a Plotly step line. Plotly draws a line only between two points, so
 * bin starts alone would lose the last bin before every gap. Here a bin is a point at its centre
 * (line shape "hvh" steps halfway between two centres, i.e. at the bin edge), and every run of
 * bins with a value gets extra points at its two outer edges.
 */
import type { GenomeRange } from "@/lib/genome";

/** Points of one sample, all arrays have the same length. */
export interface CoverageSteps {
  /** position in bp, 0-based */
  x: number[];
  /** value to draw as a line; null = gap, the line is interrupted */
  line: (number | null)[];
  /** the same with 0 in gaps: a Plotly fill would be drawn straight across a null */
  fill: number[];
  /** bin of the point as [first, last] position, 1-based inclusive, for the hover text */
  bins: [number, number][];
}

/**
 * Step points of one coverage row; `values[i]` belongs to the bin starting at `starts[i]`. Only
 * the bins in `view` plus one on each side: Plotly needs time for every point it gets, also for
 * those outside its x-range, and the plots are redrawn while the slider is dragged.
 */
export function coverageSteps(
  starts: readonly number[],
  values: readonly (number | null)[],
  resolution: number,
  region: GenomeRange,
  view: GenomeRange,
): CoverageSteps {
  const steps: CoverageSteps = { x: [], line: [], fill: [], bins: [] };

  function add(x: number, value: number | null, bin: GenomeRange) {
    steps.x.push(x);
    steps.line.push(value);
    steps.fill.push(value ?? 0);
    steps.bins.push([bin.start + 1, bin.end]);
  }

  starts.forEach((start, i) => {
    if (start + 2 * resolution <= view.start || start - resolution >= view.end) return;
    const value = values[i] ?? null;
    if (value === null) return;
    // the last bin of the region can be shorter than the others
    const bin = { start, end: Math.min(start + resolution, region.end) };

    if ((values[i - 1] ?? null) === null) {
      add(bin.start, null, bin);
      add(bin.start, value, bin);
    }
    add((bin.start + bin.end) / 2, value, bin);
    if ((values[i + 1] ?? null) === null) {
      add(bin.end, value, bin);
      add(bin.end, null, bin);
    }
  });
  return steps;
}
