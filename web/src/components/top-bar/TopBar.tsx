import { Pane } from "@/components/common/Pane";
import { ExportMenu } from "@/components/top-bar/ExportMenu";
import { NormalisationSelect } from "@/components/top-bar/NormalisationSelect";
import { ProjectSummary } from "@/components/top-bar/ProjectSummary";
import { ReadsToggle } from "@/components/top-bar/ReadsToggle";
import { useProjectData } from "@/state/projectData";

/**
 * Container 1 (mockup `.top`): logo, project info, the global parameters and Export.
 * One line on a wide window; wraps into a second line when it does not fit.
 */
export function TopBar() {
  const { project } = useProjectData();

  return (
    <Pane
      as="header"
      aria-label="Project and parameters"
      className="col-span-full flex flex-wrap items-center gap-x-4.5 gap-y-1.5 px-2.5 py-1.5 whitespace-nowrap"
    >
      <span title={`ycov v${project.ycov_version}`} className="text-brand font-bold">
        ycov
      </span>
      <ProjectSummary />
      <div
        role="group"
        aria-label="Parameters"
        className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5"
      >
        <ReadsToggle />
        <NormalisationSelect />
      </div>
      <ExportMenu className="ml-auto" />
    </Pane>
  );
}
