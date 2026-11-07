import { Menu } from "@base-ui/react/menu";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

import { newId, useCanvasStore } from "../../store/canvas";
import { FieldIcon, IconByName, TypeIcon } from "../icons";
import {
  INPUT_SPECS,
  INPUT_TYPES,
  TYPE_COLOR_CLASSES,
  TYPE_COLORS,
  type InputType,
} from "../model";
import { rowKey, searchNotes, type NoteRow } from "../noteSearch";
import {
  allOf,
  declarations,
  dependsOn,
  fieldParts,
  isSelf,
  members,
  NOTE_TYPE_ID,
  TYPE_KEY,
  type Entry,
  type KeyId,
  type NamedType,
  type NotesField,
  type TypeExpr,
  type TypeId,
} from "../typeSystem";
import { Dropdown } from "./Dropdown";
import { FieldValueEditor } from "./FieldValueEditor";
import { IconPicker } from "./IconPicker";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups";
import { ResultList, useListNavigation } from "./ResultList";
import { CreateRow, NotePill } from "./SelectEditor";
import {
  DeleteButton,
  FormErrors,
  FormRow,
  SettingsCollection,
  textInputClass,
  useAutoSave,
  type ItemFormProps,
  type ListItem,
} from "./settingsLayout";
import { TypeBuilder } from "./TypeBuilder";

/** A new type notes can be of; it has no fields yet. */
const blankType = (): NamedType => {
  const id = newId();
  return {
    id,
    name: "",
    icon: "file-text",
    color: "gray",
    expr: { kind: "shape", entries: [isSelf(id)] },
  };
};

/** A new collection: a type that only has conditions (none yet: every note). */
const blankCollection = (): NamedType => ({
  id: newId(),
  name: "",
  icon: "list-filter",
  color: "gray",
  expr: { kind: "group", mode: "all", of: [] },
});

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** How many notes match a type (its detail in the list). */
function useMemberCounts() {
  const nodes = useCanvasStore((s) => s.nodes);
  const types = useCanvasStore((s) => s.types);
  return new Map(
    types.map((t) => [t.id, members({ kind: "ref", typeId: t.id }, { nodes, types }).length]),
  );
}

const typeListItem = (t: NamedType, count: number): ListItem => ({
  id: t.id,
  label: t.name,
  detail: `${plural(count, "note")}${t.builtIn ? " · built-in" : ""}`,
  icon: <TypeIcon typeId={t.id} className="size-4" />,
});

export function TypesTab() {
  const types = useCanvasStore((s) => s.types);
  const counts = useMemberCounts();
  return (
    <SettingsCollection
      // The built-in Note type only declares Type and Icon.
      items={types.filter((t) => t.id !== NOTE_TYPE_ID)}
      toListItem={(t) => typeListItem(t, counts.get(t.id) ?? 0)}
      actions={[
        { label: "New type", create: blankType },
        { label: "New collection", create: blankCollection },
      ]}
      Form={TypeForm}
      emptyText="Select a type, or create one: a type for notes (with fields), or a collection of notes (with conditions)."
    />
  );
}

/** A field of the type, as the form edits it: declared here, or picked from another type. */
type FieldItem = { entry: Entry } | { from: TypeId; key: KeyId };

/**
 * A type's expression, taken apart for the form. A type is either a record (like a TypeScript
 * object type: `{ type: Self }` and its fields, declared or picked) or a collection (conditions
 * on other types' notes, like unions and conditional types); `record` says which.
 */
type Parts = {
  record: boolean;
  forNotes: boolean;
  fields: FieldItem[];
  conditions: TypeExpr[];
};

/** A part only records have: a shape declaring fields (or none yet), or picked fields. */
const isRecordPart = (part: TypeExpr) =>
  part.kind === "pick" ||
  (part.kind === "shape" &&
    (part.entries.length === 0 ||
      part.entries.some((e) => e.decl || (e.key === TYPE_KEY && e.type.kind === "object"))));

