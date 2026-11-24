import { describe, expect, it } from "vitest";

import { maskedArea, maskKind } from "@/lib/maskedAreas";

const MASKED = [
  { name: "par", start: 0, end: 10 },
  { name: "gap", start: 40, end: 50 },
  { name: "par", start: 90, end: 100 },
];

describe("maskKind", () => {
  it("tells the PARs from gaps", () => {
    expect(MASKED.map(maskKind)).toEqual(["par", "gap", "par"]);
  });

  it("treats an unknown reason as a gap", () => {
    expect(maskKind({ name: "blacklist", start: 0, end: 1 })).toBe("gap");
  });
});

describe("maskedArea", () => {
  it("makes one rectangle per interval, separated by null", () => {
    expect(maskedArea(MASKED, "par", 2)).toEqual({
      x: [0, 0, 10, 10, null, 90, 90, 100, 100],
      y: [0, 2, 2, 0, null, 0, 2, 2, 0],
    });
  });

  it("takes only the intervals of the kind", () => {
    expect(maskedArea(MASKED, "gap", 2).x).toEqual([40, 40, 50, 50]);
  });

  it("is empty without intervals of the kind", () => {
    expect(maskedArea([], "gap", 2)).toEqual({ x: [], y: [] });
  });
});
