import { StatusMessage } from "@/components/common/StatusMessage";
import { AppLayout } from "@/components/layout/AppLayout";
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
      <AppLayout />
    </ProjectDataProvider>
  );
}
