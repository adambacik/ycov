/** App-wide constants of the viewer page. */

/** Bin size in bp of the one coverage request: whole chrY at 10 kb (FR15 second resolution). */
export const COVERAGE_RESOLUTION = 10_000;

/** Smallest view in bp = 10 bins of COVERAGE_RESOLUTION; finer zoom needs 1 kb data (Phase 3). */
export const MIN_VIEW_SPAN = 10 * COVERAGE_RESOLUTION;

/** Fixed y-range of all coverage plots in relative copies, so samples are comparable. */
export const REL_COPY_RANGE: readonly [number, number] = [0, 2.2];

/**
 * Plotly plot margins in px. The track header pads its axis by the same left/right values,
 * so the header axis lines up with the plots below it.
 */
export const PLOT_MARGIN = { left: 40, right: 12, top: 6, bottom: 6 } as const;
