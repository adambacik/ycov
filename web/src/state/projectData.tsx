/**
 * Server data of the open project: loaded once at start (hooks/useProjectLoader.ts), then
 * provided read-only to the whole page through a React context.
 */
import { createContext, useContext, type ReactNode } from "react";

import type { Coverage, ProjectInfo, SampleInfo, WindowAnnotations } from "@/api/types";

/** Everything the page shows that comes from the server; never changes while the page is open. */
export interface ProjectData {
  project: ProjectInfo;
  /** in manifest order, the order of the sidebar and the track rows */
  samples: SampleInfo[];
  annotations: WindowAnnotations;
  /** whole chromosome at COVERAGE_RESOLUTION, all samples */
  coverage: Coverage;
  /** sample id -> its row of coverage.values, built once */
  coverageRows: ReadonlyMap<string, (number | null)[]>;
}

// null = no provider above; useProjectData() turns that into a clear error
const ProjectDataContext = createContext<ProjectData | null>(null);

interface ProjectDataProviderProps {
  value: ProjectData;
  children: ReactNode;
}

/** Makes the loaded project available to every component below it. */
export function ProjectDataProvider({ value, children }: ProjectDataProviderProps) {
  return <ProjectDataContext value={value}>{children}</ProjectDataContext>; // React 19 syntax
}

/** The loaded project; only valid below ProjectDataProvider. */
// Provider and hook belong together. The rule only means an edit of this file reloads the page
// in dev instead of hot-swapping it.
// eslint-disable-next-line react-refresh/only-export-components
export function useProjectData(): ProjectData {
  const data = useContext(ProjectDataContext);
  if (data === null) throw new Error("useProjectData() used outside <ProjectDataProvider>");
  return data;
}
