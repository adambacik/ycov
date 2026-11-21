// Temporary stand-in for <AppLayout /> until step 6: shows that the loaded data arrives through
// ProjectDataProvider and the view through the store. Delete in step 6.
import { formatBp, formatRegionLabel } from "@/lib/format";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/** One-line summary of the loaded project and the current view (dev only). */
export function DataSummary() {
  const { project, samples, annotations, coverage, coverageRows } = useProjectData();
  const view = useViewStore((state) => state.view);

  return (
    <main className="flex flex-col gap-2 p-4">
      <p className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <strong className="text-brand">ycov</strong>
        <span>{project.name}</span>
        <span>{project.reference}</span>
        <span>
          {project.chromosome} · {formatBp(project.length)}
        </span>
        <span>{formatBp(project.window_size)} windows</span>
        <span>{samples.length} samples</span>
        <span>{annotations.classes.length} sequence classes</span>
        <span>
          {coverage.starts.length} bins of {formatBp(coverage.resolution)}, {coverageRows.size} rows
        </span>
        <span className="text-muted-foreground">v{project.ycov_version}</span>
      </p>
      <p className="font-mono">
        view {formatRegionLabel(project.chromosome, view)} · {formatBp(view.end - view.start)}
      </p>
    </main>
  );
}
