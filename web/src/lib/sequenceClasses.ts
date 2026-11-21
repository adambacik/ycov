/**
 * Sequence class names of the bundled sequence_classes.bed (served by /api/windows) grouped
 * into the 7 mockup colours. Tailwind only generates classes it finds as complete strings in
 * the source, so the map stores full class names and never builds them (`fill-seq-${g}`).
 */

export type SequenceClassGroup = "par" | "xtr" | "xdr" | "ampl" | "pal" | "het" | "other";

/** How one group is shown. */
interface GroupStyle {
  label: string;
  /** SVG bars (overview, track header) */
  fillClass: string;
  /** HTML swatches (legend in Phase 3) */
  bgClass: string;
}

export const SEQUENCE_CLASS_GROUPS: Record<SequenceClassGroup, GroupStyle> = {
  par: { label: "Pseudoautosomal", fillClass: "fill-seq-par", bgClass: "bg-seq-par" },
  xtr: { label: "X-transposed", fillClass: "fill-seq-xtr", bgClass: "bg-seq-xtr" },
  xdr: { label: "X-degenerate", fillClass: "fill-seq-xdr", bgClass: "bg-seq-xdr" },
  ampl: { label: "Ampliconic", fillClass: "fill-seq-ampl", bgClass: "bg-seq-ampl" },
  pal: { label: "Palindrome", fillClass: "fill-seq-pal", bgClass: "bg-seq-pal" },
  het: { label: "Heterochromatin / satellite", fillClass: "fill-seq-het", bgClass: "bg-seq-het" },
  other: { label: "Other", fillClass: "fill-seq-other", bgClass: "bg-seq-other" },
};

/**
 * Exact names from sequence_classes.bed. A Map, not an object literal: an object would also
 * "find" inherited keys like "toString" or "constructor".
 */
const GROUP_OF_NAME: ReadonlyMap<string, SequenceClassGroup> = new Map<string, SequenceClassGroup>([
  ["PAR1", "par"],
  ["PAR2", "par"],
  ["XTR1", "xtr"],
  ["XTR2", "xtr"],
  ["X-DEG", "xdr"],
  ["AMPL", "ampl"],
  ["HET", "het"],
  ["CEN", "het"],
  ["SAT", "het"],
  ["DYZ17", "het"],
  ["DYZ19", "het"],
  ["OTHER", "other"],
]);

/** Palindromes P1-P8, not in the bundled BED yet. */
const PALINDROME = /^P[1-8]$/;

/** Group of a class name from /api/windows; P1-P8 -> "pal", unknown -> "other". */
export function sequenceClassGroup(name: string): SequenceClassGroup {
  if (PALINDROME.test(name)) return "pal";
  return GROUP_OF_NAME.get(name) ?? "other";
}
