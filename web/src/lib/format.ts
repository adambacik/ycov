/**
 * Numbers and coordinates as text for the UI. Fixed "en-US" formatting, so the output does not
 * depend on the browser language (a Slovak locale would write 2 458 321 with spaces).
 */
import type { GenomeRange } from "@/lib/genome";

const INTEGER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/**
 * Length in bp with a readable unit: 62460029 -> "62.46 Mb", 2500 -> "2.5 kb", 10000 -> "10 kb",
 * 640 -> "640 bp". Mb always has 2 decimals, so "24.56 Mb in view" keeps its width while the
 * slider is dragged; kb has at most 1.
 */
export function formatBp(bp: number): string {
  // round first, then pick the unit: 999.6 bp is "1 kb", not "1000 bp"
  const whole = Math.round(bp);
  if (whole < 1_000) return `${whole} bp`;
  const kb = Math.round(bp / 100) / 10;
  if (kb < 1_000) return `${kb} kb`; // 999,960 bp would be "1000 kb": falls through to Mb
  return `${(bp / 1_000_000).toFixed(2)} Mb`;
}

/** Position with thousands separators: 2458321 -> "2,458,321". */
export function formatPosition(position: number): string {
  return INTEGER.format(position);
}

/**
 * Region as the user writes it, 1-based and inclusive (like IGV and samtools):
 * ("chrY", { start: 2458320, end: 27020249 }) -> "chrY:2,458,321-27,020,249".
 * The range is 0-based half-open, so only the start moves by one.
 */
export function formatRegionLabel(chromosome: string, range: GenomeRange): string {
  return `${chromosome}:${formatPosition(range.start + 1)}-${formatPosition(range.end)}`;
}

/** Sequencing depth with one decimal: 30.14 -> "30.1×". */
export function formatDepth(depth: number): string {
  return `${depth.toFixed(1)}×`;
}
