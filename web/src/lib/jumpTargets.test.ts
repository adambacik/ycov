import { describe, expect, test } from "vitest";

import { jumpTargetGroups } from "@/lib/jumpTargets";
import { REGIONS, SEQUENCE_CLASSES } from "@/test/annotations";

describe("jumpTargetGroups", () => {
  const groups = jumpTargetGroups({ classes: SEQUENCE_CLASSES, regions: REGIONS });

  test("class groups in mockup order, no empty or Other group, named regions last", () => {
    expect(groups.map((group) => group.label)).toEqual([
      "X-degenerate",
      "Ampliconic",
      "X-transposed",
      "Pseudoautosomal",
      "Heterochromatin / satellite",
      "Named regions",
    ]);
  });

  test("every class interval except OTHER appears once", () => {
    const classTargets = groups.slice(0, -1).flatMap((group) => group.targets);
    const notOther = SEQUENCE_CLASSES.filter((interval) => interval.name !== "OTHER");
    expect(classTargets).toHaveLength(notOther.length);
  });

  test("named regions in annotation order with name and Mb range", () => {
    const regions = groups.at(-1)?.targets.map((target) => target.label);
    expect(regions).toEqual([
      "PAR1 (0.00–2.46 Mb)",
      "AZFa (13.23–14.02 Mb)",
      "AZFb (18.73–26.49 Mb)",
      "AZFc (23.33–27.02 Mb)",
      "PAR2 (62.12–62.46 Mb)",
    ]);
  });

  test("values are unique although class names repeat", () => {
    const values = groups.flatMap((group) => group.targets.map((target) => target.value));
    expect(new Set(values).size).toBe(values.length);
  });

  test("target range is the interval", () => {
    const azfc = groups.at(-1)?.targets[3];
    expect(azfc?.range).toEqual({ start: 23_327_301, end: 27_020_249 });
  });

  test("no annotations give no groups", () => {
    expect(jumpTargetGroups({ classes: [], regions: [] })).toEqual([]);
  });
});
