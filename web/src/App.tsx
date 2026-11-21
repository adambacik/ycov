import { useEffect, useState } from "react";
import { getProject, getSamples } from "./api/client.ts";
import type { ProjectInfo, SampleInfo } from "./api/types.ts";
import { formatBp } from "@/lib/format";

/** What the app knows about the project: loading, failed, or loaded. */
type Load =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; project: ProjectInfo; samples: SampleInfo[] };

export default function App() {
  const [load, setLoad] = useState<Load>({ status: "loading" });

  // Load once on start; abort if the component goes away (StrictMode in dev).
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    Promise.all([getProject(signal), getSamples(signal)])
      .then(([project, samples]) => setLoad({ status: "ready", project, samples }))
      .catch((error: unknown) => {
        if (signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoad({ status: "error", message });
      });

    return () => controller.abort();
  }, []);

  if (load.status === "loading") {
    return <p className="p-4">Loading project…</p>;
  }
  if (load.status === "error") {
    return (
      <p className="p-4 text-destructive" role="alert">
        Could not load the project: {load.message}
      </p>
    );
  }

  const { project, samples } = load;
  return (
    <>
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b bg-card px-4 py-2.5">
        <strong className="text-brand">ycov</strong>
        <span>{project.reference}</span>
        <span>
          {project.chromosome} · {formatBp(project.length)}
        </span>
        <span>{formatBp(project.window_size)} windows</span>
        <span>{samples.length} samples</span>
        <span className="text-muted-foreground">v{project.ycov_version}</span>
      </header>
      <main className="p-4">
        <p className="text-muted-foreground">Heatmap goes here.</p>
      </main>
    </>
  );
}
