/**
 * Read design tokens from styles/globals.css at runtime, for code that needs real values instead
 * of Tailwind classes (Plotly takes colour strings and font sizes in px). Browser only.
 */

/**
 * Value of a CSS custom property on :root, e.g. readToken("--seq-xdr") -> "#009e73".
 * Throws for an unknown name: a typo would otherwise silently give Plotly an empty colour.
 */
export function readToken(name: `--${string}`): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (value === "") throw new Error(`CSS token ${name} is not defined in styles/globals.css`);
  return value;
}

/** A size token in px, e.g. readTokenPx("--text-caption") -> 11 (0.6875rem × 16 px). */
export function readTokenPx(name: `--${string}`): number {
  const value = readToken(name);
  const number = Number.parseFloat(value);
  if (value.endsWith("rem")) {
    const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    return number * rootSize;
  }
  if (value.endsWith("px")) return number;
  throw new Error(`CSS token ${name} is "${value}", expected a rem or px size`);
}
