import { Pane } from "@/components/common/Pane";
import { useProjectData } from "@/state/projectData";

/** Container 3: the whole chromosome with regions, sequence classes and the viewport slider. */
export function ChromosomeOverview() {
  const { project } = useProjectData();

  // step 9: RegionLanes, SequenceClassBar, GenomeAxis and ViewportSlider inside a ruler box
  return (
    <Pane as="section" aria-label="Chromosome overview" className="col-span-full px-2.5 py-1.5">
      <h2 className="mb-0.5 font-semibold">{project.chromosome} overview</h2>
      <p className="text-muted-foreground">Region lanes, sequence classes, axis and slider</p>
    </Pane>
  );
}
