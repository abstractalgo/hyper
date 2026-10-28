import { Popover } from "@base-ui/react/popover";
import { go as fuzzySearch } from "fuzzysort";
import { ChevronLeftIcon, EllipsisIcon, MinusCircleIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { useCanvasStore, type EditorNode } from "../../store/canvas.ts";
import { NoteIcon } from "../icons.tsx";
import {
  OPTION_COLOR_CLASSES,
  OPTION_COLORS,
  type FieldDef,
  type FieldValue,
  type OptionColor,
} from "../model.ts";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups.tsx";

const MAX_OTHER_MATCHES = 8;

type SelectEditorProps = {
  field: FieldDef;
  /** Selected note IDs. */
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** The field's option list changed (an option was removed from it). */
  onOptionIdsChange: (optionIds: string[]) => void;
  /** Creates a note titled `title` as a new option of this field; returns its ID. */
  onCreateOption: (title: string) => string;
  /** The note being edited, if any: excluded from the choices. */
  noteId?: string;
  /** Whether the last value may be removed (false for mandatory fields). */
  allowEmpty: boolean;
};

/** A selected or offered note: its title on its own color, with its icon. */
export function NotePill({ noteId, onRemove }: { noteId: string; onRemove?: () => void }) {
  const note = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId));
  if (!note) {
    return (
      <span className="rounded px-1.5 text-xs leading-5 text-gray-400 line-through">
        deleted note
      </span>
    );
  }
  const colors = note.data.color
    ? OPTION_COLOR_CLASSES[note.data.color]
    : "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-px text-xs leading-5 ${colors}`}
    >
      <NoteIcon noteId={noteId} className="size-3.5" showPlain={false} />
      <span className="truncate">{note.data.title}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${note.data.title}`}
          onClick={onRemove}
          className="-mr-1 rounded opacity-60 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}

type Row = { kind: "option" | "other"; note: EditorNode } | { kind: "create"; title: string };

/**
 * Notion-style select whose options are notes. With nothing typed it lists the field's options;
 * typing matches the options first, then any other note, and offers to create a new note.
 */
export function SelectEditor({
  field,
  value,
  onChange,
  onOptionIdsChange,
  onCreateOption,
  noteId,
  allowEmpty,
}: SelectEditorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const container = usePopupContainer();
  const nodes = useCanvasStore((s) => s.nodes);

  const selected = value.map(String);
  const canRemove = allowEmpty || selected.length > 1;
  const trimmed = query.trim();

  const rows = useMemo((): Row[] => {
    const options = field.optionIds.flatMap((id) => nodes.filter((n) => n.id === id));
    if (!trimmed) return options.map((note) => ({ kind: "option", note }));
    const search = (notes: EditorNode[], limit: number) =>
      fuzzySearch(trimmed, notes, { key: (n) => n.data.title, threshold: 0, limit }).map(
        (r) => r.obj,
      );
    const others = nodes.filter((n) => !field.optionIds.includes(n.id) && n.id !== noteId);
    const result: Row[] = [
      ...search(options, 50).map((note) => ({ kind: "option" as const, note })),
      ...search(others, MAX_OTHER_MATCHES).map((note) => ({ kind: "other" as const, note })),
    ];
    const exists = nodes.some((n) => n.data.title.toLowerCase() === trimmed.toLowerCase());
    return exists ? result : [...result, { kind: "create", title: trimmed }];
  }, [field.optionIds, nodes, noteId, trimmed]);

  const remove = (id: string) => onChange(selected.filter((v) => v !== id));
  const pick = (id: string) => {
    setQuery("");
    setActive(0);
    if (!field.multiple) {
      onChange([id]);
      setOpen(false);
    } else if (selected.includes(id)) {
      if (canRemove) remove(id);
    } else {
      onChange([...selected, id]);
    }
  };
  const choose = (row: Row) =>
    pick(row.kind === "create" ? onCreateOption(row.title) : row.note.id);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (rows.length === 0 ? 0 : (i + step + rows.length) % rows.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    } else if (e.key === "Backspace" && query === "" && selected.length > 0 && canRemove) {
      remove(selected[selected.length - 1]!);
    }
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setEditingId(null);
        }
      }}
    >
      <Popover.Trigger
        aria-label={field.name}
        // -ml-1 offsets px-1, so the pills line up with the other values; the hover background
        // still gets its padding.
        className="-ml-1 flex min-h-6 w-full min-w-0 flex-wrap items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100"
      >
        {selected.length > 0 ? (
          selected.map((id) => <NotePill key={id} noteId={id} />)
        ) : (
          <span className="text-xs text-gray-400">Empty</span>
        )}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={2} align="start" className={POSITIONER_CLASS}>
          <Popover.Popup initialFocus={inputRef} className={`w-64 ${POPUP_CLASS}`}>
            {editingId ? (
              <OptionEditor
                noteId={editingId}
                onBack={() => setEditingId(null)}
                onRemoveFromOptions={() => {
                  onOptionIdsChange(field.optionIds.filter((id) => id !== editingId));
                  setEditingId(null);
                }}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
                  {selected.map((id) => (
                    <NotePill
                      key={id}
                      noteId={id}
                      onRemove={canRemove ? () => remove(id) : undefined}
                    />
                  ))}
                  <input
                    ref={inputRef}
                    aria-label={`Search or create ${field.name}`}
                    placeholder={selected.length ? "" : "Search or create a note…"}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={handleKeyDown}
                    className="h-6 min-w-16 flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
                <ul className="max-h-64 overflow-y-auto p-1">
                  {rows.map((row, i) => {
                    const firstOther = row.kind === "other" && rows[i - 1]?.kind !== "other";
                    return (
                      <li key={row.kind === "create" ? "create" : row.note.id}>
                        {firstOther && (
                          <p className="px-2 pt-1.5 pb-1 text-xs text-gray-500">Other notes</p>
                        )}
                        <div
                          aria-current={active === i}
                          className="group flex items-center gap-1 rounded px-2 py-1 aria-current:bg-gray-100"
                        >
                          <button
                            type="button"
                            onClick={() => choose(row)}
                            onMouseEnter={() => setActive(i)}
                            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-gray-600"
                          >
                            {row.kind === "create" ? (
                              <>
                                Create
                                <span className="truncate rounded bg-gray-100 px-1.5 leading-5 text-gray-800">
                                  {row.title}
                                </span>
                              </>
                            ) : (
                              <NotePill noteId={row.note.id} />
                            )}
                          </button>
                          {row.kind === "option" && (
                            <button
                              type="button"
                              aria-label={`Edit ${row.note.data.title}`}
                              onClick={() => setEditingId(row.note.id)}
                              className="rounded p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 group-aria-current:opacity-100 hover:bg-gray-200 hover:text-gray-700"
                            >
                              <EllipsisIcon className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {rows.length === 0 && (
                    <li className="px-2 py-1 text-xs text-gray-400">
                      No options yet. Type to find or create a note.
                    </li>
                  )}
                </ul>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Rename / recolor an option note, or take it off the field's option list (the "⋯" view). */
function OptionEditor({
  noteId,
  onBack,
  onRemoveFromOptions,
}: {
  noteId: string;
  onBack: () => void;
  onRemoveFromOptions: () => void;
}) {
  const note = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId));
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const [title, setTitle] = useState(note?.data.title ?? "");
  if (!note) return null;

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== note.data.title) updateNodeData(noteId, { title: trimmed });
    else setTitle(note.data.title);
  };
  const setColor = (color: OptionColor | null) => updateNodeData(noteId, { color });

  return (
    <div className="p-2">
      <button
        type="button"
        onClick={onBack}
        className="mb-2 flex items-center gap-0.5 rounded px-1 text-xs text-gray-500 hover:bg-gray-100"
      >
        <ChevronLeftIcon className="size-3.5" />
        Options
      </button>
      <input
        aria-label="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="mb-1 h-7 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-500"
      />
      <p className="mt-2 mb-1 px-1 text-xs text-gray-500">Color (the note's color)</p>
      <ul>
        {[null, ...OPTION_COLORS].map((color) => (
          <li key={color ?? "default"}>
            <button
              type="button"
              aria-pressed={(note.data.color ?? null) === color}
              onClick={() => setColor(color)}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs capitalize hover:bg-gray-100 aria-pressed:font-medium"
            >
              <span
                className={`size-3.5 rounded ${color ? OPTION_COLOR_CLASSES[color] : "border border-gray-300 bg-white"}`}
              />
              {color ?? "Default"}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onRemoveFromOptions}
        className="mt-2 flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-gray-600 hover:bg-gray-100"
      >
        <MinusCircleIcon className="size-3.5" />
        Remove from options (keeps the note)
      </button>
    </div>
  );
}
