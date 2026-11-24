/**
 * Which samples are shown (FR42), as the set of hidden sample ids: empty = all shown. Every
 * function returns a new set and leaves the given one as it is. The ids are the samples an action
 * applies to; samples outside the list keep their state (Phase 3: samples filtered out).
 */
import type { SampleInfo } from "@/api/types";

/** Show these samples. */
export function showSamples(hidden: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(hidden);
  for (const id of ids) next.delete(id);
  return next;
}

/** Hide these samples. */
export function hideSamples(hidden: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  return new Set([...hidden, ...ids]);
}

/** Show the hidden ones of these samples and hide the shown ones. */
export function invertSamples(hidden: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const next = new Set(hidden);
  for (const id of new Set(ids)) {
    if (!next.delete(id)) next.add(id);
  }
  return next;
}

/** The samples that are shown, order kept. */
export function visibleSamples(
  samples: readonly SampleInfo[],
  hidden: ReadonlySet<string>,
): SampleInfo[] {
  return samples.filter((sample) => !hidden.has(sample.sample_id));
}
