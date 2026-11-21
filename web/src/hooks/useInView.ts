import { useEffect, useState, type RefObject } from "react";

interface InViewOptions {
  /**
   * The scroll container the element scrolls in. Needed for rootMargin to work inside it:
   * without a root the margin only widens the browser window, and an element clipped by a
   * scrolling parent counts as hidden until it actually scrolls into sight.
   */
  root?: RefObject<Element | null>;
  /** Grow the visible area, e.g. "200px 0px" = start 200 px before the element scrolls in. */
  rootMargin?: string;
  /** Stay true after the first time the element was in view and stop observing it. */
  once?: boolean;
}

/**
 * Whether an element is in (or, with rootMargin, near) the visible area, via an
 * IntersectionObserver. With `once`, used to mount a Plotly plot only when its track row comes
 * near the screen and keep it mounted afterwards.
 *
 * The element (and root) must be rendered from the first render on (refs are read on mount).
 */
export function useInView(
  ref: RefObject<Element | null>,
  { root, rootMargin, once = false }: InViewOptions = {},
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        if (!once) {
          setInView(entry.isIntersecting);
        } else if (entry.isIntersecting) {
          // never back to false, also not when the effect re-runs (StrictMode, new options)
          setInView(true);
          observer.disconnect();
        }
      },
      { root: root?.current ?? null, rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, root, rootMargin, once]);

  return inView;
}
