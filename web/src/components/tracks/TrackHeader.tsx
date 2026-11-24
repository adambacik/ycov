import { GenomeAxis } from "@/components/genome/GenomeAxis";
import { SequenceClassBar } from "@/components/genome/SequenceClassBar";
import { PLOT_MARGIN } from "@/lib/constants";
import { formatBp } from "@/lib/format";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/**
 * Sticky header of the track panel (mockup `.thead`): Mb axis and labelled sequence classes of
 * the region in view (FR33), above the plots of all samples. Same two columns as the track rows.
 */
export function TrackHeader() {
  const { annotations, coverage } = useProjectData();
  const view = useViewStore((state) => state.view);

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
        <GenomeAxis domain={view} labels="above" />
        <SequenceClassBar domain={view} intervals={annotations.classes} height={15} showLabels />
      </div>
    </div>
  );
}
