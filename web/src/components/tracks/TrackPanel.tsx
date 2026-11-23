import { Pane } from "@/components/common/Pane";
import { TrackHeader } from "@/components/tracks/TrackHeader";

/**
 * Container 5 (mockup `.main`): sticky region-in-view header and one coverage row per sample,
 * both in one scroll container, so a scrollbar narrows header and plots alike.
 */
export function TrackPanel() {
  // step 12: SampleTrackRow for each of visibleSamples(samples, hidden) below the header
  return (
    <Pane as="main" aria-label="Sample tracks" className="flex min-h-0 flex-col overflow-hidden">
      {/* stacked layout: limited height, so the header stays in sight while the rows scroll */}
      <div className="relative max-h-[72dvh] min-h-0 flex-1 overflow-auto desktop:max-h-none">
        {/* narrower than 760 px: scrolls sideways instead of squeezing the plots */}
        <div className="min-w-190">
          <TrackHeader />
        </div>
      </div>
    </Pane>
  );
}
