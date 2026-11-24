import { useId } from "react";

import { LaterVersionHint } from "@/components/common/LaterVersionHint";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** How coverage is scaled before it is drawn; rel_copy and depth match the API's Mode. */
type Normalisation = "rel_copy" | "y_internal" | "cohort" | "depth";

const NORMALISATION_OPTIONS: readonly { value: Normalisation; label: string }[] = [
  { value: "rel_copy", label: "Relative copy (autosomal baseline)" },
  { value: "y_internal", label: "Y-internal (sample XDR median)" },
  { value: "cohort", label: "Cohort median" },
  { value: "depth", label: "Raw depth" },
];

/** Normalisation mode select; fixed to relative copy until the other modes exist (FR58, Phase 3). */
export function NormalisationSelect() {
  const triggerId = useId();
  // Phase 3: value and onValueChange from a settings store, remove disabled
  const value: Normalisation = "rel_copy";

  return (
    <LaterVersionHint>
      <Label htmlFor={triggerId}>Normalisation</Label>
      <Select value={value} disabled>
        <SelectTrigger id={triggerId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NORMALISATION_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </LaterVersionHint>
  );
}