function parse(type: NamedType): Parts {
  const top = type.expr.kind === "group" && type.expr.mode === "all" ? type.expr.of : [type.expr];
  const parts: Parts = {
    record: false,
    forNotes: false,
    fields: [],
    conditions: [],
  };
  for (const part of top) {
    if (part.kind === "shape") {
      for (const entry of part.entries) {
        const self = entry.key === TYPE_KEY && !entry.optional && entry.type.kind === "object";
        if (self && entry.type.kind === "object" && entry.type.id === type.id) {
          parts.forNotes = true;
        } else if (entry.decl) {
          parts.fields.push({ entry });
        } else {
          parts.conditions.push({ kind: "shape", entries: [entry] });
        }
      }
    } else if (part.kind === "pick" && part.from.kind === "ref") {
      const from = part.from.typeId;
      parts.fields.push(...part.keys.map((key) => ({ from, key })));
    } else {
      parts.conditions.push(part);
    }
  }
  // A type with fields is a record; so is one with nothing yet but a record's parts ("New type").
  // Without fields, conditions make it a collection.
  parts.record =
    parts.fields.length > 0 || (parts.conditions.length === 0 && top.some(isRecordPart));
  return parts;
}

function build(typeId: TypeId, { record, forNotes, fields, conditions }: Parts): TypeExpr {
  // Notes are declared as records, never as collections.
  const own = fieldParts(fields as NotesField[], record && forNotes ? [isSelf(typeId)] : []);
  // A record with nothing in it yet is still a record: an empty shape.
  const recordParts: TypeExpr[] =
    record && own.length === 0 ? [{ kind: "shape", entries: [] }] : own;
  return allOf([...recordParts, ...conditions]);
}

/** The conditions as the builder's top-level group (a single group shows as itself). */
const asGroup = (conditions: TypeExpr[]): Extract<TypeExpr, { kind: "group" }> => {
  const [only] = conditions;
  return conditions.length === 1 && only?.kind === "group"
    ? only
    : { kind: "group", mode: "all", of: conditions };
};

/** How many notes a type's preview lists; the rest are counted. */
const PREVIEW_LIMIT = 40;

