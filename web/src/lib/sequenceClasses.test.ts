import { describe, expect, test } from "vitest";

import {
  SEQUENCE_CLASS_GROUPS,
  sequenceClassGroup,
  type SequenceClassGroup,
} from "@/lib/sequenceClasses";
import { SEQUENCE_CLASSES } from "@/test/annotations";

const BED_NAMES = [...new Set(SEQUENCE_CLASSES.map((interval) => interval.name))];

describe("sequenceClassGroup", () => {
  test("every class name of the bundled BED has a real group, only OTHER is other", () => {
    for (const name of BED_NAMES) {
      const group = sequenceClassGroup(name);
      if (name === "OTHER") expect(group).toBe("other");
      else expect(group, name).not.toBe("other");
    }
  });

  test.each([
    ["PAR1", "par"],
    ["XTR2", "xtr"],
    ["X-DEG", "xdr"],
    ["AMPL", "ampl"],
    ["DYZ19", "het"],
  ])("%s -> %s", (name, group) => {
    expect(sequenceClassGroup(name)).toBe(group);
  });

  test.each(["P1", "P5", "P8"])("palindrome %s -> pal", (name) => {
    expect(sequenceClassGroup(name)).toBe("pal");
  });

  test.each(["P0", "P9", "P10", "x-deg", "", "NEW", "toString", "constructor"])(
    "unknown %j -> other",
    (name) => {
      expect(sequenceClassGroup(name)).toBe("other");
    },
  );
});

describe("SEQUENCE_CLASS_GROUPS", () => {
  const groups = Object.entries(SEQUENCE_CLASS_GROUPS) as [SequenceClassGroup, unknown][];

  test.each(groups.map(([group]) => group))(
    "%s: complete class names (Tailwind must find them in the source)",
    (group) => {
      const style = SEQUENCE_CLASS_GROUPS[group];
      expect(style.fillClass).toBe(`fill-seq-${group}`);
      expect(style.bgClass).toBe(`bg-seq-${group}`);
    },
  );
});
