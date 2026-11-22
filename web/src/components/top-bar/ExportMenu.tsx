import { Fragment } from "react";
import { ChevronDownIcon } from "lucide-react";

import { LaterVersionHint } from "@/components/common/LaterVersionHint";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Everything the viewer can export; Phase 3 dispatches on this value. */
type ExportFormat =
  | "figure_png"
  | "figure_svg"
  | "figure_pdf"
  | "summary_csv"
  | "summary_tsv"
  | "flags_csv"
  | "flagged_regions_bed";

interface ExportOption {
  value: ExportFormat;
  label: string;
}

/** Menu entries in groups; a separator is drawn between groups (mockup `.menu hr`). */
const EXPORT_GROUPS: readonly { name: string; options: readonly ExportOption[] }[] = [
  {
    name: "figure",
    options: [
      { value: "figure_png", label: "Figure (PNG)" },
      { value: "figure_svg", label: "Figure (SVG)" },
      { value: "figure_pdf", label: "Figure (PDF)" },
    ],
  },
  {
    name: "table",
    options: [
      { value: "summary_csv", label: "Summary table (CSV)" },
      { value: "summary_tsv", label: "Summary table (TSV)" },
      { value: "flags_csv", label: "Flag list (CSV)" },
      { value: "flagged_regions_bed", label: "Flagged regions (BED)" },
    ],
  },
];

interface ExportMenuProps {
  /** layout only, e.g. "ml-auto" to push the menu to the right end of the top bar */
  className?: string;
}

/** Export dropdown with figure and table formats; trigger disabled until exports exist (FR61-FR63). */
export function ExportMenu({ className }: ExportMenuProps) {
  // Phase 3: onSelect per item, remove disabled
  return (
    <LaterVersionHint className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled>
            Export
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {EXPORT_GROUPS.map((group, index) => (
            <Fragment key={group.name}>
              {index > 0 && <DropdownMenuSeparator />}
              {group.options.map((option) => (
                <DropdownMenuItem key={option.value}>{option.label}</DropdownMenuItem>
              ))}
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </LaterVersionHint>
  );
}
