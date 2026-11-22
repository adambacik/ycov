import { LabeledValue } from "@/components/common/LabeledValue";
import { Pane } from "@/components/common/Pane";
import { useProjectData } from "@/state/projectData";

/** Container 1: logo, project info and the global parameter controls (mockup `.top`). */
export function TopBar() {
  const { project } = useProjectData();

  // step 7: ProjectSummary, ReadsToggle, NormalisationSelect, ExportMenu
  return (
    <Pane
      as="header"
      aria-label="Project and parameters"
      className="col-span-full flex items-center gap-4.5 px-2.5 py-1.5 whitespace-nowrap"
    >
      <span className="text-brand font-bold">ycov</span>
      <LabeledValue label="Project">{project.name}</LabeledValue>
      <LabeledValue label="Reference">{project.reference}</LabeledValue>
    </Pane>
  );
}
