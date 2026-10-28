import { go as fuzzySearch } from "fuzzysort";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

import { isFieldInUse, newId, useCanvasStore } from "../../store/canvas.ts";
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  validateField,
  type FieldDef,
  type FieldType,
} from "../model.ts";
import { FieldIcon, FieldTypeIcon } from "../icons.tsx";
import { Dropdown } from "./Dropdown.tsx";
import { IconPicker } from "./IconPicker.tsx";
import { FieldValueEditor } from "./FieldValueEditor.tsx";
import { NoteSchemaMenu } from "../../components/NoteSchemaMenu.tsx";
import { NotePill } from "./SelectEditor.tsx";
import {
  dangerButtonClass,
  EditorPane,
  FormRow,
  ListPane,
  primaryButtonClass,
  textInputClass,
} from "./settingsLayout.tsx";

const blankField = (): FieldDef => ({
  id: newId(),
  name: "",
  type: "text",
  multiple: false,
  required: false,
  defaultValue: [],
  optionIds: [],
});

export function FieldsTab() {
  const fields = useCanvasStore((s) => s.fields);
  const [selectedId, setSelectedId] = useState<string | null>(fields[0]?.id ?? null);
  const [draft, setDraft] = useState<FieldDef | null>(fields[0] ?? null);

  const select = (field: FieldDef) => {
    setSelectedId(field.id);
    setDraft(field);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        items={fields.map((f) => ({
          id: f.id,
          label: f.name,
          icon: <FieldIcon field={f} className="size-4" />,
        }))}
        selectedId={selectedId}
        onSelect={(id) => select(fields.find((f) => f.id === id)!)}
        addLabel="New field"
        onAdd={() => {
          setSelectedId(null);
          setDraft(blankField());
        }}
      />
      <EditorPane>
        {draft ? (
          <FieldForm
            key={draft.id}
            initial={draft}
            isNew={!fields.some((f) => f.id === draft.id)}
            onSaved={select}
            onDeleted={() => {
              setSelectedId(null);
              setDraft(null);
            }}
          />
        ) : (
          <p className="text-sm text-gray-500">Select a field, or create a new one.</p>
        )}
      </EditorPane>
    </div>
  );
}

