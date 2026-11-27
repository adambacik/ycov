import {
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { useViewDrag } from "@/hooks/useViewDrag";
import { MIN_VIEW_SPAN } from "@/lib/constants";
import { formatRegionLabel } from "@/lib/format";
import { toPercent } from "@/lib/genome";
import { centreViewOn, dragView, moveView, type DragMode } from "@/lib/viewRange";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/** Arrow key steps as a share of the span in view. */
const KEY_STEP = 0.1;
const KEY_STEP_SHIFT = 0.5;

interface ViewportSliderProps {
  /** the drawing of the whole chromosome, ending with the GenomeAxis */
  children: ReactNode;
}

/**
 * The overview ruler: draws the region in view as a red box over its children and changes it
 * (FR35): drag the box to move, drag its edges to resize, press anywhere else to centre the view
 * there and keep dragging. Arrow keys move the focused box.
 *
 * It wraps the drawing instead of lying over it, so the bars keep their hover tooltips; the
 * children are not re-rendered when the view changes.
 */
export function ViewportSlider({ children }: ViewportSliderProps) {
  const { project } = useProjectData();
  const bounds = useViewStore((state) => state.bounds);
  const view = useViewStore((state) => state.view);
  const setView = useViewStore((state) => state.setView);

  const rulerRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const startHandleRef = useRef<HTMLDivElement>(null);
  const endHandleRef = useRef<HTMLDivElement>(null);

  const drag = useViewDrag();

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    const ruler = rulerRef.current;
    const box = boxRef.current;
    if (ruler === null || box === null) return;
    // main button only; a second finger does not take over a running drag
    if (event.button !== 0 || drag.isDragging()) return;
    event.preventDefault();

    const rect = ruler.getBoundingClientRect();
    const bpPerPx = (bounds.end - bounds.start) / rect.width;
    const hit = (ref: RefObject<Element | null>) =>
      event.target instanceof Node && ref.current?.contains(event.target) === true;

    let mode: DragMode = "move";
    let captureTarget = box; // keeps the cursor of the grabbed part during the drag
    let originView = view;
    if (hit(startHandleRef) && startHandleRef.current !== null) {
      mode = "resize-start";
      captureTarget = startHandleRef.current;
    } else if (hit(endHandleRef) && endHandleRef.current !== null) {
      mode = "resize-end";
      captureTarget = endHandleRef.current;
    } else if (!hit(boxRef)) {
      const position = bounds.start + (event.clientX - rect.left) * bpPerPx;
      originView = centreViewOn(view, position, bounds);
      setView(originView);
    }

    drag.start(event, captureTarget, (deltaPx) =>
      dragView(mode, originView, deltaPx * bpPerPx, bounds, MIN_VIEW_SPAN),
    );
    // preventDefault also stops the focus; arrow keys should work after a click
    box.focus({ preventScroll: true, focusVisible: false });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey) return; // browser shortcuts (Alt+← = back)
    if (drag.isDragging()) return; // the next pointermove would undo it
    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const step = (view.end - view.start) * (event.shiftKey ? KEY_STEP_SHIFT : KEY_STEP);
    setView(moveView(view, direction * step, bounds));
  }

  const left = toPercent(view.start, bounds);
  const width = toPercent(view.end, bounds) - left;

  return (
    <div
      ref={rulerRef}
      className="relative cursor-pointer touch-none select-none"
      onPointerDown={handlePointerDown}
      {...drag.handlers}
    >
      {children}
      {/* 3 px higher and lower than the 18 px class bar. Placed from the bottom (axis 26 px + gap
          2 px below the bar): the height of the region lanes above depends on the data */}
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label="Region in view"
        aria-valuemin={bounds.start + 1}
        aria-valuemax={bounds.end}
        aria-valuenow={view.start + 1}
        aria-valuetext={formatRegionLabel(project.chromosome, view)}
        onKeyDown={handleKeyDown}
        className="absolute bottom-6.25 h-6 min-w-1.5 cursor-grab rounded-[1px] border-[2.5px] border-viewport bg-viewport-fill ring-1 ring-card active:cursor-grabbing"
        // min(): a box widened to its 6 px minimum still ends at the chromosome end
        style={{ left: `min(${left}%, 100% - 0.375rem)`, width: `${width}%` }}
      >
        {/* handles: 8 px, over the border and a bit inside; on a very small box only outside,
            so its middle can still be grabbed to move it */}
        <div
          ref={startHandleRef}
          className="absolute -inset-y-[2.5px] right-[calc(100%-min(3px,25%-2.5px))] w-2 cursor-ew-resize"
        />
        <div
          ref={endHandleRef}
          className="absolute -inset-y-[2.5px] left-[calc(100%-min(3px,25%-2.5px))] w-2 cursor-ew-resize"
        />
      </div>
    </div>
  );
}
