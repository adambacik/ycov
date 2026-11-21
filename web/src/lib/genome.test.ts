import { describe, expect, test } from "vitest";

import type { WindowAnnotations } from "@/api/types";
import { assignLanes, clipToRange, initialView, toPercent } from "@/lib/genome";
import { CHRY_LENGTH, REGIONS, SEQUENCE_CLASSES } from "@/test/annotations";

const ANNOTATIONS: WindowAnnotations = {
  chromosome: "chrY",
  length: CHRY_LENGTH,
  window_size: 1_000,
  classes: SEQUENCE_CLASSES,
  regions: REGIONS,
  masked: [],
};

describe("toPercent", () => {
  const domain = { start: 1_000, end: 3_000 };

  test.each([
    [1_000, 0],
    [2_000, 50],
    [3_000, 100],
    [500, -25], // outside the domain is not clipped
  ])("%d -> %d %", (position, expected) => {
    expect(toPercent(position, domain)).toBe(expected);
  });
});

describe("clipToRange", () => {
  const domain = { start: 100, end: 200 };

  test("inside: unchanged", () => {
    expect(clipToRange({ name: "a", start: 120, end: 180 }, domain)).toEqual({
      name: "a",
      start: 120,
      end: 180,
    });
  });

  test("overlapping an edge: cut to the domain, other fields kept", () => {
    expect(clipToRange({ name: "a", start: 50, end: 150 }, domain)).toEqual({
      name: "a",
      start: 100,
      end: 150,
    });
    expect(clipToRange({ name: "b", start: 0, end: 999 }, domain)).toEqual({
      name: "b",
      start: 100,
      end: 200,
    });
  });

  test("outside or only touching (half-open): null", () => {
    expect(clipToRange({ start: 0, end: 50 }, domain)).toBeNull();
    expect(clipToRange({ start: 0, end: 100 }, domain)).toBeNull();
    expect(clipToRange({ start: 200, end: 300 }, domain)).toBeNull();
  });
});

describe("assignLanes", () => {
  test("real regions: AZFc overlaps AZFb and gets lane 1, the rest lane 0", () => {
    const { items, laneCount } = assignLanes(REGIONS);
    const laneOf = Object.fromEntries(items.map((item) => [item.name, item.lane]));
    expect(laneOf).toEqual({ PAR1: 0, AZFa: 0, AZFb: 0, AZFc: 1, PAR2: 0 });
    expect(laneCount).toBe(2);
  });

  test("touching intervals share a lane", () => {
    const { items, laneCount } = assignLanes([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
    ]);
    expect(items.map((item) => item.lane)).toEqual([0, 0]);
    expect(laneCount).toBe(1);
  });

  test("a free lane is reused: the first lane whose last end is at or before the start", () => {
    const { items, laneCount } = assignLanes([
      { start: 0, end: 100 }, // lane 0
      { start: 10, end: 20 }, // lane 1
      { start: 15, end: 30 }, // lanes 0 and 1 busy -> lane 2
      { start: 25, end: 40 }, // lane 1 free again (ended at 20)
    ]);
    expect(items.map((item) => item.lane)).toEqual([0, 1, 2, 1]);
    expect(laneCount).toBe(3);
  });

  test("unsorted input: sorted by start, input array not changed", () => {
    const input = [
      { name: "late", start: 50, end: 60 },
      { name: "early", start: 0, end: 10 },
    ];
    const { items } = assignLanes(input);
    expect(items.map((item) => item.name)).toEqual(["early", "late"]);
    expect(input.map((item) => item.name)).toEqual(["late", "early"]);
  });

  test("no intervals: no lanes", () => {
    expect(assignLanes([])).toEqual({ items: [], laneCount: 0 });
  });
});

describe("initialView", () => {
  test("real regions: end of PAR1 to end of AZFc", () => {
    expect(initialView(ANNOTATIONS)).toEqual({ start: 2_458_320, end: 27_020_249 });
  });

  test.each(["PAR1", "AZFc"])("without %s: the whole chromosome", (missing) => {
    const regions = REGIONS.filter((region) => region.name !== missing);
    expect(initialView({ ...ANNOTATIONS, regions })).toEqual({ start: 0, end: CHRY_LENGTH });
  });
});
