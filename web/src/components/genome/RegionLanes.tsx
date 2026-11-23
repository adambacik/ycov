import { useMemo, useRef } from "react";

import type { Interval } from "@/api/types";
import { useElementWidth } from "@/hooks/useElementWidth";
import { formatRange } from "@/lib/format";
import { assignLanes, clipToRange, toPercent, type GenomeRange } from "@/lib/genome";
import { barLabelSide, LABEL_PADDING } from "@/lib/labels";
import { cn } from "@/lib/utils";

// px
const LANE_HEIGHT = 9;
const LANE_GAP = 2;
const TOP_PADDING = 1; // room for the antialiased tops of the letters in the first lane
// text baseline below the bar top: the 8 px capitals fill the bar down to 1 px above its bottom
// (dominant-baseline "central" sits lower and cuts off the last row of white pixels)
const LABEL_BASELINE = 8;

interface RegionLanesProps {
  /** part of the chromosome the lanes span, left to right edge */
  domain: GenomeRange;
  /** named regions: PAR1/2, AZFa/b/c */
  regions: readonly Interval[];
}

/** Named regions as labelled bars, overlapping ones (AZFb, AZFc) stacked in lanes. */
export function RegionLanes({ domain, regions }: RegionLanesProps) {
  const ref = useRef<SVGSVGElement>(null);
  const width = useElementWidth(ref);
  // lanes from all regions, not the visible ones, so a region never changes its lane
  const { items, laneCount } = useMemo(() => assignLanes(regions), [regions]);

  return (
    <svg
      ref={ref}
      height={Math.max(0, TOP_PADDING + laneCount * (LANE_HEIGHT + LANE_GAP) - LANE_GAP)}
      role="img"
      aria-label="Named regions"
      className="block w-full overflow-visible"
    >
      {items.map((region) => {
        const visible = clipToRange(region, domain);
        if (visible === null) return null;
        const left = toPercent(visible.start, domain);
        const right = toPercent(visible.end, domain);
        const y = TOP_PADDING + region.lane * (LANE_HEIGHT + LANE_GAP);
        const side = barLabelSide(region.name, (left / 100) * width, (right / 100) * width);

        return (
          <g key={region.name}>
            <title>{`${region.name} ${formatRange(region)}`}</title>
            <rect
              x={`${left}%`}
              y={y}
              width={`${right - left}%`}
              height={LANE_HEIGHT}
              className="fill-region"
            />
            {width > 0 && (
              <text
                x={`${side === "right" ? right : left}%`}
                dx={side === "left" ? -LABEL_PADDING : LABEL_PADDING}
                y={y + LABEL_BASELINE}
                textAnchor={side === "left" ? "end" : "start"}
                className={cn(
                  "text-caption font-semibold",
                  side === "inside" ? "fill-region-foreground" : "fill-foreground",
                )}
              >
                {region.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
