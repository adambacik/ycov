import { formatBp } from "@/lib/format";
import { useViewStore } from "@/state/viewStore";

/** "24.56 Mb in view", live while the slider is dragged; right end of the nav bar on desktop. */
export function ViewSpan() {
  const view = useViewStore((state) => state.view);

  // no aria-live: it changes up to 60× per second while dragging; the slider has aria-valuetext
  return (
    <span className="font-mono text-small text-muted-foreground desktop:ml-auto">
      {formatBp(view.end - view.start)} in view
    </span>
  );
}
