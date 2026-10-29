import { Popover } from "@base-ui/react/popover";
import { ChevronLeftIcon, EllipsisIcon, MinusCircleIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useCanvasStore, useNoteData, type EditorNode } from "../../store/canvas";
import { rowKey, searchNotes, type NoteRow } from "../noteSearch";
import { NoteIcon } from "../icons";
import {
  NOTE_COLOR_CLASSES,
  NOTE_COLORS,
  type NoteColor,
  type NoteId,
  type SelectFieldDef,
} from "../model";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups";
import { ResultList, useListNavigation } from "./ResultList";

/** A stable empty list for the closed picker's store selector. */
const NO_NOTES: EditorNode[] = [];

type SelectEditorProps = {
  field: SelectFieldDef;
  /** Selected note IDs. */
  value: NoteId[];
  onChange: (value: NoteId[]) => void;
  /** The field's option list changed (an option was removed from it). */
  onOptionIdsChange: (optionIds: NoteId[]) => void;
  /** Creates a note titled `title` as a new option of this field; returns its ID. */
  onCreateOption: (title: string) => NoteId;
  /** The note being edited, if any: excluded from the choices. */
  noteId?: NoteId;
  /** Whether the last value may be removed (false for mandatory fields). */
  allowEmpty: boolean;
};

/** A selected or offered note: its title on its own color, with its icon. */
export function NotePill({ noteId, onRemove }: { noteId: string; onRemove?: () => void }) {
  const title = useNoteData(noteId, "title");
  const color = useNoteData(noteId, "color");
  if (title === undefined) {
    return (
      <span className="rounded px-1.5 text-xs leading-5 text-gray-400 line-through">
        deleted note
      </span>
    );
  }
  const colors = color ? NOTE_COLOR_CLASSES[color] : "bg-gray-100 text-gray-800";
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded px-1.5 py-px text-xs leading-5 ${colors}`}
    >
      <NoteIcon noteId={noteId} className="size-3.5" showPlain={false} />
      <span className="truncate">{title}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${title}`}
          onClick={onRemove}
          className="-mr-1 rounded opacity-60 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}

/** The "Create …" row at the end of note search results. */
export function CreateRow({ title }: { title: string }) {
  return (
    <>
      Create
      <span className="truncate rounded bg-gray-100 px-1.5 leading-5 text-gray-800">{title}</span>
    </>
  );
}

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
  const [editingId, setEditingId] = useState<NoteId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const container = usePopupContainer();
  // Only read while open: subscribing to every note would re-render this on every drag frame.
  const nodes = useCanvasStore((s) => (open ? s.nodes : NO_NOTES));

  const canRemove = allowEmpty || value.length > 1;
  const rows = searchNotes(nodes, query, {
    options: field.optionIds,
    exclude: noteId ? [noteId] : [],
  });

  const remove = (id: NoteId) => onChange(value.filter((v) => v !== id));
  const pick = (id: NoteId) => {
    setQuery("");
    if (!field.multiple) {
      onChange([id]);
      setOpen(false);
    } else if (value.includes(id)) {
      if (canRemove) {
        remove(id);
      }
    } else {
      onChange([...value, id]);
    }
  };
  const choose = (row: NoteRow) =>
    pick(row.kind === "create" ? onCreateOption(row.title) : row.note.id);
  const nav = useListNavigation(rows, choose);

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
        {/* Blank when empty; the row still shows its hover background. */}
        {value.map((id) => (
          <NotePill key={id} noteId={id} />
        ))}
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
                  {value.map((id) => (
                    <NotePill
                      key={id}
                      noteId={id}
                      onRemove={canRemove ? () => remove(id) : undefined}
                    />
                  ))}
                  <input
                    ref={inputRef}
                    aria-label={`Search or create ${field.name}`}
                    placeholder={value.length ? "" : "Search or create a note…"}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      nav.reset();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && query === "" && value.length > 0 && canRemove) {
                        remove(value[value.length - 1]!);
                      } else {
                        nav.onKeyDown(e);
                      }
                    }}
                    className="h-6 min-w-16 flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
                <ResultList
                  items={rows}
                  getKey={rowKey}
                  getGroup={(row) => (row.kind === "note" ? row.group : undefined)}
                  active={nav.active}
                  setActive={nav.setActive}
                  className="max-h-64 overflow-y-auto p-1"
                  empty="No options yet. Type to find or create a note."
                  renderItem={(row) => (
                    <>
                      <button
                        type="button"
                        onClick={() => choose(row)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1 text-left text-xs text-gray-600"
                      >
                        {row.kind === "create" ? (
                          <CreateRow title={row.title} />
                        ) : (
                          <NotePill noteId={row.note.id} />
                        )}
                      </button>
                      {row.kind === "note" && field.optionIds.includes(row.note.id) && (
                        <button
                          type="button"
                          aria-label={`Edit ${row.note.data.title}`}
                          onClick={() => setEditingId(row.note.id)}
                          className="mr-1 rounded p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 group-aria-current:opacity-100 hover:bg-gray-200 hover:text-gray-700"
                        >
                          <EllipsisIcon className="size-3.5" />
                        </button>
                      )}
                    </>
                  )}
                />
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
  if (!note) {
    return null;
  }

  const commitTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== note.data.title) {
      updateNodeData(noteId, { title: trimmed });
    } else {
      setTitle(note.data.title);
    }
  };
  const setColor = (color: NoteColor | null) => updateNodeData(noteId, { color });

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
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="mb-1 h-7 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-500"
      />
      <p className="mt-2 mb-1 px-1 text-xs text-gray-500">Color (the note's color)</p>
      <ul>
        {[null, ...NOTE_COLORS].map((color) => (
          <li key={color ?? "default"}>
            <button
              type="button"
              aria-pressed={(note.data.color ?? null) === color}
              onClick={() => setColor(color)}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs capitalize hover:bg-gray-100 aria-pressed:font-medium"
            >
              <span
                className={`size-3.5 rounded ${color ? NOTE_COLOR_CLASSES[color] : "border border-gray-300 bg-white"}`}
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
