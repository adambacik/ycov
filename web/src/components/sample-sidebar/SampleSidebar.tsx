import { Pane } from "@/components/common/Pane";

/** Container 4: the list of samples; only its list scrolls (mockup `.side`). */
export function SampleSidebar() {
  // step 10: "Samples (n)" header and a scrolling list of SampleListItem
  return (
    <Pane
      as="aside"
      aria-label="Samples"
      // stacked layout: limited height so the tracks below stay reachable (mockup 460 px)
      className="flex max-h-115 min-h-0 flex-col overflow-hidden desktop:max-h-none"
    >
      <p className="px-2.5 py-1.5 text-muted-foreground">Sample list</p>
    </Pane>
  );
}
