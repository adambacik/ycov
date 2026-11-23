import { Pane } from "@/components/common/Pane";
import { GenomeAxis } from "@/components/genome/GenomeAxis";
import { RegionLanes } from "@/components/genome/RegionLanes";
import { SequenceClassBar } from "@/components/genome/SequenceClassBar";
import { ViewportSlider } from "@/components/overview/ViewportSlider";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/**
 * Container 3 (mockup `.overview`): the whole chromosome with named regions, sequence classes
 * (FR33) and Mb axis, and the red viewport slider that selects the region in view.
 */
export function ChromosomeOverview() {
  const { project, annotations } = useProjectData();
  const bounds = useViewStore((state) => state.bounds);

  return (
    <Pane as="section" aria-label="Chromosome overview" className="col-span-full px-2.5 py-1.5">
      <h2 className="mb-0.5 font-semibold">{project.chromosome} overview</h2>
      {/* gaps of 4 and 2 px; ViewportSlider places its box from the bottom of this stack. The box
          and its white halo reach 4 px above the class bar, i.e. just up to the lanes */}
      <ViewportSlider>
        <RegionLanes domain={bounds} regions={annotations.regions} />
        <div className="mt-1 mb-0.5">
          <SequenceClassBar domain={bounds} intervals={annotations.classes} height={18} />
        </div>
        <GenomeAxis domain={bounds} />
      </ViewportSlider>
    </Pane>
  );
}
