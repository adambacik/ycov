import { ArrowLeftIcon, ArrowRightIcon, MinusIcon, PlusIcon } from "lucide-react";

import { LaterVersionHint } from "@/components/common/LaterVersionHint";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

/** Zoom −/+, move ←/→ and Reset; disabled until the view can be changed from here (Phase 3). */
export function ViewControls() {
  // Phase 3: onClick → setView(zoomView / moveView / bounds), remove disabled
  return (
    <LaterVersionHint className="gap-3.5">
      <ButtonGroup aria-label="Zoom">
        <Button size="icon" aria-label="Zoom out" disabled>
          <MinusIcon />
        </Button>
        <Button size="icon" aria-label="Zoom in" disabled>
          <PlusIcon />
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label="Move">
        <Button size="icon" aria-label="Move left" disabled>
          <ArrowLeftIcon />
        </Button>
        <Button size="icon" aria-label="Move right" disabled>
          <ArrowRightIcon />
        </Button>
      </ButtonGroup>
      <Button aria-label="Reset: show the whole chromosome" disabled>
        Reset
      </Button>
    </LaterVersionHint>
  );
}