function FieldForm({
  initial,
  isNew,
  onSaved,
  onDeleted,
}: {
  initial: FieldDef;
  isNew: boolean;
  onSaved: (field: FieldDef) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const schemas = useCanvasStore((s) => s.schemas);
  const nodes = useCanvasStore((s) => s.nodes);
  const saveField = useCanvasStore((s) => s.saveField);
  const deleteField = useCanvasStore((s) => s.deleteField);

  const inUse = !isNew && isFieldInUse(nodes, draft.id);
  const usedBy = schemas.filter((sc) => sc.fieldIds.includes(draft.id));
  const errors = validateField(draft);
  const update = (patch: Partial<FieldDef>) => setDraft((d) => ({ ...d, ...patch }));
  const isSelect = draft.type === "select";

  const handleDelete = () => {
    const notesWithValues = nodes.filter((n) => (n.data.fields[draft.id]?.length ?? 0) > 0).length;
    const message =
      `Delete the field “${draft.name}”? It will be removed from ${usedBy.length} schema(s)` +
      (notesWithValues ? ` and its values deleted from ${notesWithValues} note(s).` : ".") +
      (draft.optionIds.length ? " Its option notes stay on the canvas." : "");
    if (window.confirm(message)) {
      deleteField(draft.id);
      onDeleted();
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (errors.length > 0) return;
        const field = { ...draft, name: draft.name.trim() };
        saveField(field);
        onSaved(field);
      }}
    >
      <FormRow label="Name">
        <input
          aria-label="Field name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Story points"
          className={textInputClass}
        />
      </FormRow>
      <FormRow label="Icon" hint={draft.icon ? undefined : "Using the type's icon."}>
        <div className="flex items-center gap-2">
          <IconPicker
            label="Choose icon"
            onPick={(icon) => update({ icon })}
            triggerClassName="flex size-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-50"
          >
            <FieldIcon field={draft} className="size-4" />
          </IconPicker>
          {draft.icon && (
            <button
              type="button"
              onClick={() => update({ icon: undefined })}
              className="rounded px-1.5 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              Use the type's icon
            </button>
          )}
        </div>
      </FormRow>
      <FormRow
        label="Type"
        hint={
          draft.builtIn
            ? "Built-in field; its type is fixed."
            : inUse
              ? "Notes have values for this field, so its type can't change."
              : undefined
        }
      >
        <Dropdown
          label="Field type"
          value={draft.type}
          disabled={draft.builtIn || inUse}
          // The old default isn't meaningful for a new type.
          onChange={(value) => update({ type: value as FieldType, defaultValue: [] })}
          items={FIELD_TYPES.map((t) => ({
            value: t,
            label: FIELD_TYPE_LABELS[t],
            icon: <FieldTypeIcon type={t} className="size-3.5" />,
          }))}
        />
      </FormRow>
      {isSelect && (
        <FormRow
          label="Options"
          hint="Options are notes. A note's picker can also find any other note, or create one."
        >
          <OptionsEditor field={draft} onChange={setDraft} />
        </FormRow>
      )}
      <FormRow label="Values">
        <div className="flex gap-4 text-sm">
          {[false, true].map((multiple) => (
            <label key={String(multiple)} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="multiple"
                checked={draft.multiple === multiple}
                onChange={() =>
                  update({
                    multiple,
                    defaultValue: multiple ? draft.defaultValue : draft.defaultValue.slice(0, 1),
                  })
                }
              />
              {isSelect
                ? multiple
                  ? "Multi-select"
                  : "Single-select"
                : multiple
                  ? "Multiple values"
                  : "Single value"}
            </label>
          ))}
        </div>
      </FormRow>
      <FormRow label="Mandatory">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={draft.required}
            onChange={(e) =>
              update({
                required: e.target.checked,
                defaultValue: e.target.checked ? draft.defaultValue : [],
              })
            }
          />
          Every note must have a value
        </label>
      </FormRow>
      {draft.required && (
        <FormRow
          label={draft.multiple ? "Default values" : "Default value"}
          hint="Given to new notes."
        >
          <div className="rounded border border-gray-300 px-1 py-0.5">
            <FieldValueEditor
              field={draft}
              value={draft.defaultValue}
              onChange={(defaultValue) => update({ defaultValue })}
              onFieldChange={setDraft}
              allowEmpty
            />
          </div>
        </FormRow>
      )}
      {!isNew && (
        <FormRow label="Used by">
          <p className="text-sm text-gray-600">
            {usedBy.length > 0 ? usedBy.map((sc) => sc.name).join(", ") : "No schemas yet"}
          </p>
        </FormRow>
      )}

      {errors.length > 0 && (
        <ul className="text-xs text-red-600">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={errors.length > 0} className={primaryButtonClass}>
          {isNew ? "Create field" : "Save field"}
        </button>
        {!isNew && !draft.builtIn && (
          <button type="button" onClick={handleDelete} className={dangerButtonClass}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * A select field's options in settings: the option notes in picker order, each with its color
 * (that's the note's own color, changed right away), plus adding an existing note or a new one.
 */
function OptionsEditor({
  field,
  onChange,
}: {
  field: FieldDef;
  onChange: (field: FieldDef) => void;
}) {
  const createOptionNote = useCanvasStore((s) => s.createOptionNote);

  const setOptionIds = (optionIds: string[]) => onChange({ ...field, optionIds });
  const move = (from: number, to: number) => {
    const ids = [...field.optionIds];
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    setOptionIds(ids);
  };
  const add = (id: string) => setOptionIds([...field.optionIds, id]);
  const create = (title: string) =>
    add(createOptionNote(field.id, title, { siblingIds: field.optionIds }));

  return (
    <div className="flex flex-col gap-1">
      {field.optionIds.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5">
          <OptionNoteMenu noteId={id} />
          <div className="min-w-0 flex-1">
            <NotePill noteId={id} />
          </div>
          <button
            type="button"
            aria-label="Move up"
            disabled={i === 0}
            onClick={() => move(i, i - 1)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ArrowUpIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Move down"
            disabled={i === field.optionIds.length - 1}
            onClick={() => move(i, i + 1)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ArrowDownIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Remove from options"
            title="Remove from options (keeps the note)"
            onClick={() => setOptionIds(field.optionIds.filter((o) => o !== id))}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <AddOptionInput exclude={field.optionIds} onPick={add} onCreate={create} />
    </div>
  );
}

const MAX_MATCHES = 8;

type AddRow = { kind: "note"; id: string } | { kind: "create"; title: string };

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
  const [active, setActive] = useState(0);
  const nodes = useCanvasStore((s) => s.nodes);
  const trimmed = query.trim();

  const rows = useMemo((): AddRow[] => {
    if (!trimmed) return [];
    const matches = fuzzySearch(
      trimmed,
      nodes.filter((n) => !exclude.includes(n.id)),
      { key: (n) => n.data.title, threshold: 0, limit: MAX_MATCHES },
    ).map((r): AddRow => ({ kind: "note", id: r.obj.id }));
    const exists = nodes.some((n) => n.data.title.toLowerCase() === trimmed.toLowerCase());
    return exists ? matches : [...matches, { kind: "create", title: trimmed }];
  }, [nodes, exclude, trimmed]);

  const choose = (row: AddRow) => {
    if (row.kind === "note") onPick(row.id);
    else onCreate(row.title);
    setQuery("");
    setActive(0);
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (rows.length === 0 ? 0 : (i + step + rows.length) % rows.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    } else if (e.key === "Escape" && query) {
      // Clear the search instead of closing the settings dialog.
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
    }
  };

  return (
    <div className="relative mt-1">
      <input
        aria-label="Add an option: find a note or create one"
        placeholder="Add an option…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={handleKeyDown}
        className={`${textInputClass} h-7`}
      />
      {rows.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-lg">
          {rows.map((row, i) => (
            <li key={row.kind === "note" ? row.id : "create"}>
              <button
                type="button"
                aria-current={active === i}
                onMouseEnter={() => setActive(i)}
                // Keep focus in the input so typing can continue after a pick.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(row)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs text-gray-600 aria-current:bg-gray-100"
              >
                {row.kind === "note" ? (
                  <NotePill noteId={row.id} />
                ) : (
                  <>
                    Create
                    <span className="truncate rounded bg-gray-100 px-1.5 leading-5 text-gray-800">
                      {row.title}
                    </span>
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The option note's type & color menu, the same one as in the note's title bar on the canvas. */
function OptionNoteMenu({ noteId }: { noteId: string }) {
  const schemaId = useCanvasStore(
    (s) => s.nodes.find((n) => n.id === noteId)?.data.schemaId ?? null,
  );
  const color = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.color ?? null);
  const setNoteSchema = useCanvasStore((s) => s.setNoteSchema);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  return (
    <NoteSchemaMenu
      schemaId={schemaId}
      color={color}
      onSchemaChange={(id) => setNoteSchema(noteId, id)}
      onColorChange={(c) => updateNodeData(noteId, { color: c })}
    />
  );
}
