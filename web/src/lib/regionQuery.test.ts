import { describe, expect, test } from "vitest";

import { formatRegionLabel } from "@/lib/format";
import { parseRegionQuery } from "@/lib/regionQuery";
import { CHRY_LENGTH } from "@/test/annotations";

const parse = (text: string) => parseRegionQuery(text, "chrY", CHRY_LENGTH);
const range = (start: number, end: number) => ({ kind: "range", range: { start, end } });
const error = (message: string) => ({ kind: "error", message });

describe("parseRegionQuery", () => {
  test("reads back what the input shows (1-based inclusive → 0-based half-open)", () => {
    const view = { start: 2_458_320, end: 27_020_249 };
    expect(parse(formatRegionLabel("chrY", view))).toEqual({ kind: "range", range: view });
  });

  test.each([
    ["chrY:20000000-26000000", range(19_999_999, 26_000_000)],
    ["chrY:20,000,000-26,000,000", range(19_999_999, 26_000_000)],
    ["Y:1-100", range(0, 100)],
    ["chry:1-100", range(0, 100)],
    ["1-100", range(0, 100)],
    [" chrY : 1 - 100 ", range(0, 100)],
    ["chrY:1–100", range(0, 100)],
    ["chrY:20M-26M", range(19_999_999, 26_000_000)],
    ["chrY:20.5Mb-21mb", range(20_499_999, 21_000_000)],
    ["20-26 Mb", range(19_999_999, 26_000_000)],
    ["chrY:500k-1.5M", range(499_999, 1_500_000)],
    ["chrY:100bp-200bp", range(99, 200)],
    ["chrY:5-5", range(4, 5)],
  ])("%s", (text, expected) => {
    expect(parse(text)).toEqual(expected);
  });

  test("chromosome alone: the whole chromosome", () => {
    expect(parse("chrY")).toEqual(range(0, CHRY_LENGTH));
    expect(parse("y")).toEqual(range(0, CHRY_LENGTH));
  });

  test("one position: 0-based position to centre on", () => {
    expect(parse("chrY:15,000,000")).toEqual({ kind: "position", position: 14_999_999 });
    expect(parse("15M")).toEqual({ kind: "position", position: 14_999_999 });
  });

  test("end past the chromosome: cut to its length", () => {
    expect(parse("chrY:60M-70M")).toEqual(range(59_999_999, CHRY_LENGTH));
  });

  test.each(["", "AZFc", "DAZ1", "chrY:", "chrY:abc", "chrY:1-2-3", "chrY:-5", ":1-100"])(
    "unreadable: %j",
    (text) => {
      expect(parse(text)).toEqual(error("Type a region as chrY:start-end"));
    },
  );

  test("other chromosome", () => {
    expect(parse("chrX:1-100")).toEqual(error("Only chrY is in this project"));
  });

  test("start after end", () => {
    expect(parse("chrY:200-100")).toEqual(error("The start is after the end"));
  });

  test("position 0 (coordinates are 1-based)", () => {
    expect(parse("chrY:0-100")).toEqual(error("Positions start at 1"));
    expect(parse("chrY:0")).toEqual(error("Positions start at 1"));
  });

  test("start or position past the end", () => {
    const message = "chrY is 62,460,029 bp long";
    expect(parse("chrY:70M-80M")).toEqual(error(message));
    expect(parse("chrY:70M")).toEqual(error(message));
  });
});
