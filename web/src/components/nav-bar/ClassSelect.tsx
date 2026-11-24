import { useId, useMemo } from "react";

import { LaterVersionHint } from "@/components/common/LaterVersionHint";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { jumpTargetGroups } from "@/lib/jumpTargets";
import { useProjectData } from "@/state/projectData";

/** "Jump to…" select: every sequence class interval and named region of the annotations. */
export function ClassSelect() {
  const triggerId = useId();
  const { annotations } = useProjectData();
  const groups = useMemo(() => jumpTargetGroups(annotations), [annotations]);

  // Phase 3: onValueChange looks up the target's range and calls setView, remove disabled
  return (
    <LaterVersionHint>
      <Label htmlFor={triggerId}>Class</Label>
      <Select disabled>
        <SelectTrigger id={triggerId}>
          <SelectValue placeholder="Jump to…" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectGroup key={group.label}>
              <SelectLabel>{group.label}</SelectLabel>
              {group.targets.map((target) => (
                <SelectItem key={target.value} value={target.value}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </LaterVersionHint>
  );
}
