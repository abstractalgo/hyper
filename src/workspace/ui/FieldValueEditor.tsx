import { Menu } from "@base-ui/react/menu";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useCanvasStore } from "../../store/canvas";
import { IconByName, TypeIcon } from "../icons";
import {
  formatDateAtom,
  INPUT_SPECS,
  parseAtom,
  type FieldAtom,
  type FieldValue,
  type InputType,
} from "../model";
import { isForNotes, valueKind, type Entry } from "../typeSystem";
import { IconPicker } from "./IconPicker";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups";
import { SelectEditor } from "./SelectEditor";

type FieldValueEditorProps = {
  /** The field: its key, label (from its declaration) and what its values are. */
  entry: Entry;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** Note being edited, if any: excluded from its own reference pickers. */
  noteId?: string;
  /**
   * Editing a value in settings (a default, a condition): a required field can be cleared there
   * (validation reports it instead), and pickers don't change the field's options.
   */
  inSettings?: boolean;
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

/** Edits one field's value, by what its values are: notes, types, or typed or picked values. */
export function FieldValueEditor({
  entry,
  value,
  onChange,
  noteId,
  inSettings = false,
}: FieldValueEditorProps) {
  const createOptionNote = useCanvasStore((s) => s.createOptionNote);
  const removeOption = useCanvasStore((s) => s.removeOption);
  const kind = valueKind(entry.type);
  const label = entry.decl?.label ?? "";
  const mayBeEmpty = inSettings || entry.optional;
  const canRemove = mayBeEmpty || value.length > 1;

  if (kind.kind === "note") {
    // Only fields listing their options get new ones; settings don't change them.
    const editsOptions = !inSettings && kind.within === null;
    return (
      <SelectEditor
        label={label}
        many={kind.many}
        options={kind.options}
        within={kind.within}
        value={value.map(String)}
        onChange={onChange}
        onCreateOption={
          editsOptions ? (title) => createOptionNote(entry.key, title, noteId) : undefined
        }
        onRemoveOption={editsOptions ? (id) => removeOption(entry.key, id) : undefined}
        noteId={noteId}
        allowEmpty={mayBeEmpty}
      />
    );
  }

  if (kind.kind === "type") {
    return (
      <TypesValue
        label={label}
        many={kind.many}
        value={value.map(String)}
        onChange={onChange}
        allowEmpty={mayBeEmpty}
      />
    );
  }

  // Typed or picked values hold one value each.
  const set = (atom: FieldAtom | null) =>
    onChange(atom === null ? (canRemove ? [] : value) : [atom]);
  const { input } = kind;
  if (input === "date" || input === "datetime") {
    return <DateValue input={input} label={label} atom={value[0]} onPick={set} />;
  }
  if (input !== "icon") {
    return <InlineAtomInput input={input} label={label} atom={value[0]} onCommit={set} />;
  }

  // An icon: shown as a chip (removable if it may be empty), or a picker.
  const icon = value[0];
  if (icon === undefined) {
    return (
      <IconPicker
        label={`Choose ${label}`}
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

const typeItemClass =
  "flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-2 text-xs outline-none select-none data-highlighted:bg-gray-100";

/** Named types as values (e.g. a note's Type): their names as pills; a menu to pick them. */
function TypesValue({
  label,
  many,
  value,
  onChange,
  allowEmpty,
}: {
  label: string;
  many: boolean;
  value: string[];
  onChange: (value: FieldValue) => void;
  allowEmpty: boolean;
}) {
  const container = usePopupContainer();
  const allTypes = useCanvasStore((s) => s.types);
  // Types notes can be of (and any already picked).
  const types = allTypes.filter((t) => value.includes(t.id) || isForNotes(t, allTypes));
  const toggle = (id: string) => {
    if (!value.includes(id)) {
      onChange(many ? [...value, id] : [id]);
    } else if (allowEmpty || value.length > 1) {
      onChange(value.filter((v) => v !== id));
    }
  };
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className="-ml-1 flex min-h-6 w-full min-w-0 flex-wrap items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100"
      >
        {value.map((id) => (
          <span
            key={id}
            className="inline-flex max-w-full items-center gap-1 rounded bg-gray-100 px-1.5 py-px text-xs leading-5 text-gray-800"
          >
            <TypeIcon typeId={id} className="size-3.5" />
            <span className="truncate">
              {allTypes.find((t) => t.id === id)?.name ?? "deleted type"}
            </span>
          </span>
        ))}
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`min-w-40 py-1 ${POPUP_CLASS}`}>
            {types.map((type) => (
              <Menu.Item
                key={type.id}
                onClick={() => toggle(type.id)}
                closeOnClick={!many}
                className={typeItemClass}
              >
                <span className="flex size-3.5 items-center justify-center">
                  {value.includes(type.id) && <CheckIcon className="size-3.5" />}
                </span>
                <TypeIcon typeId={type.id} className="size-3.5" />
                {type.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/**
 * A date shown as plain text, as wide as the text (blank when there's none). Clicking it opens
 * the browser's date picker, anchored on the text: an invisible date input underneath only
 * provides the picker, so its own width and calendar icon don't take up room.
 */
function DateValue({
  input,
  label,
  atom,
  onPick,
}: {
  input: "date" | "datetime";
  label: string;
  atom: FieldAtom | undefined;
  /** The picked value, or null when the picker's "Clear" was used. */
  onPick: (atom: FieldAtom | null) => void;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const current = atom === undefined ? "" : String(atom);
  const text = current ? formatDateAtom(input, current) : "";

  return (
    // min-w-12: empty, it's still wide enough to click.
    <span className="relative inline-flex min-w-12 first:-ml-[5px]">
      <button
        type="button"
        aria-label={`${label}: ${text || "not set"}`}
        onClick={() => pickerRef.current?.showPicker()}
        className={dateTextClass}
      >
        {text}
      </button>
      <input
        ref={pickerRef}
        type={nativeInputType(input)}
        tabIndex={-1}
        aria-hidden
        value={current}
        onChange={(e) => onPick(e.target.value === "" ? null : parseAtom(input, e.target.value))}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      />
    </span>
  );
}

const nativeInputType = (input: InputType) => INPUT_SPECS[input].input ?? "text";

/** A single text/number/image value, edited in place; commits on Enter/blur. */
function InlineAtomInput({
  input,
  label,
  atom,
  onCommit,
}: {
  input: InputType;
  label: string;
  atom: FieldAtom | undefined;
  onCommit: (atom: FieldAtom | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const current = atom === undefined ? "" : String(atom);
  const { disallowed } = INPUT_SPECS[input];
  const commit = (raw: string) => {
    setDraft(null);
    if (raw === current) {
      return;
    }
    const parsed = parseAtom(input, raw);
    // Invalid input reverts; empty input clears (if allowed).
    if (parsed !== null || raw.trim() === "") {
      onCommit(parsed);
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-1">
      {input === "image" && typeof atom === "string" && (
        <img src={atom} alt="" className="size-5 shrink-0 rounded object-cover" />
      )}
      <input
        type={nativeInputType(input)}
        inputMode={input === "number" ? "decimal" : undefined}
        aria-label={label}
        placeholder={input === "image" ? "https://…" : "Empty"}
        value={draft ?? current}
        onChange={(e) =>
          setDraft(disallowed ? e.target.value.replace(disallowed, "") : e.target.value)
        }
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
