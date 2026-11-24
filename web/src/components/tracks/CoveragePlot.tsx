import { useMemo, useRef } from "react";
import type { Data, Layout, Pattern, Shape } from "plotly.js";

import { PlotlyChart } from "@/components/common/PlotlyChart";
import { useElementWidth } from "@/hooks/useElementWidth";
import { PLOT_MARGIN, REL_COPY_RANGE } from "@/lib/constants";
import { coverageSteps } from "@/lib/coverageSteps";
import { maskedArea, type MaskKind } from "@/lib/maskedAreas";
import { BASE_CONFIG, baseLayout } from "@/lib/plotly";
import { readToken } from "@/lib/theme";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/** Smallest distance in px at which a bin still reacts to the mouse. */
const MIN_HOVER_DISTANCE = 5;

/** One array for all updates: Plotly recalculates the whole plot when it gets a new one. */
const COPY_TICKS = [0, 1, 2];

/** Dots over the PARs, 5 px apart with a radius of 1.1 px (mockup `mkDots`). */
const PAR_DOTS: Partial<Pattern> = { shape: ".", size: 5, solidity: (Math.PI * 1.1 ** 2) / 5 ** 2 };

/** Diagonal lines over gaps, 6 px apart and 1.1 px wide (mockup `mkPat`). */
const GAP_HATCH: Partial<Pattern> = { shape: "/", size: 6, solidity: 1.1 / 6 };

interface CoveragePlotProps {
  sampleId: string;
  /** coverage row of the sample, one value per bin of the loaded coverage */
  values: (number | null)[];
  /** true while the row is scrolled out of sight: do not redraw */
  paused: boolean;
}

/**
 * Horizontal line across the plot at a number of copies. A shape instead of the y-grid: the grid is
 * drawn over shapes and all its lines look the same, so it would hide the dotted one.
 */
function copyLine(copies: number, color: string, dash: "dot" | "solid"): Partial<Shape> {
  return {
    type: "line",
    layer: "below",
    xref: "paper",
    yref: "y",
    x0: 0,
    x1: 1,
    y0: copies,
    y1: copies,
    line: { width: 1, color, dash },
  };
}

/** Coverage of one sample in the region in view, as a step line in relative copies (FR33). */
export function CoveragePlot({ sampleId, values, paused }: CoveragePlotProps) {
  const { project, annotations, coverage } = useProjectData();
  const view = useViewStore((state) => state.view);
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref);

  // read once: reading the CSS tokens on every frame of a slider drag is slow
  const look = useMemo(
    () => ({
      layout: baseLayout(),
      lineColour: readToken("--coverage-line"),
      fillColour: readToken("--coverage-fill"),
      maskedColour: readToken("--masked"),
      parColour: readToken("--masked-par"),
      gapColour: readToken("--masked-gap"),
      referenceColour: readToken("--coverage-reference"),
      gridColour: readToken("--border"),
    }),
    [],
  );

  const shapes = useMemo<Partial<Shape>[]>(
    () => [
      copyLine(1, look.referenceColour, "dot"), // the expected value of a male sample
      copyLine(2, look.gridColour, "solid"),
    ],
    [look],
  );

  // masked windows, no relative copy there (FR59). Fill traces, because shapes have no patterns. The
  // whole chromosome for every view: Plotly moves them with the x-range
  const masks = useMemo<Data[]>(() => {
    const mask = (kind: MaskKind, pattern: Partial<Pattern>, colour: string): Data => ({
      type: "scatter",
      mode: "lines",
      ...maskedArea(annotations.masked, kind, REL_COPY_RANGE[1]),
      line: { width: 0 },
      fill: "toself",
      fillpattern: { ...pattern, bgcolor: look.maskedColour, fgcolor: colour },
      hoverinfo: "skip",
    });
    return [mask("par", PAR_DOTS, look.parColour), mask("gap", GAP_HATCH, look.gapColour)];
  }, [annotations.masked, look]);

  const data = useMemo<Data[]>(() => {
    const { starts, resolution, region } = coverage;
    const { x, line, fill, bins } = coverageSteps(starts, values, resolution, region, view);
    return [
      ...masks, // first = behind the coverage
      {
        type: "scatter", // SVG: browsers allow only ~16 WebGL plots per page
        mode: "lines",
        x,
        y: fill,
        line: { shape: "hvh", width: 0 },
        fill: "tozeroy",
        fillcolor: look.fillColour,
        hoverinfo: "skip",
      },
      {
        type: "scatter",
        mode: "lines",
        x,
        y: line,
        customdata: bins,
        line: { shape: "hvh", width: 1.2, color: look.lineColour },
        connectgaps: false, // gap and PAR stay empty
        hovertemplate:
          `${project.chromosome}:%{customdata[0]:,}-%{customdata[1]:,}<br>` +
          `%{y:.2f} copies<extra>${sampleId}</extra>`,
      },
    ];
  }, [project.chromosome, coverage, sampleId, values, view, look, masks]);

  const layout = useMemo<Partial<Layout>>(() => {
    // half a bin: the mouse finds its bin at every zoom, but nothing further inside a gap
    const plotWidth = width - PLOT_MARGIN.left - PLOT_MARGIN.right;
    const binWidth = (coverage.resolution / (view.end - view.start)) * plotWidth;
    return {
      ...look.layout,
      shapes,
      hovermode: "x",
      hoverdistance: Math.max(MIN_HOVER_DISTANCE, Math.ceil(binWidth / 2)),
      // no ticks: the track header has the axis
      xaxis: {
        ...look.layout.xaxis,
        range: [view.start, view.end],
        showticklabels: false,
        ticks: "",
      },
      yaxis: {
        ...look.layout.yaxis,
        range: [...REL_COPY_RANGE],
        tickvals: COPY_TICKS,
        ticklabeloverflow: "allow", // the box of the "0" is 1 px too low, Plotly would hide it
      },
    };
  }, [look, shapes, coverage.resolution, view, width]);

  return (
    <div ref={ref} className="size-full">
      <PlotlyChart
        data={data}
        layout={layout}
        config={BASE_CONFIG}
        paused={paused}
        className="size-full"
      />
    </div>
  );
}
