import { useId } from "react";

import { LaterVersionHint } from "@/components/common/LaterVersionHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRegionLabel } from "@/lib/format";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/**
 * Region form: shows the region in view live (1-based, "chrY:2,458,321-27,020,249"); typing a
 * region, gene or AZFc and Go come in Phase 3 (FR35-FR37). Full width on a narrow window.
 */
export function RegionInput() {
  const inputId = useId();
  const { project } = useProjectData();
  const view = useViewStore((state) => state.view);

  // Phase 3: own text state while typing, onSubmit parses it and calls setView, remove disabled
  return (
    <form className="flex basis-full desktop:basis-auto">
      <LaterVersionHint className="min-w-0 flex-1">
        <Label htmlFor={inputId}>Region</Label>
        <Input
          id={inputId}
          value={formatRegionLabel(project.chromosome, view)}
          placeholder="chrY:start-end, gene or AZFc"
          spellCheck={false}
          autoComplete="off"
          readOnly
          disabled
          className="desktop:w-65"
        />
        <Button type="submit" disabled>
          Go
        </Button>
      </LaterVersionHint>
    </form>
  );
}
