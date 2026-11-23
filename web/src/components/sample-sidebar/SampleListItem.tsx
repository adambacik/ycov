import type { SampleInfo } from "@/api/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDepth } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSampleStore } from "@/state/sampleStore";

interface SampleListItemProps {
  sample: SampleInfo;
}

/** One sample of the list: tick box (shown or hidden), id and baseline; the whole row toggles. */
export function SampleListItem({ sample }: SampleListItemProps) {
  const id = sample.sample_id;
  // a boolean, not the set: ticking one sample re-renders only its own row
  const shown = useSampleStore((state) => !state.hidden.has(id));
  const show = useSampleStore((state) => state.show);
  const hide = useSampleStore((state) => state.hide);

  return (
    <li className="hover:bg-muted">
      <Label className="grid grid-cols-[auto_minmax(0,1fr)_auto] px-2.5 py-0.5">
        <Checkbox
          checked={shown}
          onCheckedChange={(checked) => (checked === true ? show([id]) : hide([id]))}
        />
        <span title={id} className={cn("truncate font-mono", shown && "text-foreground")}>
          {id}
        </span>
        <span title="Autosomal baseline depth (median chr19-22)" className="font-mono text-small">
          {formatDepth(sample.baseline)}
        </span>
      </Label>
    </li>
  );
}
