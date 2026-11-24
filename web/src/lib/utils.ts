import { createCn } from "cn/config";

/**
 * Custom theme names from styles/globals.css (@theme). Keep in sync with that file:
 * a token missing here is not recognised as a Tailwind class by cn().
 */
const THEME = {
  /** --text-*: font sizes (Tailwind's default scale is removed) */
  fontSizes: ["caption", "small", "body", "title", "brand"],
  /** --spacing-*: named sizes (h-control, w-sidebar, h-track-row, …) */
  spacing: ["control", "sidebar", "track-label", "track-row"],
  /** --shadow-* and --inset-shadow-* */
  shadows: ["menu"],
  insetShadows: ["pressed"],
};

/**
 * Join class names and resolve Tailwind conflicts, the later class wins:
 * cn("h-control px-2.5", isSmall && "h-5") -> "px-2.5 h-5".
 *
 * Configured with our theme names. Without it cn() reads "text-body" as a text
 * colour and drops it next to "text-foreground", and does not merge "h-control"
 * with "h-5".
 */
export const cn = createCn({
  extend: {
    theme: {
      text: THEME.fontSizes,
      spacing: THEME.spacing,
      shadow: THEME.shadows,
      "inset-shadow": THEME.insetShadows,
    },
  },
});
