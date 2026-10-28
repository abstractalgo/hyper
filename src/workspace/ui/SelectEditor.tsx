import { Popover } from "@base-ui/react/popover";
import { go as fuzzySearch } from "fuzzysort";
import { ChevronLeftIcon, EllipsisIcon, TrashIcon, XIcon } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";

import { newId } from "../../store/canvas.ts";
import {
  OPTION_COLOR_CLASSES,
  OPTION_COLORS,
  type FieldDef,
  type FieldValue,
  type OptionColor,
  type SelectOption,
} from "../model.ts";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups.tsx";

type SelectEditorProps = {
  field: FieldDef;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  /** Options were created, renamed, recolored or deleted. */
  onFieldChange: (field: FieldDef) => void;
  /** Whether the last value may be removed (false for mandatory fields). */
  allowEmpty: boolean;
};

const randomColor = (): OptionColor =>
  OPTION_COLORS[Math.floor(Math.random() * OPTION_COLORS.length)]!;

export function OptionPill({ option, onRemove }: { option: SelectOption; onRemove?: () => void }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-0.5 rounded px-1.5 py-px text-xs leading-5 ${OPTION_COLOR_CLASSES[option.color]}`}
    >
      <span className="truncate">{option.name}</span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${option.name}`}
          onClick={onRemove}
          className="-mr-1 rounded opacity-60 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Notion-style select / multi-select: the value shows as colored pills; clicking opens a
 * searchable list where you pick an option, create one by typing a new name, or edit one.
 */
