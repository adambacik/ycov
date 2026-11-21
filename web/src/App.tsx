import { StatusMessage } from "@/components/common/StatusMessage";
import { DataSummary } from "@/dev/DataSummary";
import { useProjectLoader } from "@/hooks/useProjectLoader";
import { ProjectDataProvider } from "@/state/projectData";

/** Loads the project once, shows loading/error until it is there, then the viewer. */
export function App() {
  const load = useProjectLoader();

  if (load.status === "loading") {
    return <StatusMessage>Loading project…</StatusMessage>;
  }
  if (load.status === "error") {
    return <StatusMessage tone="error">Could not load the project: {load.message}</StatusMessage>;
  }
  return (
    <ProjectDataProvider value={load.data}>
      <DataSummary /> {/* replaced by <AppLayout /> in step 6 */}
    </ProjectDataProvider>
  );
}
