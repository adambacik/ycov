import { useRef } from "react";

import { useElementWidth } from "@/hooks/useElementWidth";
import { toPercent, type GenomeRange } from "@/lib/genome";
import { placeTickLabels } from "@/lib/labels";
import { axisTicks } from "@/lib/ticks";

/** Axis width in px per labelled tick (mockup density). */
const PX_PER_LABEL = 95;

// Distances in px. Offsets are counted from the line towards the labels.
const HEIGHT = 26;
const LINE_INSET = 4; // free space on the side without labels
const MAJOR_TICK = 6;
const MINOR_TICK = 3;
const LABEL_CENTRE = 14;

interface GenomeAxisProps {
  /** part of the chromosome the axis spans, left to right edge */
  domain: GenomeRange;
  /** side of the line with ticks and labels: "below" in the overview, "above" in the track header */
  labels?: "below" | "above";
}

/** Mb axis of a genome range; as many round labelled ticks as the measured width allows. */
export function GenomeAxis({ domain, labels = "below" }: GenomeAxisProps) {
  const ref = useRef<SVGSVGElement>(null);
  const width = useElementWidth(ref);
  const { major, minor } = axisTicks(domain, width / PX_PER_LABEL);

  // .5: a 1 px line covers one row of pixels instead of half of two
  const lineY = (labels === "below" ? LINE_INSET : HEIGHT - LINE_INSET - 1) + 0.5;
  const direction = labels === "below" ? 1 : -1;

  // decorative: the numbers are available as text in the region input and on the slider
  return (
    <svg ref={ref} height={HEIGHT} aria-hidden className="block w-full overflow-visible">
      <g className="stroke-muted-foreground" shapeRendering="crispEdges">
        <line x1="0" x2="100%" y1={lineY} y2={lineY} />
        {minor.map((position) => {
          const x = `${toPercent(position, domain)}%`;
          return (
            <line key={position} x1={x} x2={x} y1={lineY} y2={lineY + direction * MINOR_TICK} />
          );
        })}
        {major.map(({ position }) => {
          const x = `${toPercent(position, domain)}%`;
          return (
            <line key={position} x1={x} x2={x} y1={lineY} y2={lineY + direction * MAJOR_TICK} />
          );
        })}
      </g>
      <g className="fill-muted-foreground font-mono text-caption">
        {placeTickLabels(major, domain, width).map(({ position, label, x, anchor }) => (
          <text
            key={position}
            x={x}
            y={lineY + direction * LABEL_CENTRE}
            textAnchor={anchor}
            dominantBaseline="central"
          >
            {label}
          </text>
        ))}
      </g>
    </svg>
  );
}
