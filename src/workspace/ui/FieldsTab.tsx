import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { NoteSchemaMenu } from "../../components/NoteSchemaMenu.tsx";
import { isFieldInUse, newId, useCanvasStore } from "../../store/canvas.ts";
import { FieldIcon, FieldTypeIcon } from "../icons.tsx";
import {
  FIELD_TYPE_SPECS,
  FIELD_TYPES,
  validateField,
  withFieldType,
  type FieldDef,
  type FieldType,
  type NoteId,
  type SelectFieldDef,
} from "../model.ts";
import { rowKey, searchNotes, type NoteRow } from "../noteSearch.ts";
import { Dropdown } from "./Dropdown.tsx";
import { FieldValueEditor } from "./FieldValueEditor.tsx";
import { IconPicker } from "./IconPicker.tsx";
import { ResultList, useListNavigation } from "./ResultList.tsx";
import { CreateRow, NotePill } from "./SelectEditor.tsx";
import {
  DeleteButton,
  FormErrors,
  FormRow,
  SettingsCollection,
  textInputClass,
  useAutoSave,
  type ItemFormProps,
  type ListItem,
} from "./settingsLayout.tsx";

const blankField = (): FieldDef => ({
  id: newId(),
  name: "",
  type: "text",
  multiple: false,
  required: false,
  defaultValue: [],
});

const fieldListItem = (f: FieldDef): ListItem => ({
  id: f.id,
  label: f.name,
  icon: <FieldIcon field={f} className="size-4" />,
});

export function FieldsTab() {
  const fields = useCanvasStore((s) => s.fields);
  return (
    <SettingsCollection
      items={fields}
      toListItem={fieldListItem}
      actions={[{ label: "New field", create: blankField }]}
      Form={FieldForm}
      emptyText="Select a field, or create a new one."
    />
  );
}

function FieldForm({ initial, isNew, onSaved, onDeleted }: ItemFormProps<FieldDef>) {
  const [draft, setDraft] = useState(initial);
  const schemas = useCanvasStore((s) => s.schemas);
  const nodes = useCanvasStore((s) => s.nodes);
  const saveField = useCanvasStore((s) => s.saveField);
  const deleteField = useCanvasStore((s) => s.deleteField);

  const inUse = !isNew && isFieldInUse(nodes, draft.id);
  const usedBy = schemas.filter((sc) => sc.fieldIds.includes(draft.id));
  const errors = validateField(draft);
  // Name, icon, cardinality and mandatory are the same for every field type.
  const update = (patch: Partial<Pick<FieldDef, "name" | "icon" | "multiple" | "required">>) =>
    setDraft((d) => ({ ...d, ...patch }));
  // The default's type follows the field's type; trimming or clearing it keeps that.
  const updateDefault = (keep: (value: FieldDef["defaultValue"]) => typeof value) =>
    setDraft((d) => ({ ...d, defaultValue: keep(d.defaultValue) }) as FieldDef);

  const handleDelete = () => {
    const notesWithValues = nodes.filter((n) => (n.data.fields[draft.id]?.length ?? 0) > 0).length;
    const message =
      `Delete the field “${draft.name}”? It will be removed from ${usedBy.length} schema(s)` +
      (notesWithValues ? ` and its values deleted from ${notesWithValues} note(s).` : ".") +
      (draft.type === "select" && draft.optionIds.length
        ? " Its option notes stay on the canvas."
        : "");
    if (window.confirm(message)) {
      deleteField(draft.id);
      onDeleted();
    }
  };

  // Changes save as soon as the field is valid; a new field appears in the list then.
  useAutoSave(draft, errors.length === 0, (d) => {
    const field = { ...d, name: d.name.trim() };
    saveField(field);
    if (isNew) onSaved(field);
  });

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
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
        hint={inUse ? "Notes have values for this field, so its type can't change." : undefined}
      >
        <Dropdown<FieldType>
          label="Field type"
          value={draft.type}
          disabled={inUse}
          onChange={(type) => setDraft((d) => withFieldType(d, type))}
          items={FIELD_TYPES.map((t) => ({
            value: t,
            label: FIELD_TYPE_SPECS[t].label,
            icon: <FieldTypeIcon type={t} className="size-3.5" />,
          }))}
        />
      </FormRow>
      {draft.type === "select" && (
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
                onChange={() => {
                  update({ multiple });
                  if (!multiple) updateDefault((v) => v.slice(0, 1));
                }}
              />
              {draft.type === "select"
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
            onChange={(e) => {
              update({ required: e.target.checked });
              if (!e.target.checked) updateDefault((v) => v.slice(0, 0));
            }}
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
              onChange={(value) => setDraft((d) => ({ ...d, defaultValue: value }) as FieldDef)}
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

      <FormErrors errors={errors} />
      {!isNew && <DeleteButton label="Delete field" onClick={handleDelete} />}
    </form>
  );
}

const iconButtonClass = "rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30";

/**
 * A select field's options in settings: the option notes in picker order, each with the note's
 * type & color menu, plus adding an existing note or a new one.
 */
function OptionsEditor({
  field,
  onChange,
}: {
  field: SelectFieldDef;
  onChange: (field: SelectFieldDef) => void;
}) {
  const createOptionNote = useCanvasStore((s) => s.createOptionNote);

  const setOptionIds = (optionIds: NoteId[]) => onChange({ ...field, optionIds });
  const move = (from: number, to: number) => {
    const ids = [...field.optionIds];
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    setOptionIds(ids);
  };
  const add = (id: NoteId) => setOptionIds([...field.optionIds, id]);

  return (
    <div className="flex flex-col gap-1">
      {field.optionIds.map((id, i) => (
        <div key={id} className="flex items-center gap-1.5">
          <NoteSchemaMenu noteId={id} />
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
            disabled={i === field.optionIds.length - 1}
            onClick={() => move(i, i + 1)}
            className={iconButtonClass}
          >
            <ArrowDownIcon className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Remove from options"
            title="Remove from options (keeps the note)"
            onClick={() => setOptionIds(field.optionIds.filter((o) => o !== id))}
            className={iconButtonClass}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <AddOptionInput
        exclude={field.optionIds}
        onPick={add}
        onCreate={(title) =>
          add(createOptionNote(field.id, title, { siblingIds: field.optionIds }))
        }
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
  exclude: NoteId[];
  onPick: (noteId: NoteId) => void;
  onCreate: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const nodes = useCanvasStore((s) => s.nodes);
  const rows = searchNotes(nodes, query, { exclude });
  const choose = (row: NoteRow) => {
    if (row.kind === "note") onPick(row.note.id);
    else onCreate(row.title);
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
        className={`${textInputClass} h-7`}
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