function TypeForm({ initial, isNew, onSaved, onDeleted }: ItemFormProps<NamedType>) {
  const [draft, setDraft] = useState(initial);
  const nodes = useCanvasStore((s) => s.nodes);
  const types = useCanvasStore((s) => s.types);
  const saveType = useCanvasStore((s) => s.saveType);
  const deleteType = useCanvasStore((s) => s.deleteType);

  const parts = parse(draft);
  const setParts = (patch: Partial<Parts>) =>
    setDraft((d) => ({ ...d, expr: build(d.id, { ...parse(d), ...patch }) }));
  // With the draft in place of the saved type, so the preview follows unsaved edits.
  const scope = { nodes, types: [...types.filter((t) => t.id !== draft.id), draft] };
  const matching = members({ kind: "ref", typeId: draft.id }, scope);
  const otherDeclared = declarations(types.filter((t) => t.id !== draft.id));
  const errors = [
    ...(draft.name.trim() ? [] : ["Name is required."]),
    ...(parts.fields.some((f) => "entry" in f && !f.entry.decl?.label.trim())
      ? ["Every field needs a name."]
      : []),
    ...(dependsOn(draft.expr, draft.id, scope.types)
      ? ["A type can't include itself, directly or through other types."]
      : []),
  ];

  // Changes save as soon as the type is valid; a new type appears in the list then.
  useAutoSave(draft, errors.length === 0, (d) => {
    const type = { ...d, name: d.name.trim() };
    saveType(type);
    if (isNew) {
      onSaved(type);
    }
  });

  const handleDelete = () => {
    const users = types.filter((t) => t.id !== draft.id && dependsOn(t.expr, draft.id, types));
    const message =
      `Delete the type “${draft.name}”?` +
      (matching.length ? ` ${plural(matching.length, "note")} are no longer of it.` : "") +
      (users.length ? ` ${plural(users.length, "other type")} use it.` : "");
    if (window.confirm(message)) {
      deleteType(draft.id);
      onDeleted();
    }
  };

  const setField = (index: number, item: FieldItem) =>
    setParts({ fields: parts.fields.map((f, i) => (i === index ? item : f)) });
  const moveField = (from: number, to: number) => {
    const fields = [...parts.fields];
    const [item] = fields.splice(from, 1);
    fields.splice(to, 0, item!);
    setParts({ fields });
  };
  const present = new Set(parts.fields.map((f) => ("entry" in f ? f.entry.key : f.key)));

  return (
    <form className="flex flex-col gap-2.5" onSubmit={(e) => e.preventDefault()}>
      <FormRow label="Name">
        <input
          aria-label="Type name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="e.g. Task, or Open tasks"
          className={textInputClass}
        />
      </FormRow>
      <FormRow label="Icon">
        <div className="flex items-center gap-2">
          <IconPicker
            label="Choose icon"
            onPick={(icon) => setDraft((d) => ({ ...d, icon }))}
            triggerClassName="flex size-7 items-center justify-center rounded border border-gray-300 hover:bg-gray-50"
          >
            <IconByName name={draft.icon} className={`size-4 ${TYPE_COLOR_CLASSES[draft.color]}`} />
          </IconPicker>
          <fieldset className="flex gap-1">
            <legend className="sr-only">Color</legend>
            {TYPE_COLORS.map((color) => (
              <label
                key={color}
                title={color}
                className="flex size-5 cursor-pointer items-center justify-center rounded-full border border-transparent has-checked:border-gray-900 has-focus-visible:outline-2 has-focus-visible:outline-blue-600"
              >
                <input
                  type="radio"
                  name="type-color"
                  value={color}
                  aria-label={color}
                  checked={draft.color === color}
                  onChange={() => setDraft((d) => ({ ...d, color }))}
                  className="sr-only"
                />
                <span className={`size-3 rounded-full bg-current ${TYPE_COLOR_CLASSES[color]}`} />
              </label>
            ))}
          </fieldset>
        </div>
      </FormRow>
      {parts.record && (
        <>
          <FormRow
            label="Notes"
            hint="Notes of this type have it in their Type field: they show its fields, and match it."
          >
            {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="flex items-center gap-1.5 pt-1 text-sm">
              <input
                type="checkbox"
                checked={parts.forNotes}
                disabled={draft.builtIn}
                onChange={(e) => setParts({ forNotes: e.target.checked })}
              />
              Notes can be of this type
            </label>
          </FormRow>
          <FormRow label="Fields" hint="Notes of this type show these fields, in this order.">
            <ul className="divide-y divide-gray-100 rounded border border-gray-200">
              {parts.fields.map((item, i) => (
                <li key={"entry" in item ? item.entry.key : item.key}>
                  <FieldRow
                    item={item}
                    onChange={(next) => setField(i, next)}
                    onRemove={() => setParts({ fields: parts.fields.filter((_, j) => j !== i) })}
                    onMove={(delta) => moveField(i, i + delta)}
                    first={i === 0}
                    last={i === parts.fields.length - 1}
                  />
                </li>
              ))}
              {parts.fields.length === 0 && (
                <li className="px-2 py-1 text-sm text-gray-500">No fields yet.</li>
              )}
            </ul>
            <AddField
              others={[...otherDeclared.values()].filter(
                (e) => !present.has(e.key) && e.key !== TYPE_KEY,
              )}
              onAdd={(item) => setParts({ fields: [...parts.fields, item] })}
            />
          </FormRow>
        </>
      )}
      {/* Collections have conditions; so does a record that was given some (kept, not hidden). */}
      {(!parts.record || parts.conditions.length > 0) && (
        <FormRow label="Conditions">
          <TypeBuilder
            type={asGroup(parts.conditions)}
            onChange={(group) =>
              setParts({ conditions: group.mode === "all" ? group.of : [group] })
            }
            selfId={draft.id}
          />
        </FormRow>
      )}
      <FormRow label="Matches">
        <p className="pt-1.5 text-xs text-gray-600">{plural(matching.length, "note")}</p>
        {matching.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {matching.slice(0, PREVIEW_LIMIT).map((n) => (
              <NotePill key={n.id} noteId={n.id} />
            ))}
            {matching.length > PREVIEW_LIMIT && (
              <span className="px-1 text-xs leading-5 text-gray-500">
                and {matching.length - PREVIEW_LIMIT} more
              </span>
            )}
          </div>
        )}
      </FormRow>

      <FormErrors errors={errors} />
      {!isNew && !draft.builtIn && <DeleteButton label="Delete type" onClick={handleDelete} />}
    </form>
  );
}

const iconButtonClass = "rounded p-0.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30";
const menuItemClass =
  "flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-2 text-sm outline-none select-none data-highlighted:bg-gray-100";

