import { ArrowLeftIcon, ArrowRightIcon, MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { MIN_VIEW_SPAN } from "@/lib/constants";
import { moveView, zoomView } from "@/lib/viewRange";
import { useViewStore } from "@/state/viewStore";

/** One zoom click halves (+) or doubles (−) the span in view, as in the mockup. */
const ZOOM_FACTOR = 2;
/** One move click shifts the view by this share of its span, as in the mockup. */
const MOVE_STEP = 0.4;

/**
 * Zoom −/+ around the centre of the view, move ←/→ by 40 % of the span (FR35) and Reset to the
 * whole chromosome. A button is disabled when it cannot change the view: zoom at its limit
 * (MIN_VIEW_SPAN or the whole chromosome), move at that end, Reset when all is in view.
 */
export function ViewControls() {
  const bounds = useViewStore((state) => state.bounds);
  const view = useViewStore((state) => state.view);
  const setView = useViewStore((state) => state.setView);

  const span = view.end - view.start;
  const wholeInView = view.start <= bounds.start && view.end >= bounds.end;
  const zoom = (factor: number) => setView(zoomView(view, factor, bounds, MIN_VIEW_SPAN));
  const move = (direction: -1 | 1) => setView(moveView(view, direction * MOVE_STEP * span, bounds));

  return (
    <div className="inline-flex items-center gap-3.5">
      <ButtonGroup aria-label="Zoom">
        <Button
          size="icon"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={wholeInView}
          onClick={() => zoom(ZOOM_FACTOR)}
        >
          <MinusIcon />
        </Button>
        <Button
          size="icon"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={span <= MIN_VIEW_SPAN}
          onClick={() => zoom(1 / ZOOM_FACTOR)}
        >
          <PlusIcon />
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label="Move">
        <Button
          size="icon"
          aria-label="Move left"
          title="Move left"
          disabled={view.start <= bounds.start}
          onClick={() => move(-1)}
        >
          <ArrowLeftIcon />
        </Button>
        <Button
          size="icon"
          aria-label="Move right"
          title="Move right"
          disabled={view.end >= bounds.end}
          onClick={() => move(1)}
        >
          <ArrowRightIcon />
        </Button>
      </ButtonGroup>
      <Button
        aria-label="Reset: show the whole chromosome"
        title="Show the whole chromosome"
        disabled={wholeInView}
        onClick={() => setView(bounds)}
      >
        Reset
      </Button>
    </div>
  );
}
