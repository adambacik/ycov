import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Width of an element in px, kept up to date with a ResizeObserver (window resize, sidebar,
 * layout changes). Used where drawing depends on real pixels: axis tick density, whether a
 * label fits into its bar. Measures the border box, so measure an element without padding
 * or border to get its drawing width. 0 until the element is mounted.
 *
 * The element must be rendered from the first render on (the ref is read once on mount).
 */
export function useElementWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(0);

  // layout effect: the first measurement lands before the browser paints, so an axis never
  // shows one frame without ticks
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    setWidth(element.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => {
      const size = entry?.borderBoxSize[0];
      if (size !== undefined) setWidth(size.inlineSize); // same width again = no re-render
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
