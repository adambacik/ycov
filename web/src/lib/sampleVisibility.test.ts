import { describe, expect, test } from "vitest";

import type { SampleInfo } from "@/api/types";
import { hideSamples, invertSamples, showSamples, visibleSamples } from "@/lib/sampleVisibility";

const ALL = ["S01", "S02", "S03", "S04"];
const SAMPLES: SampleInfo[] = ALL.map((sample_id) => ({
  sample_id,
  path: `${sample_id}.regions.bed.gz`,
  format: "mosdepth",
  baseline: 30,
}));

describe("showSamples", () => {
  test("one sample: the others keep their state", () => {
    expect(showSamples(new Set(["S01", "S02"]), ["S01"])).toEqual(new Set(["S02"]));
  });

  test("all samples: nothing stays hidden", () => {
    expect(showSamples(new Set(["S01", "S03"]), ALL)).toEqual(new Set());
  });

  test("an already shown sample changes nothing", () => {
    expect(showSamples(new Set(["S02"]), ["S01"])).toEqual(new Set(["S02"]));
  });
});

describe("hideSamples", () => {
  test("one sample: the others keep their state", () => {
    expect(hideSamples(new Set(["S02"]), ["S01"])).toEqual(new Set(["S01", "S02"]));
  });

  test("all samples: none is shown", () => {
    expect(hideSamples(new Set(["S02"]), ALL)).toEqual(new Set(ALL));
  });
});

describe("invertSamples", () => {
  test("swaps shown and hidden", () => {
    expect(invertSamples(new Set(["S01", "S03"]), ALL)).toEqual(new Set(["S02", "S04"]));
  });

  test("twice gives the start again", () => {
    const start = new Set(["S01", "S03"]);
    expect(invertSamples(invertSamples(start, ALL), ALL)).toEqual(start);
  });

  test("samples outside the list keep their state", () => {
    expect(invertSamples(new Set(["S01", "S04"]), ["S01", "S02"])).toEqual(new Set(["S02", "S04"]));
  });
});

test("the given set is never changed (the store compares by reference)", () => {
  const hidden = new Set(["S01"]);
  for (const change of [showSamples, hideSamples, invertSamples]) {
    expect(change(hidden, ALL)).not.toBe(hidden);
  }
  expect(hidden).toEqual(new Set(["S01"]));
});

describe("visibleSamples", () => {
  const ids = (hidden: string[]) =>
    visibleSamples(SAMPLES, new Set(hidden)).map((sample) => sample.sample_id);

  test("nothing hidden: all, in their order", () => {
    expect(ids([])).toEqual(ALL);
  });

  test("hidden samples are left out, order kept", () => {
    expect(ids(["S03", "S01"])).toEqual(["S02", "S04"]);
  });

  test("all hidden: empty", () => {
    expect(ids(ALL)).toEqual([]);
  });
});
