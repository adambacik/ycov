import { describe, expect, test } from "vitest";

import type { GenomeRange } from "@/lib/genome";
import {
  centreViewOn,
  clampView,
  dragView,
  moveView,
  resizeViewEnd,
  resizeViewStart,
  zoomView,
} from "@/lib/viewRange";
import { CHRY_LENGTH } from "@/test/annotations";

const BOUNDS = { start: 0, end: CHRY_LENGTH };
const MIN = 100_000;
const VIEW = { start: 10_000_000, end: 20_000_000 }; // span 10 Mb

const span = (view: GenomeRange) => view.end - view.start;

/** What every function must return: whole bases, inside BOUNDS, at least MIN long. */
function expectValid(view: GenomeRange) {
  expect(Number.isInteger(view.start) && Number.isInteger(view.end)).toBe(true);
  expect(view.start).toBeGreaterThanOrEqual(BOUNDS.start);
  expect(view.end).toBeLessThanOrEqual(BOUNDS.end);
  expect(span(view)).toBeGreaterThanOrEqual(MIN);
}

// drag distances from small to far past both ends, fractional like real pointer deltas
const DELTAS = [-1e9, -15_000_000.4, -9_999_999.5, -1, 0, 0.6, 123_456.7, 42_460_029, 1e9];

describe("clampView", () => {
  test("a valid view stays the same", () => {
    expect(clampView(VIEW, BOUNDS, MIN)).toEqual(VIEW);
  });

  test("past the left end: shifted in, span kept", () => {
    expect(clampView({ start: -500_000, end: 1_500_000 }, BOUNDS, MIN)).toEqual({
      start: 0,
      end: 2_000_000,
    });
  });

  test("past the right end: shifted in, span kept", () => {
    const view = { start: CHRY_LENGTH - 1_000_000, end: CHRY_LENGTH + 1_000_000 };
    expect(clampView(view, BOUNDS, MIN)).toEqual({
      start: CHRY_LENGTH - 2_000_000,
      end: CHRY_LENGTH,
    });
  });

  test("shorter than the minimum span: widened around its centre", () => {
    expect(clampView({ start: 5_000_000, end: 5_010_000 }, BOUNDS, MIN)).toEqual({
      start: 4_955_000,
      end: 5_055_000,
    });
  });

  test("short at an edge: widened, then shifted inside", () => {
    expect(clampView({ start: 0, end: 10 }, BOUNDS, MIN)).toEqual({ start: 0, end: MIN });
  });

  test("longer than the bounds: the bounds", () => {
    expect(clampView({ start: -1, end: 2 * CHRY_LENGTH }, BOUNDS, MIN)).toEqual(BOUNDS);
  });

  test("minimum span larger than the bounds: the bounds", () => {
    expect(clampView({ start: 10, end: 20 }, { start: 0, end: 50 }, MIN)).toEqual({
      start: 0,
      end: 50,
    });
  });

  test("reversed and fractional: ordered and rounded to whole bases", () => {
    expect(clampView({ start: 500_000.6, end: 200_000.2 }, BOUNDS, MIN)).toEqual({
      start: 200_000,
      end: 500_001,
    });
  });
});

describe("moveView", () => {
  test.each(DELTAS)("delta %d: span kept, view valid", (delta) => {
    const moved = moveView(VIEW, delta, BOUNDS);
    expect(span(moved)).toBe(span(VIEW));
    expectValid(moved);
  });

  test("moves by the delta, rounded", () => {
    expect(moveView(VIEW, 5_000_000.4, BOUNDS)).toEqual({ start: 15_000_000, end: 25_000_000 });
  });

  test("stops at both ends", () => {
    expect(moveView(VIEW, -1e9, BOUNDS)).toEqual({ start: 0, end: 10_000_000 });
    expect(moveView(VIEW, 1e9, BOUNDS)).toEqual({
      start: CHRY_LENGTH - 10_000_000,
      end: CHRY_LENGTH,
    });
  });
});

