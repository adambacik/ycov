import { Pane } from "@/components/common/Pane";

/** Container 5: sticky region-in-view header and one coverage row per sample (mockup `.main`). */
export function TrackPanel() {
  // step 11: scroll container with TrackHeader; step 12: SampleTrackRow per sample
  return (
    <Pane as="main" aria-label="Sample tracks" className="flex min-h-0 flex-col overflow-hidden">
      <p className="px-2.5 py-1.5 text-muted-foreground">Sample tracks</p>
    </Pane>
  );
}
