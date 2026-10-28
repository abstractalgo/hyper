import { go as fuzzySearch } from "fuzzysort";

import type { EditorNode } from "../store/canvas";
import type { NoteId } from "./model";

/** A search result: an existing note, or an offer to create one with the typed title. */
export type NoteRow =
  | { kind: "note"; note: EditorNode; group?: string }
  | { kind: "create"; title: string };

export const rowKey = (row: NoteRow) => (row.kind === "note" ? row.note.id : "create");

/**
 * Fuzzy note search for pickers: the given `options` come first (in their order) and are all
 * listed when nothing is typed; then other matching notes (under "Other notes"); then "Create …"
 * if no note has exactly the typed title.
 */
export function searchNotes(
  nodes: readonly EditorNode[],
  query: string,
  {
    options = [],
    exclude = [],
    limit = 8,
  }: { options?: NoteId[]; exclude?: NoteId[]; limit?: number },
): NoteRow[] {
  const trimmed = query.trim();
  const optionNotes = options.flatMap((id) => nodes.filter((n) => n.id === id));
  if (!trimmed) return optionNotes.map((note) => ({ kind: "note", note }));

  const search = (notes: EditorNode[], max: number) =>
    fuzzySearch(trimmed, notes, { key: (n) => n.data.title, threshold: 0, limit: max }).map(
      (r) => r.obj,
    );
  const others = nodes.filter((n) => !options.includes(n.id) && !exclude.includes(n.id));
  const rows: NoteRow[] = [
    ...search(optionNotes, 50).map((note): NoteRow => ({ kind: "note", note })),
    ...search(others, limit).map((note): NoteRow => ({
      kind: "note",
      note,
      group: options.length ? "Other notes" : undefined,
    })),
  ];
  const exists = nodes.some((n) => n.data.title.toLowerCase() === trimmed.toLowerCase());
  return exists ? rows : [...rows, { kind: "create", title: trimmed }];
}
