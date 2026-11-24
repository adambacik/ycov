/**
 * Spreads slow drawing over several frames. One Plotly plot takes 10-30 ms to redraw, so redrawing
 * all rows in the same frame blocks the page and the viewport slider stutters (NFR4). With the
 * queue the slider moves in every frame and the plots catch up one after another.
 */

/** Time in ms that drawing may take in one frame; half of a 60 Hz frame. */
const FRAME_BUDGET = 8;

export interface DrawQueue {
  /**
   * Draw in one of the next frames. `owner` has at most one waiting draw: a new one replaces it and
   * keeps its place, so a continuous drag can not push the last rows back forever.
   */
  request: (owner: object, draw: () => void) => void;
  /** Forget the waiting draw of `owner`, if there is one. */
  cancel: (owner: object) => void;
}

/** A separate queue; the app uses the shared `drawQueue`. */
export function createDrawQueue(): DrawQueue {
  // a Map keeps the order in which its keys were added, also when a value is replaced
  const waiting = new Map<object, () => void>();
  let frame = 0; // 0 = no frame requested

  function schedule() {
    if (frame === 0 && waiting.size > 0) frame = requestAnimationFrame(runFrame);
  }

  function runFrame() {
    frame = 0;
    const start = performance.now();
    try {
      // always one, then as many as fit into the budget
      do {
        const next = waiting.entries().next();
        if (next.done === true) return;
        const [owner, draw] = next.value;
        waiting.delete(owner);
        draw();
      } while (performance.now() - start < FRAME_BUDGET);
    } finally {
      schedule(); // also after an error: one broken plot must not stop the others
    }
  }

  return {
    request(owner, draw) {
      waiting.set(owner, draw);
      schedule();
    },
    cancel(owner) {
      waiting.delete(owner);
    },
  };
}

/** The queue shared by all plots of the page. */
export const drawQueue = createDrawQueue();
