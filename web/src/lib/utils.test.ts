import { expect, test } from "vitest";
import { cn } from "@/lib/utils";

test.each([
  [["text-body", "text-foreground"], "text-body text-foreground"],
  [["text-body", "text-small"], "text-small"],
  [["h-control px-2.5", "h-5"], "px-2.5 h-5"],
  [["size-control", "size-7"], "size-7"],
  [["w-sidebar", "w-10"], "w-10"],
  [["shadow-menu", "shadow-sm"], "shadow-sm"],
  [["inset-shadow-pressed", "inset-shadow-none"], "inset-shadow-none"],
  [["bg-secondary", "bg-accent"], "bg-accent"],
  [["fill-seq-xdr", "fill-seq-par"], "fill-seq-par"],
])("%j -> %s", (input, expected) => {
  expect(cn(...input)).toBe(expected);
});
