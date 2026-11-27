import { useEffect, useRef, type PointerEvent } from "react";

import type { GenomeRange } from "@/lib/genome";
import { useViewStore } from "@/state/viewStore";

/**
 * The view after the pointer has moved deltaPx (positive = right) since pointerdown. Fixed
 * for the whole drag: it closes over the view, scale and bounds at pointerdown.
 */
export type ViewAtDelta = (deltaPx: number) => GenomeRange;

/** What a drag needs to know from its pointerdown; constant until the pointer is released. */
interface Drag {
  pointerId: number;
  originX: number;
  viewAt: ViewAtDelta;
}

export interface ViewDrag {
  /**
   * Start a drag in a pointerdown handler. captureTarget gets the pointer capture, so the drag
   * goes on outside the element and keeps its cursor; it must lie inside (or be) the element
   * that has the handlers.
   */
  start: (event: PointerEvent<Element>, captureTarget: Element, viewAt: ViewAtDelta) => void;
  /** Whether a drag is running; for event handlers only, not for rendering. */
  isDragging: () => boolean;
  /** Spread onto the element that receives the pointer events. */
  handlers: {
    onPointerMove: (event: PointerEvent<Element>) => void;
    onPointerUp: (event: PointerEvent<Element>) => void;
    onPointerCancel: (event: PointerEvent<Element>) => void;
  };
}

/**
 * Changes the region in view by dragging, shared by the overview slider and the track
 * header. The caller decides what a drag means (viewAt); the hook follows one pointer, always
 * computes from the origin plus the total distance (so the view does not drift) and puts at
 * most one view per animation frame into the store, i.e. one relayout of every plot.
 */
export function useViewDrag(): ViewDrag {
  const setView = useViewStore((state) => state.setView);

  // refs, not state: nothing to re-render per pointer event
  const dragRef = useRef<Drag | null>(null);
  const pendingRef = useRef<GenomeRange | null>(null); // latest view, not in the store yet
  const frameRef = useRef(0); // requested animation frame, 0 = none

  /** Put the latest dragged view into the store now. */
  function flush() {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    if (pendingRef.current !== null) setView(pendingRef.current);
    pendingRef.current = null;
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    },
    [],
  );

  function start(event: PointerEvent<Element>, captureTarget: Element, viewAt: ViewAtDelta) {
    dragRef.current = { pointerId: event.pointerId, originX: event.clientX, viewAt };
    captureTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<Element>) {
    const drag = dragRef.current;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    pendingRef.current = drag.viewAt(event.clientX - drag.originX);
    if (frameRef.current === 0) frameRef.current = requestAnimationFrame(flush);
  }

  function handlePointerEnd(event: PointerEvent<Element>) {
    if (event.pointerId !== dragRef.current?.pointerId) return;
    dragRef.current = null;
    flush(); // do not lose the last move before the release
  }

  return {
    start,
    isDragging: () => dragRef.current !== null,
    handlers: {
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerEnd,
      onPointerCancel: handlePointerEnd,
    },
  };
}
