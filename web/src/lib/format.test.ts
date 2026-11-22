import { describe, expect, test } from "vitest";

import {
  formatBp,
  formatDepth,
  formatMbRange,
  formatPosition,
  formatRegionLabel,
} from "@/lib/format";

describe("formatBp", () => {
  test.each([
    [0, "0 bp"],
    [640, "640 bp"],
    [999, "999 bp"],
    [999.4, "999 bp"], // fractional input is rounded, not shown with decimals
    [999.6, "1 kb"], // rounds up into the next unit
    [1_000, "1 kb"],
    [2_500, "2.5 kb"],
    [10_000, "10 kb"],
    [12_345, "12.3 kb"],
    [999_900, "999.9 kb"],
    [999_960, "1.00 Mb"], // would round to "1000 kb"
    [1_000_000, "1.00 Mb"],
    [24_560_000, "24.56 Mb"],
    [62_460_029, "62.46 Mb"],
  ])("%d -> %s", (bp, expected) => {
    expect(formatBp(bp)).toBe(expected);
  });
});

describe("formatPosition", () => {
  test.each([
    [0, "0"],
    [999, "999"],
    [1_000, "1,000"],
    [2_458_321, "2,458,321"],
    [62_460_029, "62,460,029"],
    [2_458_321.6, "2,458,322"],
  ])("%d -> %s", (position, expected) => {
    expect(formatPosition(position)).toBe(expected);
  });
});

describe("formatRegionLabel", () => {
  test("0-based half-open range -> 1-based inclusive label", () => {
    expect(formatRegionLabel("chrY", { start: 2_458_320, end: 27_020_249 })).toBe(
      "chrY:2,458,321-27,020,249",
    );
  });

  test("whole chromosome starts at 1", () => {
    expect(formatRegionLabel("chrY", { start: 0, end: 62_460_029 })).toBe("chrY:1-62,460,029");
  });

  test("a single base has the same start and end", () => {
    expect(formatRegionLabel("chrY", { start: 99, end: 100 })).toBe("chrY:100-100");
  });
});

describe("formatMbRange", () => {
  test("two decimals and an en dash", () => {
    expect(formatMbRange({ start: 23_327_301, end: 27_020_249 })).toBe("23.33–27.02 Mb");
  });

  test("start of the chromosome", () => {
    expect(formatMbRange({ start: 0, end: 2_458_320 })).toBe("0.00–2.46 Mb");
  });
});

describe("formatDepth", () => {
  test.each([
    [30.14, "30.1×"],
    [29.85, "29.9×"],
    [30, "30.0×"],
    [0, "0.0×"],
  ])("%d -> %s", (depth, expected) => {
    expect(formatDepth(depth)).toBe(expected);
  });
});