export function SelectEditor({
  field,
  value,
  onChange,
  onFieldChange,
  allowEmpty,
}: SelectEditorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const container = usePopupContainer();

  const selected = value.flatMap((id) => field.options.filter((o) => o.id === id));
  const canRemove = allowEmpty || selected.length > 1;
  const trimmed = query.trim();

  const matches = useMemo(
    () =>
      trimmed
        ? fuzzySearch(trimmed, field.options, { key: "name", threshold: 0, limit: 50 }).map(
            (r) => r.obj,
          )
        : field.options,
    [field.options, trimmed],
  );
  const canCreate =
    trimmed !== "" && !field.options.some((o) => o.name.toLowerCase() === trimmed.toLowerCase());
  const rowCount = matches.length + (canCreate ? 1 : 0);

  const remove = (id: string) => onChange(value.filter((v) => v !== id));
  const pick = (option: SelectOption) => {
    setQuery("");
    setActive(0);
    if (!field.multiple) {
      onChange([option.id]);
      setOpen(false);
      return;
    }
    if (value.includes(option.id)) {
      if (canRemove) remove(option.id);
    } else {
      onChange([...value, option.id]);
    }
  };
  const create = () => {
    const option: SelectOption = { id: newId(), name: trimmed, color: randomColor() };
    // The option has to exist on the field before a value can point at it.
    onFieldChange({ ...field, options: [...field.options, option] });
    pick(option);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (rowCount === 0 ? 0 : (i + step + rowCount) % rowCount));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = matches[active];
      if (option) pick(option);
      else if (canCreate) create();
    } else if (e.key === "Backspace" && query === "" && selected.length > 0 && canRemove) {
      remove(selected[selected.length - 1]!.id);
    }
  };

  const editing = field.options.find((o) => o.id === editingId);

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
          selected.map((o) => <OptionPill key={o.id} option={o} />)
        ) : (
          <span className="text-xs text-gray-400">Empty</span>
        )}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={2} align="start" className={POSITIONER_CLASS}>
          <Popover.Popup initialFocus={inputRef} className={`w-64 ${POPUP_CLASS}`}>
            {editing ? (
              <OptionEditor
                option={editing}
                field={field}
                onBack={() => setEditingId(null)}
                onFieldChange={onFieldChange}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1.5">
                  {selected.map((o) => (
                    <OptionPill
                      key={o.id}
                      option={o}
                      onRemove={canRemove ? () => remove(o.id) : undefined}
                    />
                  ))}
                  <input
                    ref={inputRef}
                    aria-label={`Search or create ${field.name}`}
                    placeholder={selected.length ? "" : "Search for an option…"}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={handleKeyDown}
                    className="h-6 min-w-16 flex-1 bg-transparent text-xs outline-none"
                  />
                </div>
                <p className="px-3 pt-2 pb-1 text-[11px] text-gray-500">
                  Select an option or create one
                </p>
                <ul className="max-h-56 overflow-y-auto px-1 pb-1">
                  {matches.map((option, i) => (
                    <li
                      key={option.id}
                      aria-current={active === i}
                      className="group flex items-center gap-1 rounded px-2 py-1 aria-current:bg-gray-100"
                    >
                      <button
                        type="button"
                        onClick={() => pick(option)}
                        onMouseEnter={() => setActive(i)}
                        className="flex min-w-0 flex-1 items-center text-left"
                      >
                        <OptionPill option={option} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${option.name}`}
                        onClick={() => setEditingId(option.id)}
                        className="rounded p-0.5 text-gray-400 opacity-0 group-hover:opacity-100 group-aria-current:opacity-100 hover:bg-gray-200 hover:text-gray-700"
                      >
                        <EllipsisIcon className="size-3.5" />
                      </button>
                    </li>
                  ))}
                  {canCreate && (
                    <li
                      aria-current={active === matches.length}
                      className="rounded aria-current:bg-gray-100"
                    >
                      <button
                        type="button"
                        onClick={create}
                        onMouseEnter={() => setActive(matches.length)}
                        className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-gray-600"
                      >
                        Create
                        <OptionPill option={{ id: "", name: trimmed, color: "gray" }} />
                      </button>
                    </li>
                  )}
                  {rowCount === 0 && (
                    <li className="px-2 py-1 text-xs text-gray-400">
                      No options yet. Type to create one.
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

/** Rename / recolor / delete one option (the "⋯" view of the picker). */
function OptionEditor({
  option,
  field,
  onBack,
  onFieldChange,
}: {
  option: SelectOption;
  field: FieldDef;
  onBack: () => void;
  onFieldChange: (field: FieldDef) => void;
}) {
  const [name, setName] = useState(option.name);
  const update = (patch: Partial<SelectOption>) =>
    onFieldChange({
      ...field,
      options: field.options.map((o) => (o.id === option.id ? { ...o, ...patch } : o)),
    });

  const trimmed = name.trim();
  const duplicate = field.options.some(
    (o) => o.id !== option.id && o.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const commitName = () => {
    if (trimmed && !duplicate && trimmed !== option.name) update({ name: trimmed });
    else setName(option.name);
  };

  // A mandatory field must keep a default; it can't lose its only default option.
  const defaultsLeft = field.defaultValue.filter((id) => id !== option.id);
  const canDelete = !field.required || defaultsLeft.length > 0;
  const handleDelete = () => {
    onFieldChange({
      ...field,
      options: field.options.filter((o) => o.id !== option.id),
      defaultValue: defaultsLeft,
    });
    onBack();
  };

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
        aria-label="Option name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="mb-1 h-7 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-500 aria-invalid:border-red-500"
        aria-invalid={duplicate || !trimmed}
      />
      {duplicate && <p className="mb-1 text-[11px] text-red-600">Another option has this name.</p>}
      <p className="mt-2 mb-1 px-1 text-[11px] text-gray-500">Color</p>
      <ul>
        {OPTION_COLORS.map((color) => (
          <li key={color}>
            <button
              type="button"
              aria-pressed={option.color === color}
              onClick={() => update({ color })}
              className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs capitalize hover:bg-gray-100 aria-pressed:font-medium"
            >
              <span className={`size-3.5 rounded ${OPTION_COLOR_CLASSES[color]}`} />
              {color}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={!canDelete}
        title={canDelete ? undefined : "This is the mandatory field's only default"}
        onClick={handleDelete}
        className="mt-2 flex w-full items-center gap-1.5 rounded px-1 py-1 text-left text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <TrashIcon className="size-3.5" />
        Delete option
      </button>
    </div>
  );
}
