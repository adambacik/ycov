/**
 * The region in view, shared by the overview slider, the nav bar and every track row.
 * A zustand store instead of React state: a component subscribes to one field
 * (useViewStore((s) => s.view)), so a slider drag re-renders only what shows the view,
 * not the whole tree.
 */
import { create } from "zustand";

import { MIN_VIEW_SPAN } from "@/lib/constants";
import type { GenomeRange } from "@/lib/genome";
import { clampView } from "@/lib/viewRange";

interface ViewState {
  /** whole chromosome [0, length) */
  bounds: GenomeRange;
  /** region in view, always inside bounds and at least MIN_VIEW_SPAN long */
  view: GenomeRange;
  /** set once by the loader, before the page is shown */
  initialise: (bounds: GenomeRange, view: GenomeRange) => void;
  /** clamps into bounds; the only way to change the view */
  setView: (view: GenomeRange) => void;
}

/** View range store; select single fields, never the whole state. */
export const useViewStore = create<ViewState>()((set, get) => ({
  // placeholder until initialise(); no component renders before that (see useProjectLoader)
  bounds: { start: 0, end: 1 },
  view: { start: 0, end: 1 },
  initialise: (bounds, view) => set({ bounds, view: clampView(view, bounds, MIN_VIEW_SPAN) }),
  setView: (view) => set({ view: clampView(view, get().bounds, MIN_VIEW_SPAN) }),
}));
