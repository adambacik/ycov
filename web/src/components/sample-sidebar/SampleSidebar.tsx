import { useMemo } from "react";

import { Pane } from "@/components/common/Pane";
import { SampleListItem } from "@/components/sample-sidebar/SampleListItem";
import { Button } from "@/components/ui/button";
import { visibleSamples } from "@/lib/sampleVisibility";
import { useProjectData } from "@/state/projectData";
import { useSampleStore } from "@/state/sampleStore";

/**
 * Container 4 (mockup `.side`): all samples in manifest order, ticked = shown in the tracks
 * (FR42). Only the list scrolls. Search, sort, group and filters come above it in Phase 3.
 */
export function SampleSidebar() {
  const { samples } = useProjectData();
  const hidden = useSampleStore((state) => state.hidden);
  const show = useSampleStore((state) => state.show);
  const hide = useSampleStore((state) => state.hide);
  const invert = useSampleStore((state) => state.invert);

  // Phase 3: only the samples that match the filters
  const ids = useMemo(() => samples.map((sample) => sample.sample_id), [samples]);
  const shownCount = visibleSamples(samples, hidden).length;

  return (
    <Pane
      as="aside"
      aria-label="Samples"
      // stacked layout: limited height so the tracks below stay reachable (mockup 460 px)
      className="flex max-h-115 min-h-0 flex-col overflow-hidden desktop:max-h-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-1 px-2.5 pt-1.5 pb-1">
        <h2 className="font-semibold whitespace-nowrap">
          Samples{" "}
          <span className="font-normal text-muted-foreground">
            ({shownCount}/{samples.length})
          </span>
        </h2>
        <div role="group" aria-label="Choose samples" className="flex gap-0.75">
          <Button size="sm" title="Show all samples" onClick={() => show(ids)}>
            All
          </Button>
          <Button size="sm" title="Hide all samples" onClick={() => hide(ids)}>
            None
          </Button>
          <Button size="sm" title="Swap shown and hidden samples" onClick={() => invert(ids)}>
            Invert
          </Button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-auto border-t border-border pb-1">
        {samples.map((sample) => (
          <SampleListItem key={sample.sample_id} sample={sample} />
        ))}
      </ul>
    </Pane>
  );
}
