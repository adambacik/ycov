import { useRef, type RefObject } from "react";

import type { SampleInfo } from "@/api/types";
import { CoveragePlot } from "@/components/tracks/CoveragePlot";
import { SampleLabel } from "@/components/tracks/SampleLabel";
import { useInView } from "@/hooks/useInView";
import { useProjectData } from "@/state/projectData";

interface SampleTrackRowProps {
  sample: SampleInfo;
  /** the scroll container of the track panel */
  scrollRoot: RefObject<HTMLElement | null>;
}

/**
 * One sample of the track panel (mockup `.row`): label and coverage plot, same two columns as
 * TrackHeader. The plot is mounted when the row first comes near the screen and then stays, but it
 * follows the slider only while it is visible.
 */
export function SampleTrackRow({ sample, scrollRoot }: SampleTrackRowProps) {
  const { coverageRows } = useProjectData();
  const values = coverageRows.get(sample.sample_id);
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { root: scrollRoot, rootMargin: "200px 0px", once: true });
  const visible = useInView(ref, { root: scrollRoot });

  return (
    <div
      ref={ref}
      className="grid h-track-row grid-cols-[var(--spacing-track-label)_minmax(0,1fr)] border-b border-border"
    >
      <SampleLabel sample={sample} />
      <div className="min-h-0 min-w-0">
        {near && values !== undefined && (
          <CoveragePlot sampleId={sample.sample_id} values={values} paused={!visible} />
        )}
      </div>
    </div>
  );
}