/** "Add field": a new one declared here, or one picked from the type that declares it. */
function AddField({
  others,
  onAdd,
}: {
  others: (Entry & { typeId: TypeId })[];
  onAdd: (item: FieldItem) => void;
}) {
  const container = usePopupContainer();
  const types = useCanvasStore((s) => s.types);
  const blank: Entry = {
    key: newId(),
    optional: true,
    type: { kind: "primitive", name: "text" },
    decl: { label: "" },
  };
  return (
    <Menu.Root>
      <Menu.Trigger className="mt-1 -ml-1.5 flex h-6 items-center gap-1 rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 data-popup-open:bg-gray-100">
        <PlusIcon className="size-3.5" />
        Add field
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`max-h-80 min-w-56 overflow-y-auto py-1 ${POPUP_CLASS}`}>
            <Menu.Item onClick={() => onAdd({ entry: blank })} className={menuItemClass}>
              <PlusIcon className="size-3.5 text-gray-500" />
              New field
            </Menu.Item>
            {others.length > 0 && (
              <Menu.Group>
                <Menu.GroupLabel className="px-3 pt-2 pb-1 text-xs text-gray-500">
                  From another type
                </Menu.GroupLabel>
                {others.map((field) => (
                  <Menu.Item
                    key={field.key}
                    onClick={() => onAdd({ from: field.typeId, key: field.key })}
                    className={menuItemClass}
                  >
                    <FieldIcon entry={field} className="size-3.5" />
                    {field.decl?.label}
                    <span className="ml-auto pl-3 text-xs text-gray-500">
                      {types.find((t) => t.id === field.typeId)?.name}
                    </span>
                  </Menu.Item>
                ))}
              </Menu.Group>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** One field: a picked one shows where it's from; a declared one expands to edit it. */
function FieldRow({
  item,
  onChange,
  onRemove,
  onMove,
  first,
  last,
}: {
  item: FieldItem;
  onChange: (item: FieldItem) => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  first: boolean;
  last: boolean;
}) {
  const types = useCanvasStore((s) => s.types);
  const picked = "entry" in item ? null : declarations(types).get(item.key);
  const entry = "entry" in item ? item.entry : picked;
  // A new field (no name yet) starts open.
  const [open, setOpen] = useState("entry" in item && !item.entry.decl?.label);
  const label = entry?.decl?.label ?? "Deleted field";
  const detail =
    "entry" in item
      ? `${describe(item.entry.type)}${item.entry.optional ? "" : " · required"}`
      : `from ${types.find((t) => t.id === item.from)?.name ?? "a deleted type"}`;

  return (
    <div className="text-sm">
      <div className="flex items-center gap-1.5 px-1.5 py-0.5">
        {"entry" in item ? (
          <button
            type="button"
            aria-label={open ? `Close ${label}` : `Edit ${label}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="rounded p-0.5 text-gray-500 hover:bg-gray-100"
          >
            {open ? (
              <ChevronDownIcon className="size-3.5" />
            ) : (
              <ChevronRightIcon className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="size-4.5" />
        )}
        {entry && <FieldIcon entry={entry} className="size-3.5" />}
        <span className="min-w-0 flex-1 truncate">
          {label || <span className="text-gray-400">New field</span>}
          <span className="ml-2 text-xs text-gray-500">{detail}</span>
        </span>
        <button
          type="button"
          aria-label="Move up"
          disabled={first}
          onClick={() => onMove(-1)}
          className={iconButtonClass}
        >
          <ArrowUpIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Move down"
          disabled={last}
          onClick={() => onMove(1)}
          className={iconButtonClass}
        >
          <ArrowDownIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className={iconButtonClass}
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      {"entry" in item && open && (
        <FieldEditor entry={item.entry} onChange={(next) => onChange({ entry: next })} />
      )}
    </div>
  );
}

/** What a field's values can be, as the form offers it. */
type ValueChoice = InputType | "options" | "notesOf" | "anyNote" | "type";

const CHOICE_LABELS: Record<Exclude<ValueChoice, InputType>, string> = {
  options: "Options (listed notes)",
  notesOf: "Notes of a type",
  anyNote: "Any note",
  type: "Types",
};

/** A field's value type as a choice, and whether it's a list; null for types the form can't edit. */
function choiceOf(type: TypeExpr): { choice: ValueChoice; many: boolean } | null {
  const many = type.kind === "array";
  const one = many ? type.of : type;
  switch (one.kind) {
    case "primitive":
      if (one.name === "note") {
        return { choice: "anyNote", many };
      }
      return { choice: one.name, many };
    case "object":
      return { choice: "options", many };
    case "group":
      return one.mode === "any" && one.of.every((t) => t.kind === "object")
        ? { choice: "options", many }
        : null;
    case "ref":
      return { choice: "notesOf", many };
    default:
      return null;
  }
}

const describe = (type: TypeExpr): string => {
  const c = choiceOf(type);
  if (!c) {
    return "custom";
  }
  const name =
    c.choice in INPUT_SPECS
      ? INPUT_SPECS[c.choice as InputType].label
      : CHOICE_LABELS[c.choice as Exclude<ValueChoice, InputType>];
  return c.many ? `list of ${name.toLowerCase()}` : name;
};

/** The option notes a type lists. */
const optionIdsOf = (type: TypeExpr): string[] => {
  const one = type.kind === "array" ? type.of : type;
  if (one.kind === "object") {
    return [one.id];
  }
  return one.kind === "group" ? one.of.flatMap((t) => (t.kind === "object" ? [t.id] : [])) : [];
};

/** Edits a declared field: name, icon, what its values are, required, and default. */
function FieldEditor({ entry, onChange }: { entry: Entry; onChange: (entry: Entry) => void }) {
  const types = useCanvasStore((s) => s.types);
  const decl = entry.decl ?? { label: "" };
  const current = choiceOf(entry.type);
  const setDecl = (patch: Partial<NonNullable<Entry["decl"]>>) =>
    onChange({ ...entry, decl: { ...decl, ...patch } });
  // Changing what values are clears the default (it's of the old kind).
  const setType = (choice: ValueChoice, many: boolean) => {
    let one: TypeExpr;
    if (choice === "options") {
      one = {
        kind: "group",
        mode: "any",
        of: optionIdsOf(entry.type).map((id) => ({ kind: "object", id })),
      };
    } else if (choice === "notesOf") {
      const keep = entry.type.kind === "array" ? entry.type.of : entry.type;
      const typeId =
        keep.kind === "ref" ? keep.typeId : (types.find((t) => !t.builtIn)?.id ?? types[0]!.id);
      one = { kind: "ref", typeId };
    } else {
      one = { kind: "primitive", name: choice === "anyNote" ? "note" : choice };
    }
    const sameKind = current?.choice === choice;
    onChange({
      ...entry,
      type: many ? { kind: "array", of: one } : one,
      decl: { ...decl, default: sameKind ? decl.default : undefined },
    });
  };
  const canBeList = current && !(current.choice in INPUT_SPECS);

  return (
    <div className="flex flex-col gap-1.5 border-t border-gray-100 bg-gray-50 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <IconPicker
          label="Choose field icon"
          onPick={(icon) => setDecl({ icon })}
          triggerClassName="flex size-7 shrink-0 items-center justify-center rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          <FieldIcon entry={entry} className="size-4" />
        </IconPicker>
        <input
          aria-label="Field name"
          // A new field's name is typed first.
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!decl.label}
          value={decl.label}
          onChange={(e) => setDecl({ label: e.target.value })}
          placeholder="e.g. Story points"
          className={textInputClass}
        />
      </div>
      {current ? (
        <div className="flex items-center gap-2">
          <div className="w-52">
            <Dropdown<ValueChoice>
              label="Values"
              value={current.choice}
              onChange={(choice) => setType(choice, current.many && !(choice in INPUT_SPECS))}
              items={[
                ...INPUT_TYPES.map((t) => ({
                  value: t as ValueChoice,
                  label: INPUT_SPECS[t].label,
                })),
                ...Object.entries(CHOICE_LABELS).map(([value, label]) => ({
                  value: value as ValueChoice,
                  label,
                })),
              ]}
            />
          </div>
          {canBeList && (
            // oxlint-disable-next-line jsx-a11y/label-has-associated-control
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={current.many}
                onChange={(e) => setType(current.choice, e.target.checked)}
              />
              List (several values)
            </label>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500">This field's values have a custom type.</p>
      )}
      {current?.choice === "notesOf" && <NotesOfPicker entry={entry} onChange={onChange} />}
      {current?.choice === "options" && (
        <OptionsEditor
          entry={entry}
          onChange={(ids) => {
            const one: TypeExpr = {
              kind: "group",
              mode: "any",
              of: ids.map((id) => ({ kind: "object", id })),
            };
            onChange({ ...entry, type: current.many ? { kind: "array", of: one } : one });
          }}
        />
      )}
      {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={!entry.optional}
          onChange={(e) =>
            onChange({
              ...entry,
              optional: !e.target.checked,
              decl: { ...decl, default: e.target.checked ? decl.default : undefined },
            })
          }
        />
        Required (a note needs a value to be of this type)
      </label>
      {!entry.optional && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="shrink-0">New notes get</span>
          <div className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1 py-0.5">
            <FieldValueEditor
              entry={entry}
              value={decl.default ?? []}
              onChange={(value) => setDecl({ default: value.length ? value : undefined })}
              inSettings
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** For "notes of a type" fields: which type. */
function NotesOfPicker({ entry, onChange }: { entry: Entry; onChange: (entry: Entry) => void }) {
  const types = useCanvasStore((s) => s.types);
  const many = entry.type.kind === "array";
  const one = many && entry.type.kind === "array" ? entry.type.of : entry.type;
  return (
    <div className="w-52">
      <Dropdown
        label="Notes of"
        value={one.kind === "ref" ? one.typeId : null}
        onChange={(typeId) => {
          const ref: TypeExpr = { kind: "ref", typeId };
          onChange({
            ...entry,
            type: many ? { kind: "array", of: ref } : ref,
            decl: { ...entry.decl!, default: undefined },
          });
        }}
        items={types
          .filter((t) => t.id !== NOTE_TYPE_ID)
          .map((t) => ({
            value: t.id,
            label: t.name,
            icon: <TypeIcon typeId={t.id} className="size-3.5" />,
          }))}
      />
    </div>
  );
}

/**
 * A field's listed options: the option notes in picker order, plus adding an existing note or a
 * new one.
 */
function OptionsEditor({ entry, onChange }: { entry: Entry; onChange: (ids: string[]) => void }) {
  const createOptionNote = useCanvasStore((s) => s.createOptionNote);
  const ids = optionIdsOf(entry.type);
  const move = (from: number, to: number) => {
    const next = [...ids];
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id!);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1">
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <NotePill noteId={id} />
          </div>
          <button
            type="button"
            aria-label="Move up"
            disabled={i === 0}
            onClick={() => move(i, i - 1)}
            className={iconButtonClass}
          >
            <ArrowUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={i === ids.length - 1}
            onClick={() => move(i, i + 1)}
            className={iconButtonClass}
          >
            <ArrowDownIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Remove from options"
            title="Remove from options (keeps the note)"
            onClick={() => onChange(ids.filter((o) => o !== id))}
            className={iconButtonClass}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <AddOptionInput
        exclude={ids}
        onPick={(id) => onChange([...ids, id])}
        // The store adds it to the saved field's options too (if the field is saved).
        onCreate={(title) => onChange([...ids, createOptionNote(entry.key, title)])}
      />
    </div>
  );
}

/**
 * Adds an option the way the canvas picker does: type to match existing notes (that aren't
 * options yet), or to create a new note when no note has that exact title.
 */
function AddOptionInput({
  exclude,
  onPick,
  onCreate,
}: {
  exclude: string[];
  onPick: (noteId: string) => void;
  onCreate: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const nodes = useCanvasStore((s) => s.nodes);
  const rows = searchNotes(nodes, query, { exclude });
  const choose = (row: NoteRow) => {
    if (row.kind === "note") {
      onPick(row.note.id);
    } else {
      onCreate(row.title);
    }
    setQuery("");
  };
  const nav = useListNavigation(rows, choose);

  return (
    <div className="relative mt-1">
      <input
        aria-label="Add an option: find a note or create one"
        placeholder="Add an option…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          nav.reset();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            // Clear the search instead of closing the settings dialog.
            e.preventDefault();
            e.stopPropagation();
            setQuery("");
          } else {
            nav.onKeyDown(e);
          }
        }}
        className={`${textInputClass} h-7 bg-white`}
      />
      {rows.length > 0 && (
        <ResultList
          items={rows}
          getKey={rowKey}
          active={nav.active}
          setActive={nav.setActive}
          className="absolute top-full right-0 left-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg"
          renderItem={(row) => (
            <button
              type="button"
              // Keep focus in the input so typing can continue after a pick.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(row)}
              className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-xs text-gray-600"
            >
              {row.kind === "note" ? (
                <NotePill noteId={row.note.id} />
              ) : (
                <CreateRow title={row.title} />
              )}
            </button>
          )}
        />
      )}
    </div>
  );
}
