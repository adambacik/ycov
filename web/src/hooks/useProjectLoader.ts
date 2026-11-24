import { useEffect, useState } from "react";

import { getCoverage, getProject, getSamples, getWindows } from "@/api/client";
import type { Coverage, SampleInfo } from "@/api/types";
import { COVERAGE_RESOLUTION } from "@/lib/constants";
import { initialView } from "@/lib/genome";
import type { ProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/** What the app knows about the project: still loading, failed, or loaded. */
export type ProjectLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProjectData };

/**
 * Load everything the page needs once on start: project, samples, window annotations and the
 * coverage of the whole chromosome at COVERAGE_RESOLUTION, as four parallel requests. On
 * success the view store is initialised (whole chromosome, initialView) before "ready".
 * Safe under StrictMode: the first run in dev is aborted and its result ignored.
 */
export function useProjectLoader(): ProjectLoad {
  const [load, setLoad] = useState<ProjectLoad>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    Promise.all([
      getProject(signal),
      getSamples(signal),
      getWindows(signal),
      getCoverage({ resolution: COVERAGE_RESOLUTION }, signal),
    ])
      .then(([project, samples, annotations, coverage]) => {
        if (signal.aborted) return; // finished just before the cleanup ran
        const coverageRows = buildCoverageRows(coverage, samples);
        // the store first, so no component ever sees the placeholder range
        useViewStore
          .getState()
          .initialise({ start: 0, end: project.length }, initialView(annotations));
        setLoad({
          status: "ready",
          data: { project, samples, annotations, coverage, coverageRows },
        });
      })
      .catch((error: unknown) => {
        if (signal.aborted) return; // our own abort, not a failure
        const message = error instanceof Error ? error.message : String(error);
        setLoad({ status: "error", message });
      });

    return () => controller.abort();
  }, []);

  return load;
}

/**
 * Index the coverage rows by sample id, so a track row finds its values without searching.
 * Throws if a sample has no row: the plot would otherwise stay empty without a reason.
 */
function buildCoverageRows(
  coverage: Coverage,
  samples: SampleInfo[],
): ReadonlyMap<string, (number | null)[]> {
  const rows = new Map<string, (number | null)[]>();
  coverage.samples.forEach((sampleId, index) => {
    const values = coverage.values[index];
    if (values !== undefined) rows.set(sampleId, values);
  });
  const missing = samples.filter((sample) => !rows.has(sample.sample_id));
  if (missing.length > 0) {
    const ids = missing.map((sample) => sample.sample_id).join(", ");
    throw new Error(`the coverage response has no values for ${ids}`);
  }
  return rows;
}
