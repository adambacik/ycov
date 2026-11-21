/** Genome axis ticks: round positions in 1-2-5 steps and their Mb labels (mockup drawAxis). */
import type { GenomeRange } from "@/lib/genome";

/** One labelled tick on the axis. */
export interface AxisTick {
  position: number;
  label: string;
}

/** All ticks of an axis: labelled major ticks every `step` bp, unlabelled minor ticks between. */
export interface AxisTicks {
  step: number;
  major: AxisTick[];
  minor: number[];
}

/**
 * Round a raw step up or down to 1, 2 or 5 × 10^n, whichever is nearest on a log scale:
 * 4.2 Mb -> 5 Mb, 2.6 Mb -> 2 Mb, 1.3 Mb -> 1 Mb, 8 Mb -> 10 Mb.
 */
export function niceStep(rawStep: number): number {
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const mantissa = rawStep / power; // 1 <= mantissa < 10
  if (mantissa < 1.5) return power;
  if (mantissa < 3.5) return 2 * power;
  if (mantissa < 7.5) return 5 * power;
  return 10 * power;
}

/**
 * Tick label in Mb with as many decimals as the step needs, so neighbouring labels differ:
 * step 5 Mb -> "15 Mb", step 200 kb -> "15.2 Mb", step 50 kb -> "15.25 Mb". 0 is just "0".
 */
export function formatTick(position: number, step: number): string {
  if (position === 0) return "0";
  const decimals = Math.min(6, Math.max(0, 6 - Math.floor(Math.log10(step))));
  return `${(position / 1_000_000).toFixed(decimals)} Mb`;
}

/** Minor ticks per major step: 5 Mb -> 1 Mb, 2 Mb -> 1 Mb, 1 Mb -> 200 kb. */
function minorDivisions(step: number): number {
  const mantissa = step / 10 ** Math.floor(Math.log10(step));
  return Math.round(mantissa) === 2 ? 2 : 5;
}

/** Multiples of step inside [start, end], computed as k × step so no rounding error adds up. */
function multiplesIn(domain: GenomeRange, step: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(domain.start / step); k * step <= domain.end; k++) out.push(k * step);
  return out;
}

/**
 * Ticks for an axis over the domain with at most about maxTicks labels (axis width / 95 px,
 * the mockup density). Whole chrY at 1400 px -> labels every 5 Mb, minor ticks every 1 Mb;
 * at 500 px -> every 10 Mb.
 */
export function axisTicks(domain: GenomeRange, maxTicks: number): AxisTicks {
  const span = domain.end - domain.start;
  // empty domain or no width measured yet (NaN): no ticks instead of a step of 0
  if (!(span > 0) || !(maxTicks > 0)) return { step: 0, major: [], minor: [] };
  const step = niceStep(span / Math.max(2, maxTicks));
  const major = multiplesIn(domain, step).map((position) => ({
    position,
    label: formatTick(position, step),
  }));
  const minorStep = step / minorDivisions(step);
  const minor = multiplesIn(domain, minorStep).filter((position) => position % step !== 0);
  return { step, major, minor };
}
