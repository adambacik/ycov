import { useRef } from "react";

import type { Interval } from "@/api/types";
import { useElementWidth } from "@/hooks/useElementWidth";
import { formatRange } from "@/lib/format";
import { clipToRange, toPercent, type GenomeRange } from "@/lib/genome";
import { labelFits } from "@/lib/labels";
import { SEQUENCE_CLASS_GROUPS, sequenceClassGroup } from "@/lib/sequenceClasses";
import { cn } from "@/lib/utils";

interface SequenceClassBarProps {
  /** part of the chromosome the bar spans, left to right edge */
  domain: GenomeRange;
  /** sequence classes along the chromosome, ordered by start */
  intervals: readonly Interval[];
  /** bar height in px */
  height: number;
  /** class names inside the intervals that are wide enough */
  showLabels?: boolean;
}

/** Coloured band of the sequence classes in a genome range; hover shows name and coordinates. */
export function SequenceClassBar({
  domain,
  intervals,
  height,
  showLabels = false,
}: SequenceClassBarProps) {
  const ref = useRef<SVGSVGElement>(null);
  const width = useElementWidth(ref);

  return (
    <svg
      ref={ref}
      height={height}
      role="img"
      aria-label="Sequence classes"
      className="block w-full"
    >
      {intervals.map((interval) => {
        const visible = clipToRange(interval, domain);
        if (visible === null) return null;
        const left = toPercent(visible.start, domain);
        const share = toPercent(visible.end, domain) - left; // percent of the bar width
        const { fillClass, labelClass } = SEQUENCE_CLASS_GROUPS[sequenceClassGroup(interval.name)];

        return (
          <g key={interval.start}>
            {/* the whole interval, also when only a part is in view */}
            <title>{`${interval.name} ${formatRange(interval)}`}</title>
            {/* 1 px wider, the next interval is drawn over it: no background shining through
                where two antialiased edges meet */}
            <rect
              x={`${left}%`}
              height={height}
              className={fillClass}
              style={{ width: `calc(${share}% + 1px)` }}
            />
            {showLabels && labelFits(interval.name, (share / 100) * width) && (
              <text
                x={`${left + share / 2}%`}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className={cn("text-caption font-medium", labelClass)}
              >
                {interval.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