describe("zoomView", () => {
  test.each([0.5, 2, 0.001, 1000, 1])("factor %d: view valid", (factor) => {
    expectValid(zoomView(VIEW, factor, BOUNDS, MIN));
  });

  test("in and out around the centre", () => {
    expect(zoomView(VIEW, 0.5, BOUNDS, MIN)).toEqual({ start: 12_500_000, end: 17_500_000 });
    expect(zoomView(VIEW, 2, BOUNDS, MIN)).toEqual({ start: 5_000_000, end: 25_000_000 });
  });

  test("in stops at minSpan, out at the whole chromosome", () => {
    expect(span(zoomView(VIEW, 1e-6, BOUNDS, MIN))).toBe(MIN);
    expect(zoomView(VIEW, 1e6, BOUNDS, MIN)).toEqual(BOUNDS);
  });

  test("out near an edge: shifted inside, span still doubled", () => {
    expect(zoomView({ start: 0, end: 4_000_000 }, 2, BOUNDS, MIN)).toEqual({
      start: 0,
      end: 8_000_000,
    });
    const end = { start: CHRY_LENGTH - 4_000_000, end: CHRY_LENGTH };
    expect(zoomView(end, 2, BOUNDS, MIN)).toEqual({
      start: CHRY_LENGTH - 8_000_000,
      end: CHRY_LENGTH,
    });
  });

  test("in then out returns to the same view", () => {
    expect(zoomView(zoomView(VIEW, 0.5, BOUNDS, MIN), 2, BOUNDS, MIN)).toEqual(VIEW);
  });
});

describe("resizeViewStart", () => {
  test.each(DELTAS)("delta %d: right edge kept, view valid", (delta) => {
    const resized = resizeViewStart(VIEW, delta, BOUNDS, MIN);
    expect(resized.end).toBe(VIEW.end);
    expectValid(resized);
  });

  test("moves the left edge by the delta", () => {
    expect(resizeViewStart(VIEW, -2_000_000, BOUNDS, MIN)).toEqual({
      start: 8_000_000,
      end: 20_000_000,
    });
  });

  test("dragged past the right edge: stops MIN before it", () => {
    expect(resizeViewStart(VIEW, 50_000_000, BOUNDS, MIN)).toEqual({
      start: VIEW.end - MIN,
      end: VIEW.end,
    });
  });

  test("dragged past the chromosome start: stops at 0", () => {
    expect(resizeViewStart(VIEW, -1e9, BOUNDS, MIN)).toEqual({ start: 0, end: VIEW.end });
  });
});

describe("resizeViewEnd", () => {
  test.each(DELTAS)("delta %d: left edge kept, view valid", (delta) => {
    const resized = resizeViewEnd(VIEW, delta, BOUNDS, MIN);
    expect(resized.start).toBe(VIEW.start);
    expectValid(resized);
  });

  test("moves the right edge by the delta", () => {
    expect(resizeViewEnd(VIEW, 2_000_000, BOUNDS, MIN)).toEqual({
      start: 10_000_000,
      end: 22_000_000,
    });
  });

  test("dragged past the left edge: stops MIN after it", () => {
    expect(resizeViewEnd(VIEW, -50_000_000, BOUNDS, MIN)).toEqual({
      start: VIEW.start,
      end: VIEW.start + MIN,
    });
  });

  test("dragged past the chromosome end: stops at the end", () => {
    expect(resizeViewEnd(VIEW, 1e9, BOUNDS, MIN)).toEqual({
      start: VIEW.start,
      end: CHRY_LENGTH,
    });
  });
});

describe("centreViewOn", () => {
  test("in the middle: centred, span kept", () => {
    expect(centreViewOn(VIEW, 30_000_000, BOUNDS)).toEqual({ start: 25_000_000, end: 35_000_000 });
  });

  test("near the start: stops at 0", () => {
    expect(centreViewOn(VIEW, 1_000_000, BOUNDS)).toEqual({ start: 0, end: 10_000_000 });
  });

  test("near the end: stops at the end", () => {
    expect(centreViewOn(VIEW, CHRY_LENGTH - 1, BOUNDS)).toEqual({
      start: CHRY_LENGTH - 10_000_000,
      end: CHRY_LENGTH,
    });
  });

  test.each([0, 1, 5_000_000, 31_230_014.5, CHRY_LENGTH])("position %d: view valid", (position) => {
    const centred = centreViewOn(VIEW, position, BOUNDS);
    expect(span(centred)).toBe(span(VIEW));
    expectValid(centred);
  });
});

describe("dragView", () => {
  test("move shifts both edges", () => {
    expect(dragView("move", VIEW, 1_000_000, BOUNDS, MIN)).toEqual({
      start: 11_000_000,
      end: 21_000_000,
    });
  });

  test("resize-start shifts only the left edge", () => {
    expect(dragView("resize-start", VIEW, 1_000_000, BOUNDS, MIN)).toEqual({
      start: 11_000_000,
      end: 20_000_000,
    });
  });

  test("resize-end shifts only the right edge", () => {
    expect(dragView("resize-end", VIEW, 1_000_000, BOUNDS, MIN)).toEqual({
      start: 10_000_000,
      end: 21_000_000,
    });
  });
});
