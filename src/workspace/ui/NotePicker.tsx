import { Popover } from "@base-ui/react/popover";
import { go as fuzzySearch } from "fuzzysort";
import { useMemo, useState, type ReactNode } from "react";

import { useCanvasStore } from "../../store/canvas.ts";
import { NoteIcon } from "../icons.tsx";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups.tsx";

const MAX_RESULTS = 20;

type NotePickerProps = {
  /** Only offer notes of this schema (null = any note). */
  schemaId: string | null;
  /** Notes that can't be picked (already chosen, or the note itself). */
  exclude: string[];
  onPick: (noteId: string) => void;
  children: ReactNode;
  label: string;
  triggerClassName?: string;
};

/** Fuzzy-searchable list of notes in a popover, for reference fields. */
export function NotePicker({
  schemaId,
  exclude,
  onPick,
  children,
  label,
  triggerClassName = "",
}: NotePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const nodes = useCanvasStore((s) => s.nodes);
  const container = usePopupContainer();

  const results = useMemo(() => {
    const candidates = nodes.filter(
      (n) => (schemaId === null || n.data.schemaId === schemaId) && !exclude.includes(n.id),
    );
    if (!query.trim()) return candidates.slice(0, MAX_RESULTS);
    return fuzzySearch(query, candidates, {
      key: (n) => n.data.title,
      limit: MAX_RESULTS,
      threshold: 0,
    }).map((r) => r.obj);
  }, [nodes, schemaId, exclude, query]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={label} className={triggerClassName}>
        {children}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Popover.Popup className={`w-64 p-1 ${POPUP_CLASS}`}>
            <input
              aria-label="Search notes"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-1 h-7 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-500"
            />
            <ul className="max-h-56 overflow-y-auto">
              {results.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(note.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-1.5 truncate rounded px-2 py-1 text-left text-xs hover:bg-gray-100"
                  >
                    <NoteIcon noteId={note.id} className="size-3.5" />
                    <span className="truncate">{note.data.title}</span>
                  </button>
                </li>
              ))}
            </ul>
            {results.length === 0 && (
              <p className="px-2 py-2 text-xs text-gray-500">No matching notes.</p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
