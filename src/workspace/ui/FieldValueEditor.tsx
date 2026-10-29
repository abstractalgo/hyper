import { PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useCanvasStore } from "../../store/canvas";
import { IconByName } from "../icons";
import {
  atomsOf,
  FIELD_TYPE_SPECS,
  formatDateAtom,
  parseAtom,
  type FieldAtom,
  type FieldDef,
  type FieldType,
  type FieldValue,
} from "../model";
import { IconPicker } from "./IconPicker";
import { SelectEditor } from "./SelectEditor";

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
// Inputs are as wide as what's in them (or their placeholder), not the whole row.
const inputClass =
  "h-6 min-w-[min(4rem,100%)] max-w-full field-sizing-content first:-ml-[5px] rounded border border-transparent bg-transparent px-1 text-xs text-gray-800 outline-none hover:border-gray-200 focus:border-blue-500 focus:bg-white";
// Like an input (see inputClass), but sized by its text.
const dateTextClass =
  "h-6 flex-1 truncate rounded border border-transparent px-1 text-left text-xs text-gray-800 outline-none hover:border-gray-200 focus-visible:border-blue-500";
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

  if (field.type === "select") {
    const changeField = onFieldChange ?? saveField;
    return (
      <SelectEditor
        field={field}
        value={atomsOf("select", value)}
        onChange={onChange}
        onOptionIdsChange={(optionIds) => changeField({ ...field, optionIds })}
        onCreateOption={(title) => {
          const id = createOptionNote(field.id, title, {
            nearNoteId: noteId,
            siblingIds: field.optionIds,
          });
          // The store already added it to the saved field; a settings draft needs it too.
          if (onFieldChange) {
            onFieldChange({ ...field, optionIds: [...field.optionIds, id] });
          }
          return id;
        }}
        noteId={noteId}
        allowEmpty={allowEmpty || !field.required}
      />
    );
  }

  // Only selects hold several values (see SelectEditor); every other field holds one.
  if (isDateField(field)) {
    return (
      <DateValue
        field={field}
        atom={value[0]}
        onPick={(atom) => onChange(atom === null ? (canRemove ? [] : value) : [atom])}
      />
    );
  }

  if (isInlineType(field.type)) {
    return (
      <InlineAtomInput
        field={field}
        atom={value[0]}
        onCommit={(atom) => onChange(atom === null ? (canRemove ? [] : value) : [atom])}
      />
    );
  }

  // What's left is an icon: shown as a chip (removable if it may be empty), or a picker.
  const icon = value[0];
  if (icon === undefined) {
    return (
      <IconPicker
        label={`Choose ${field.name}`}
        onPick={(picked) => onChange([picked])}
        triggerClassName={iconButtonClass}
      >
        <PlusIcon className="size-3.5" />
      </IconPicker>
    );
  }
  return (
    <span className={chipClass}>
      <IconByName name={String(icon)} label={String(icon)} className="size-3.5" />
      {canRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={() => onChange([])}
          className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}

const isDateField = (field: FieldDef): field is FieldDef & { type: "date" | "datetime" } =>
  field.type === "date" || field.type === "datetime";

/**
 * A date shown as plain text, as wide as the text (blank when there's none). Clicking it opens
 * the browser's date picker, anchored on the text: an invisible date input underneath only
 * provides the picker, so its own width and calendar icon don't take up room.
 */
function DateValue({
  field,
  atom,
  onPick,
}: {
  field: FieldDef & { type: "date" | "datetime" };
  atom: FieldAtom | undefined;
  /** The picked value, or null when the picker's "Clear" was used. */
  onPick: (atom: FieldAtom | null) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const current = atom === undefined ? "" : String(atom);
  const text = current ? formatDateAtom(field.type, current) : "";

  return (
    // min-w-12: empty, it's still wide enough to click.
    <span className="relative inline-flex min-w-12 first:-ml-[5px]">
      <button
        type="button"
        aria-label={`${field.name}: ${text || "not set"}`}
        onClick={() => pickerRef.current?.showPicker()}
        className={dateTextClass}
      >
        {text}
      </button>
      <input
        ref={pickerRef}
        type={nativeInputType(field.type)}
        tabIndex={-1}
        aria-hidden
        value={current}
        onChange={(e) =>
          onPick(e.target.value === "" ? null : parseAtom(field.type, e.target.value))
        }
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      />
    </span>
  );
}

/** Single values of types with a native input (text, number, URL) are edited in place. */
const isInlineType = (type: FieldType) => FIELD_TYPE_SPECS[type].input !== null;
const nativeInputType = (type: FieldType) => FIELD_TYPE_SPECS[type].input ?? "text";

/** A single text/number/image value, edited in place; commits on Enter/blur. */
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
    if (raw === current) {
      return;
    }
    const parsed = parseAtom(field.type, raw);
    // Invalid input reverts; empty input clears (if allowed).
    if (parsed !== null || raw.trim() === "") {
      onCommit(parsed);
    }
  };
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
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
