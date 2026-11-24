import { describe, expect, test } from "vitest";

import {
  barLabelSide,
  estimateLabelWidth,
  LABEL_PADDING,
  labelFits,
  placeTickLabels,
} from "@/lib/labels";
import { axisTicks } from "@/lib/ticks";
import { CHRY_LENGTH } from "@/test/annotations";

describe("labelFits", () => {
  test("needs the text plus padding on both sides", () => {
    const needed = estimateLabelWidth("X-DEG") + 2 * LABEL_PADDING;
    expect(labelFits("X-DEG", needed)).toBe(true);
    expect(labelFits("X-DEG", needed - 1)).toBe(false);
  });

  test("is false before the width is measured", () => {
    expect(labelFits("X-DEG", 0)).toBe(false);
  });
});

describe("barLabelSide", () => {
  test("puts the label inside a wide bar", () => {
    expect(barLabelSide("AZFb", 400, 570)).toBe("inside");
  });

  test("puts the label left of a short bar", () => {
    expect(barLabelSide("AZFa", 296, 314)).toBe("left");
  });

  test("puts the label right of a short bar at the left edge", () => {
    expect(barLabelSide("PAR1", 0, 19)).toBe("right");
  });
});

describe("placeTickLabels", () => {
  const domain = { start: 0, end: 1_000 };

  test("centres labels on their ticks", () => {
    expect(placeTickLabels([{ position: 500, label: "15 Mb" }], domain, 800)).toEqual([
      { position: 500, label: "15 Mb", x: 400, anchor: "middle" },
    ]);
  });

  test("moves the first and last label inside the edges", () => {
    const ticks = [
      { position: 0, label: "15 Mb" },
      { position: 1_000, label: "16 Mb" },
    ];
    expect(placeTickLabels(ticks, domain, 800)).toEqual([
      { position: 0, label: "15 Mb", x: 0, anchor: "start" },
      { position: 1_000, label: "16 Mb", x: 800, anchor: "end" },
    ]);
  });

  test("drops a moved label that runs into its neighbour, on both edges", () => {
    // 8 characters = 54 px, ticks 60 px apart: the centred labels fit, the moved ones do not
    const ticks = [0, 250, 500, 750, 1_000].map((position) => ({ position, label: "15.25 Mb" }));
    const placed = placeTickLabels(ticks, domain, 240);
    expect(placed.map((label) => label.position)).toEqual([250, 500, 750]);
  });

  test("never lets labels overlap or leave the axis, for any view of a real axis", () => {
    const width = 1_000;
    for (const span of [100_000, 270_000, 1_300_000, 24_561_928, CHRY_LENGTH]) {
      for (let shift = 0; shift < 20; shift++) {
        const start = Math.round(((CHRY_LENGTH - span) * shift) / 20);
        const view = { start, end: start + span };
        const labels = placeTickLabels(axisTicks(view, width / 95).major, view, width);
        expect(labels.length).toBeGreaterThan(0);

        let previousRight = -Infinity;
        for (const { x, anchor, label } of labels) {
          const labelWidth = estimateLabelWidth(label);
          const offset = { start: 0, middle: labelWidth / 2, end: labelWidth }[anchor];
          expect(x - offset).toBeGreaterThanOrEqual(0);
          expect(x - offset + labelWidth).toBeLessThanOrEqual(width);
          expect(x - offset).toBeGreaterThan(previousRight);
          previousRight = x - offset + labelWidth;
        }
      }
    }
  });

  test("gives no labels without ticks", () => {
    expect(placeTickLabels([], domain, 0)).toEqual([]);
  });
});
