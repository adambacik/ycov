import { LabeledValue } from "@/components/common/LabeledValue";
import { useProjectData } from "@/state/projectData";

/** "Project demo_cohort  Reference T2T-CHM13v2.0" from the project manifest. */
export function ProjectSummary() {
  const { project } = useProjectData();

  return (
    <span className="flex items-baseline gap-3">
      <LabeledValue label="Project">{project.name}</LabeledValue>
      <LabeledValue label="Reference">{project.reference}</LabeledValue>
    </span>
  );
}
