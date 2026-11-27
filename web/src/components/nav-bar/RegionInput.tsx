import { useId, useState, type FormEvent, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatRegionLabel } from "@/lib/format";
import type { GenomeRange } from "@/lib/genome";
import { parseRegionQuery } from "@/lib/regionQuery";
import { centreViewOn } from "@/lib/viewRange";
import { useProjectData } from "@/state/projectData";
import { useViewStore } from "@/state/viewStore";

/** Text the user is typing, tied to the view it was started in. */
interface Draft {
  text: string;
  view: GenomeRange;
  error: string | null;
}

/**
 * Region form (FR36): shows the region in view live (1-based, "chrY:2,458,321-27,020,249");
 * typing coordinates and Go / Enter jumps there (lib/regionQuery.ts). Gene and AZF names come
 * later (FR37). Full width on a narrow window.
 *
 * While typing, the text is a draft that belongs to the view it was started in: when the view
 * changes in another way (slider, buttons), the draft is dropped and the input shows the new
 * region again. Esc drops it too. An unreadable region keeps the draft and shows why.
 */
export function RegionInput() {
  const inputId = useId();
  const errorId = useId();
  const { project } = useProjectData();
  const bounds = useViewStore((state) => state.bounds);
  const view = useViewStore((state) => state.view);
  const setView = useViewStore((state) => state.setView);

  const [draft, setDraft] = useState<Draft | null>(null);
  // a draft from an earlier view is stale: compared by identity, every setView makes a new view
  const current = draft !== null && draft.view === view ? draft : null;
  const text = current?.text ?? formatRegionLabel(project.chromosome, view);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (current === null) return; // nothing typed: the input already shows the view

    const query = parseRegionQuery(current.text, project.chromosome, bounds.end);
    if (query.kind === "error") {
      setDraft({ ...current, error: query.message });
      return;
    }
    setView(query.kind === "range" ? query.range : centreViewOn(view, query.position, bounds));
    setDraft(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setDraft(null);
  }

  const error = current?.error ?? null;

  return (
    <form
      className="flex basis-full items-center gap-1.5 desktop:basis-auto"
      onSubmit={handleSubmit}
    >
      <Label htmlFor={inputId}>Region</Label>
      <Input
        id={inputId}
        value={text}
        onChange={(event) => setDraft({ text: event.target.value, view, error: null })}
        onKeyDown={handleKeyDown}
        placeholder="chrY:start-end"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        className="min-w-0 flex-1 desktop:w-65 desktop:flex-none"
      />
      <Button type="submit">Go</Button>
      {error !== null && (
        <span id={errorId} role="alert" className="text-small text-destructive">
          {error}
        </span>
      )}
    </form>
  );
}
