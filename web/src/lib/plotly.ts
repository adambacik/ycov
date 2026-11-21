/**
 * The one Plotly import of the app plus the look shared by all plots: fonts, colours, margins
 * and interaction settings, so every plot (coverage rows now, Phase 3 cohort plots later)
 * looks the same. Colours and fonts come from the CSS tokens via lib/theme.ts.
 */
import Plotly from "plotly.js-dist-min";
import type { Config, Layout, LayoutAxis } from "plotly.js";

import { PLOT_MARGIN } from "@/lib/constants";
import { readToken, readTokenPx } from "@/lib/theme";

export { Plotly };

/**
 * Plots are static pictures: no toolbar, no zoom by wheel or double click. responsive is off
 * because common/PlotlyChart resizes each plot with its own ResizeObserver, which also sees
 * sidebar and layout changes; Plotly's own window listener would resize every plot twice.
 */
export const BASE_CONFIG: Partial<Config> = {
  displayModeBar: false,
  responsive: false,
  scrollZoom: false,
  doubleClick: false,
  showTips: false,
};

/** Axis look shared by x and y; a plot spreads it and adds range, ticks etc. */
function baseAxis(): Partial<LayoutAxis> {
  return {
    fixedrange: true,
    zeroline: false,
    showgrid: false,
    gridcolor: readToken("--border"),
    linecolor: readToken("--border"),
    tickcolor: readToken("--border"),
  };
}

/**
 * Layout shared by all plots. A function, not a constant: the tokens can only be read once the
 * stylesheet is loaded, and a function always returns fresh objects that a plot can extend.
 */
export function baseLayout(): Partial<Layout> {
  const monoFont = {
    family: readToken("--font-mono"),
    size: readTokenPx("--text-caption"),
    color: readToken("--muted-foreground"),
  };
  return {
    font: monoFont,
    margin: {
      l: PLOT_MARGIN.left,
      r: PLOT_MARGIN.right,
      t: PLOT_MARGIN.top,
      b: PLOT_MARGIN.bottom,
    },
    autosize: true, // size from the CSS box of the plot div
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    showlegend: false,
    dragmode: false,
    hoverlabel: {
      bgcolor: readToken("--tooltip"),
      bordercolor: readToken("--input"),
      font: { ...monoFont, color: readToken("--foreground") },
    },
    xaxis: baseAxis(),
    yaxis: baseAxis(),
  };
}
