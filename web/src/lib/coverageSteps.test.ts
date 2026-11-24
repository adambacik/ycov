import { describe, expect, it } from "vitest";

import { coverageSteps } from "@/lib/coverageSteps";

const REGION = { start: 0, end: 1_000 };

describe("coverageSteps", () => {
  it("draws a run from its first to its last bin edge, with the centres between", () => {
    const { x, line } = coverageSteps([0, 10, 20], [1, 2, 3], 10, REGION, REGION);
    expect(x).toEqual([0, 0, 5, 15, 25, 30, 30]);
    expect(line).toEqual([null, 1, 1, 2, 3, 3, null]);
  });

  it("interrupts the line at a gap and draws the bins next to it in full width", () => {
    const { x, line } = coverageSteps([0, 10, 20, 30], [1, null, null, 2], 10, REGION, REGION);
    expect(x).toEqual([0, 0, 5, 10, 10, 30, 30, 35, 40, 40]);
    expect(line).toEqual([null, 1, 1, 1, null, null, 2, 2, 2, null]);
  });

  it("drops the fill to 0 in a gap instead of leaving it empty", () => {
    const { x, fill } = coverageSteps([0, 10, 20], [1, null, 2], 10, REGION, REGION);
    expect(x).toEqual([0, 0, 5, 10, 10, 20, 20, 25, 30, 30]);
    expect(fill).toEqual([0, 1, 1, 1, 0, 0, 2, 2, 2, 0]);
  });

  it("keeps a measured 0 apart from a gap", () => {
    const { line } = coverageSteps([0, 10], [0, 1], 10, REGION, REGION);
    expect(line).toEqual([null, 0, 0, 1, 1, null]);
  });

  it("gives every point the 1-based inclusive range of its bin", () => {
    const { bins } = coverageSteps([20], [1], 10, REGION, REGION);
    expect(bins).toHaveLength(5);
    expect(new Set(bins.map(String))).toEqual(new Set(["21,30"]));
  });

  it("ends a shorter last bin at the end of the region", () => {
    const { x, bins } = coverageSteps([0, 10], [1, 1], 10, { start: 0, end: 14 }, REGION);
    expect(x).toEqual([0, 0, 5, 12, 14, 14]);
    expect(bins.at(-1)).toEqual([11, 14]);
  });

  it("gives no points for a sample without values", () => {
    expect(coverageSteps([0, 10], [null, null], 10, REGION, REGION).x).toEqual([]);
  });

  it("leaves out bins that are not in view, except one on each side", () => {
    const starts = [0, 10, 20, 30, 40, 50];
    const { x, line } = coverageSteps(starts, [1, 2, 3, 4, 5, 6], 10, REGION, {
      start: 20,
      end: 40,
    });
    // no edge points: bins 10-20 and 40-50 have neighbours with values, only not in view
    expect(x).toEqual([15, 25, 35, 45]);
    expect(line).toEqual([2, 3, 4, 5]);
  });
});
