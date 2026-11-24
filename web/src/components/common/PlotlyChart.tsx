import { useEffect, useRef } from "react";
import type { Config, Data, Layout } from "plotly.js";

import { drawQueue } from "@/lib/drawQueue";
import { Plotly } from "@/lib/plotly";

interface PlotlyChartProps {
  /** memoise data, layout and config: a new object means a Plotly update */
  data: Data[];
  layout: Partial<Layout>;
  config: Partial<Config>;
  /** true = keep the current picture, e.g. out of sight; drawn up to date when false again */
  paused?: boolean;
  /** must give the div a size, the plot fills it */
  className?: string;
}

/**
 * Mounts one Plotly figure into a div, updates it with Plotly.react and frees it on unmount. The
 * only component that calls the Plotly API. Draws through the shared queue, so many plots that
 * change at once do not block the page.
 */
export function PlotlyChart({ data, layout, config, paused = false, className }: PlotlyChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drawnRef = useRef(false);

  // draw and update: Plotly.react compares with the previous figure
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (paused && drawnRef.current) {
      drawQueue.cancel(element); // the first picture is always drawn, later ones can wait
      return;
    }
    drawQueue.request(element, () => {
      drawnRef.current = true;
      void Plotly.react(element, data, layout, config);
    });
  }, [data, layout, config, paused]);

  // follow the size of the div (window, layout changes), free the plot on unmount
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      // observe() reports the current size at once, the plot is already drawn in it
      if (first) {
        first = false;
        return;
      }
      // not drawn yet: the first draw takes the new size; Plotly rejects a resize of a hidden plot
      if (drawnRef.current && element.offsetParent !== null) void Plotly.Plots.resize(element);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      drawQueue.cancel(element);
      Plotly.purge(element);
      drawnRef.current = false;
    };
  }, []);

  return <div ref={ref} className={className} />;
}
