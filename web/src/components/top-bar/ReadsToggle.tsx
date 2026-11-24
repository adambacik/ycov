import { useId } from "react";

import { LaterVersionHint } from "@/components/common/LaterVersionHint";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Which reads the coverage counts: all, or only those with mapping quality ≥ 20. */
type ReadsFilter = "all" | "mapq";

/** Reads `All | MAPQ ≥ 20` switch; disabled until the MAPQ coverage is served (FR57, Phase 3). */
export function ReadsToggle() {
  const keyId = useId();
  // Phase 3: value and onValueChange from a settings store, remove disabled
  const value: ReadsFilter = "all";

  return (
    <LaterVersionHint>
      <span id={keyId} className="text-muted-foreground">
        Reads
      </span>
      <ToggleGroup type="single" value={value} disabled aria-labelledby={keyId}>
        <ToggleGroupItem value="all">All</ToggleGroupItem>
        <ToggleGroupItem value="mapq">MAPQ ≥ 20</ToggleGroupItem>
      </ToggleGroup>
    </LaterVersionHint>
  );
}
