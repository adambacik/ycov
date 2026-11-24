import { describe, expect, test } from "vitest";

import { axisTicks, formatTick, niceStep } from "@/lib/ticks";
import { CHRY_LENGTH } from "@/test/annotations";

const WHOLE = { start: 0, end: CHRY_LENGTH };

describe("niceStep", () => {
  test.each([
    [1, 1],
    [1.4, 1],
    [1.5, 2],
    [3.4, 2],
    [3.5, 5],
    [7.4, 5],
    [7.5, 10],
    [13, 10],
    [2_600, 2_000],
    [4_200_000, 5_000_000],
    [8_000_000, 10_000_000],
  ])("%d -> %d", (raw, expected) => {
    expect(niceStep(raw)).toBe(expected);
  });

  test("always 1, 2 or 5 × a power of ten", () => {
    for (let raw = 1; raw < 1e8; raw *= 1.37) {
      const step = niceStep(raw);
      const mantissa = step / 10 ** Math.floor(Math.log10(step));
      expect([1, 2, 5]).toContain(Math.round(mantissa));
    }
  });
});

describe("formatTick", () => {
  test.each([
    [0, 5_000_000, "0"],
    [15_000_000, 5_000_000, "15 Mb"],
    [60_000_000, 10_000_000, "60 Mb"],
    [15_200_000, 200_000, "15.2 Mb"],
    [15_000_000, 100_000, "15.0 Mb"], // same decimals as its neighbours 14.9 and 15.1
    [15_250_000, 50_000, "15.25 Mb"],
    [15_010_000, 10_000, "15.01 Mb"],
    [15_005_000, 5_000, "15.005 Mb"],
  ])("%d at step %d -> %s", (position, step, expected) => {
    expect(formatTick(position, step)).toBe(expected);
  });
});

describe("axisTicks", () => {
  test("whole chrY at 1400 px: labels every 5 Mb, minor ticks every 1 Mb", () => {
    const { step, major, minor } = axisTicks(WHOLE, 1400 / 95);
    expect(step).toBe(5_000_000);
    expect(major.map((tick) => tick.label)).toEqual([
      "0",
      "5 Mb",
      "10 Mb",
      "15 Mb",
      "20 Mb",
      "25 Mb",
      "30 Mb",
      "35 Mb",
      "40 Mb",
      "45 Mb",
      "50 Mb",
      "55 Mb",
      "60 Mb",
    ]);
    expect(minor.slice(0, 5)).toEqual([1e6, 2e6, 3e6, 4e6, 6e6]); // 5 Mb is a major tick
    expect(minor).toHaveLength(63 - 13); // 0-62 Mb in 1 Mb steps, minus the major ticks
  });

  test("whole chrY at 500 px: labels every 10 Mb", () => {
    const { step, major } = axisTicks(WHOLE, 500 / 95);
    expect(step).toBe(10_000_000);
    expect(major.at(-1)?.label).toBe("60 Mb");
  });

  test("default view: ticks start at the first multiple inside the domain", () => {
    const { step, major } = axisTicks({ start: 2_458_320, end: 27_020_249 }, 1100 / 95);
    expect(step).toBe(2_000_000);
    expect(major[0]).toEqual({ position: 4_000_000, label: "4 Mb" });
    expect(major.at(-1)).toEqual({ position: 26_000_000, label: "26 Mb" });
  });

  test("ticks on both domain edges are included", () => {
    const { major } = axisTicks({ start: 10_000_000, end: 20_000_000 }, 5);
    expect(major.map((tick) => tick.position)).toEqual([10e6, 12e6, 14e6, 16e6, 18e6, 20e6]);
  });

  test("smallest view (100 kb): 10 kb steps with two decimals", () => {
    const { step, major } = axisTicks({ start: 15_000_000, end: 15_100_000 }, 1100 / 95);
    expect(step).toBe(10_000);
    expect(major[1]?.label).toBe("15.01 Mb");
  });

  test("every major tick is a multiple of the step inside the domain", () => {
    const domain = { start: 3_141_592, end: 9_265_358 };
    for (const width of [200, 500, 900, 1400, 2500]) {
      const { step, major, minor } = axisTicks(domain, width / 95);
      for (const { position } of major) {
        expect(position % step).toBe(0);
        expect(position).toBeGreaterThanOrEqual(domain.start);
        expect(position).toBeLessThanOrEqual(domain.end);
      }
      expect(major.length).toBeLessThanOrEqual(Math.max(2, width / 95) * 2); // about maxTicks
      expect(minor.every((position) => position % step !== 0)).toBe(true);
    }
  });

  test("empty domain or no measured width: no ticks", () => {
    const none = { step: 0, major: [], minor: [] };
    expect(axisTicks({ start: 5, end: 5 }, 10)).toEqual(none);
    expect(axisTicks(WHOLE, 0)).toEqual(none);
    expect(axisTicks(WHOLE, Number.NaN)).toEqual(none);
  });
});
