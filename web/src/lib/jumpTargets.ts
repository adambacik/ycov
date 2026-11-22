/**
 * Entries of the nav bar's Class select ("Jump to…"): every sequence class interval grouped by
 * class, then the named regions. Picking one moves the view there (Phase 3).
 */
import type { Interval, WindowAnnotations } from "@/api/types";
import { formatMbRange } from "@/lib/format";
import type { GenomeRange } from "@/lib/genome";
import {
  SEQUENCE_CLASS_GROUPS,
  sequenceClassGroup,
  type SequenceClassGroup,
} from "@/lib/sequenceClasses";

/** One entry: unique select value, text "AZFc (23.33–27.02 Mb)" and the range to show. */
export interface JumpTarget {
  value: string;
  label: string;
  range: GenomeRange;
}

/** Entries under one heading of the select. */
export interface JumpTargetGroup {
  label: string;
  targets: JumpTarget[];
}

/** Group order of the mockup; "other" is left out, it is no place anyone jumps to. */
const GROUP_ORDER: readonly SequenceClassGroup[] = ["xdr", "ampl", "pal", "xtr", "par", "het"];

/**
 * Class groups in GROUP_ORDER (empty groups dropped, e.g. palindromes), then "Named regions".
 * Entries keep the order of the annotations, i.e. along the chromosome.
 */
export function jumpTargetGroups(
  annotations: Pick<WindowAnnotations, "classes" | "regions">,
): JumpTargetGroup[] {
  // value from the index in annotations: unique even when a class name repeats (8× X-DEG)
  const classes = annotations.classes.map((interval, index) => ({
    group: sequenceClassGroup(interval.name),
    target: toTarget(`class-${index}`, interval),
  }));

  const groups = GROUP_ORDER.map((group) => ({
    label: SEQUENCE_CLASS_GROUPS[group].label,
    targets: classes.filter((entry) => entry.group === group).map((entry) => entry.target),
  }));
  groups.push({
    label: "Named regions",
    targets: annotations.regions.map((interval, index) => toTarget(`region-${index}`, interval)),
  });

  return groups.filter((group) => group.targets.length > 0);
}

function toTarget(value: string, interval: Interval): JumpTarget {
  return {
    value,
    label: `${interval.name} (${formatMbRange(interval)})`,
    range: { start: interval.start, end: interval.end },
  };
}
