import { useRef, type PointerEvent } from "react";

import { GenomeAxis } from "@/components/genome/GenomeAxis";
import { SequenceClassBar } from "@/components/genome/SequenceClassBar";
import { useViewDrag } from "@/hooks/useViewDrag";
import { PLOT_MARGIN } from "@/lib/constants";
import { formatBp } from "@/lib/format";
import { moveView } from "@/lib/viewRange";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/**
 * Sticky header of the track panel (mockup `.thead`): Mb axis and labelled sequence classes of
 * the region in view (FR33), above the plots of all samples. Same two columns as the track rows.
 * Dragging the axis or the classes pans the view: the genome follows the pointer, as in
 * the mockup, so dragging right shows what lies to the left.
 */
export function TrackHeader() {
  const { annotations, coverage } = useProjectData();
  const view = useViewStore((state) => state.view);
  const bounds = useViewStore((state) => state.bounds);

  const panRef = useRef<HTMLDivElement>(null);
  const drag = useViewDrag();

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    // main button only; a second finger does not take over a running drag
    if (pan === null || event.button !== 0 || drag.isDragging()) return;
    event.preventDefault(); // no text selection

    // no padding on this element: its width is the plot width below
    const width = pan.getBoundingClientRect().width;
    if (width === 0) return;
    const bpPerPx = (view.end - view.start) / width;
    const originView = view;
    drag.start(event, pan, (deltaPx) => moveView(originView, -deltaPx * bpPerPx, bounds));
  }

  return (
    <div className="sticky top-0 z-10 grid grid-cols-[var(--spacing-track-label)_minmax(0,1fr)] border-b border-input bg-muted">
      <div className="px-2 py-1 font-semibold">Sample</div>
      {/* padded by the Plotly margins, so axis and classes line up with the plots below */}
      <div
        className="pt-1 pb-0.5"
        style={{ paddingLeft: PLOT_MARGIN.left, paddingRight: PLOT_MARGIN.right }}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold">Region in view</span>
          <span className="font-mono text-small text-muted-foreground">
            window {formatBp(coverage.resolution)}
          </span>
        </div>
        {/* pan-y: on touch, a vertical swipe still scrolls the rows */}
        <div
          ref={panRef}
          className="cursor-grab touch-pan-y select-none active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          {...drag.handlers}
        >
          <GenomeAxis domain={view} labels="above" />
          <SequenceClassBar domain={view} intervals={annotations.classes} height={15} showLabels />
        </div>
      </div>
    </div>
  );
}
