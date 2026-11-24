import { Pane } from "@/components/common/Pane";

/** Container 6: cohort-wide views; empty in Phase 2, keeps its height so the layout is final. */
export function CohortBar() {
  // Phase 3: "Cohort:" buttons Flags, Summary, Boxplots, X/Y ratio, Legend (FR46-FR55)
  return <Pane as="footer" aria-label="Cohort" className="col-span-full min-h-9 px-2.5 py-1" />;
}
