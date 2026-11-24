import { useRef } from "react";

import { Pane } from "@/components/common/Pane";
import { StatusMessage } from "@/components/common/StatusMessage";
import { SampleTrackRow } from "@/components/tracks/SampleTrackRow";
import { TrackHeader } from "@/components/tracks/TrackHeader";
import { visibleSamples } from "@/lib/sampleVisibility";
import { useProjectData } from "@/state/projectData";
import { useSampleStore } from "@/state/sampleStore";

/**
 * Container 5 (mockup `.main`): sticky region-in-view header and one coverage row per shown
 * sample, both in one scroll container, so a scrollbar narrows header and plots alike.
 */
export function TrackPanel() {
  const { samples } = useProjectData();
  const hidden = useSampleStore((state) => state.hidden);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shown = visibleSamples(samples, hidden);

  return (
    <Pane as="main" aria-label="Sample tracks" className="flex min-h-0 flex-col overflow-hidden">
      {/* stacked layout: limited height, so the header stays in sight while the rows scroll */}
      <div
        ref={scrollRef}
        className="relative max-h-[72dvh] min-h-0 flex-1 overflow-auto desktop:max-h-none"
      >
        {/* narrower than 760 px: scrolls sideways instead of squeezing the plots */}
        <div className="min-w-190">
          <TrackHeader />
          {shown.map((sample) => (
            <SampleTrackRow key={sample.sample_id} sample={sample} scrollRoot={scrollRef} />
          ))}
          {shown.length === 0 && (
            <StatusMessage>
              {samples.length === 0 ? "No samples in this project." : "No samples selected."}
            </StatusMessage>
          )}
        </div>
      </div>
    </Pane>
  );
}
