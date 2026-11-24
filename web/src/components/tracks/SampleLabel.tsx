import type { SampleInfo } from "@/api/types";
import { formatDepth } from "@/lib/format";

interface SampleLabelProps {
  sample: SampleInfo;
}

/** Left cell of a track row (mockup `.lab`): sample id, baseline depth and input format. */
export function SampleLabel({ sample }: SampleLabelProps) {
  return (
    <div className="min-w-0 px-2 py-1">
      <div title={sample.sample_id} className="truncate font-mono font-semibold">
        {sample.sample_id}
      </div>
      <div
        title="Autosomal baseline depth (median chr19-22)"
        className="text-small text-muted-foreground"
      >
        baseline {formatDepth(sample.baseline)}
      </div>
      <div title={sample.path} className="truncate text-small text-muted-foreground">
        {sample.format}
      </div>
    </div>
  );
}
