/**
 * Which samples the user wants to see (FR42), shared by the sample list and the track rows. Stores
 * the hidden ones, so all samples are shown from the start without initialising anything.
 */
import { create } from "zustand";

import { hideSamples, invertSamples, showSamples } from "@/lib/sampleVisibility";

interface SampleState {
  /** ids of the samples the user has unticked; replaced on every change, never modified */
  hidden: ReadonlySet<string>;
  show: (ids: readonly string[]) => void;
  hide: (ids: readonly string[]) => void;
  /** show the hidden ones of these samples and hide the shown ones */
  invert: (ids: readonly string[]) => void;
}

/** Sample visibility store; select single fields, never the whole state. */
export const useSampleStore = create<SampleState>()((set) => ({
  hidden: new Set(),
  show: (ids) => set((state) => ({ hidden: showSamples(state.hidden, ids) })),
  hide: (ids) => set((state) => ({ hidden: hideSamples(state.hidden, ids) })),
  invert: (ids) => set((state) => ({ hidden: invertSamples(state.hidden, ids) })),
}));
