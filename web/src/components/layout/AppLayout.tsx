import { CohortBar } from "@/components/cohort-bar/CohortBar";
import { NavBar } from "@/components/nav-bar/NavBar";
import { ChromosomeOverview } from "@/components/overview/ChromosomeOverview";
import { SampleSidebar } from "@/components/sample-sidebar/SampleSidebar";
import { TopBar } from "@/components/top-bar/TopBar";
import { TrackPanel } from "@/components/tracks/TrackPanel";

/**
 * The six-area page grid (mockup `.app`): top bar, navigation and overview across, sample
 * sidebar | sample tracks, cohort bar at the bottom. Only the sidebar and the tracks scroll.
 * Below the desktop breakpoint (980 px) everything stacks in one column and the page scrolls.
 * Each container sets its own landmark and column span.
 */
export function AppLayout() {
  return (
    <div className="grid grid-cols-1 gap-1.5 px-4 py-1.5 desktop:h-full desktop:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)] desktop:grid-rows-[auto_auto_auto_minmax(0,1fr)_auto]">
      <TopBar />
      <NavBar />
      <ChromosomeOverview />
      <SampleSidebar />
      <TrackPanel />
      <CohortBar />
    </div>
  );
}
