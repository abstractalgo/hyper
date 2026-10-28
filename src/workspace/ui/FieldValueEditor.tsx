import { PlusIcon, XIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { useCanvasStore } from "../../store/canvas.ts";
import { IconByName } from "../icons.tsx";
import {
  formatDateAtom,
  parseAtom,
  type FieldAtom,
  type FieldDef,
  type FieldValue,
} from "../model.ts";
import { IconPicker } from "./IconPicker.tsx";
import { SelectEditor } from "./SelectEditor.tsx";

type FieldValueEditorProps = {
  field: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** Note being edited, if any: excluded from its own reference pickers. */
  noteId?: string;
  /**
   * Editing a field's default in settings: "mandatory" doesn't stop clearing it there
   * (that's what validation reports instead).
   */
  allowEmpty?: boolean;
  /**
   * Select fields can change their option list from the picker (create or remove options).
   * Defaults to saving the field to the workspace; settings passes its draft setter instead.
   */
  onFieldChange?: (field: FieldDef) => void;
};

// When an input starts the row, pull it left by its border + padding (5px) so its text lines up
// with chips and pills in other rows; the hover/focus border still has room around the text.
const inputClass =
  "h-6 w-full min-w-0 first:-ml-[5px] rounded border border-transparent bg-transparent px-1 text-xs text-gray-800 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white";
const iconButtonClass =
  "flex size-5 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700";
const chipClass =
  "inline-flex max-w-full items-center gap-1 rounded bg-gray-100 py-0.5 pr-0.5 pl-1.5 text-xs text-gray-800";

/** Edits one field's value, for any field type, in single- or multi-value form. */
export function FieldValueEditor({
  field,
  value,
  onChange,
  noteId,
  allowEmpty = false,
  onFieldChange,
}: FieldValueEditorProps) {
  const saveField = useCanvasStore((s) => s.saveField);
  const createOptionNote = useCanvasStore((s) => s.createOptionNote);
  const canRemove = allowEmpty || !field.required || value.length > 1;
  const add = (atom: FieldAtom) => {
    if (!value.includes(atom)) onChange(field.multiple ? [...value, atom] : [atom]);
  };
  const removeAt = (i: number) => onChange(value.filter((_, j) => j !== i));

  if (field.type === "select") {
    const changeField = onFieldChange ?? saveField;
    return (
      <SelectEditor
        field={field}
        value={value}
        onChange={onChange}
        onOptionIdsChange={(optionIds) => changeField({ ...field, optionIds })}
        onCreateOption={(title) => {
          const id = createOptionNote(field.id, title, {
            nearNoteId: noteId,
            siblingIds: field.optionIds,
          });
          // The store already added it to the saved field; a settings draft needs it too.
          if (onFieldChange) onFieldChange({ ...field, optionIds: [...field.optionIds, id] });
          return id;
        }}
        noteId={noteId}
        allowEmpty={allowEmpty || !field.required}
      />
    );
  }

  if (!field.multiple && isInlineType(field.type)) {
    return (
      <InlineAtomInput
        field={field}
        atom={value[0]}
        onCommit={(atom) => onChange(atom === null ? (canRemove ? [] : value) : [atom])}
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {value.map((atom, i) => (
        <span key={`${atom}-${i}`} className={chipClass}>
          <AtomView field={field} atom={atom} />
          {canRemove && (
            <button
              type="button"
              aria-label="Remove"
              onClick={() => removeAt(i)}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
            >
              <XIcon className="size-3" />
            </button>
          )}
        </span>
      ))}
      {(field.multiple || value.length === 0) && <AtomAdder field={field} onAdd={add} />}
    </div>
  );
}

/** Single values of these types are edited in place with a plain input. */
const isInlineType = (type: FieldDef["type"]) =>
  type === "text" ||
  type === "number" ||
  type === "date" ||
  type === "datetime" ||
  type === "image";

const nativeInputType = (type: FieldDef["type"]) =>
  type === "number"
    ? "number"
    : type === "date"
      ? "date"
      : type === "datetime"
        ? "datetime-local"
        : type === "image"
          ? "url"
          : "text";

/** A single text/number/date/image value, edited in place; commits on Enter/blur (or pick). */
function InlineAtomInput({
  field,
  atom,
  onCommit,
}: {
  field: FieldDef;
  atom: FieldAtom | undefined;
  onCommit: (atom: FieldAtom | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const current = atom === undefined ? "" : String(atom);
  const commit = (raw: string) => {
    setDraft(null);
    if (raw === current) return;
    const parsed = parseAtom(field.type, raw);
    // Invalid input reverts; empty input clears (if allowed).
    if (parsed !== null || raw.trim() === "") onCommit(parsed);
  };
  const isPicker = field.type === "date" || field.type === "datetime";

  return (
    <div className="flex min-w-0 items-center gap-1">
      {field.type === "image" && typeof atom === "string" && (
        <img src={atom} alt="" className="size-5 shrink-0 rounded object-cover" />
      )}
      <input
        type={nativeInputType(field.type)}
        aria-label={field.name}
        placeholder={field.type === "image" ? "https://…" : "Empty"}
        value={draft ?? current}
        onChange={(e) => (isPicker ? commit(e.target.value) : setDraft(e.target.value))}
        onBlur={(e) => !isPicker && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={`${inputClass} ${(draft ?? current) === "" ? "text-gray-400" : ""}`}
      />
    </div>
  );
}

/** Read-only rendering of one value (inside a chip). */
function AtomView({ field, atom }: { field: FieldDef; atom: FieldAtom }) {
  switch (field.type) {
    case "icon":
      return <IconByName name={String(atom)} label={String(atom)} className="size-3.5" />;
    case "image":
      return <img src={String(atom)} alt="" className="size-5 rounded object-cover" />;
    case "date":
    case "datetime":
      return <span className="truncate">{formatDateAtom(field.type, atom)}</span>;
    default:
      return <span className="truncate">{String(atom)}</span>;
  }
}

/** Control for adding a value: a picker for icons/dates, a text box otherwise. */
function AtomAdder({ field, onAdd }: { field: FieldDef; onAdd: (atom: FieldAtom) => void }) {
  const [draft, setDraft] = useState("");

  if (field.type === "icon") {
    return (
      <IconPicker label={`Add ${field.name}`} onPick={onAdd} triggerClassName={iconButtonClass}>
        <PlusIcon className="size-3.5" />
      </IconPicker>
    );
  }
  if (field.type === "date" || field.type === "datetime") {
    return (
      <input
        type={nativeInputType(field.type)}
        aria-label={`Add ${field.name}`}
        value=""
        onChange={(e) => {
          const atom = parseAtom(field.type, e.target.value);
          if (atom !== null) onAdd(atom);
        }}
        className={`${inputClass} w-auto`}
      />
    );
  }

  const submit = () => {
    const atom = parseAtom(field.type, draft);
    if (atom !== null) {
      onAdd(atom);
      setDraft("");
    }
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };
  return (
    <input
      type={nativeInputType(field.type)}
      aria-label={`Add ${field.name}`}
      placeholder="Add…"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={submit}
      className={`${inputClass} w-20 flex-1`}
    />
  );
}
