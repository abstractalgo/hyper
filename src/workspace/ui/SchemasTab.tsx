import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { newId, useCanvasStore } from "../../store/canvas";
import { FieldIcon, IconByName, SchemaIcon } from "../icons";
import { FIELD_TYPE_SPECS, SCHEMA_COLOR_CLASSES, SCHEMA_COLORS, type Schema } from "../model";
import { Dropdown } from "./Dropdown";
import { IconPicker } from "./IconPicker";
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

const blankSchema = (): Schema => ({
  id: newId(),
  name: "",
  icon: "file-text",
  color: "gray",
  fieldIds: [],
});

const schemaListItem = (sc: Schema): ListItem => ({
  id: sc.id,
  label: sc.name,
  detail: `${sc.fieldIds.length} field${sc.fieldIds.length === 1 ? "" : "s"}${sc.builtIn ? " · built-in" : ""}`,
  icon: <SchemaIcon schemaId={sc.id} className="size-4" />,
});

export function SchemasTab() {
  const schemas = useCanvasStore((s) => s.schemas);
  return (
    <SettingsCollection
      items={schemas}
      toListItem={schemaListItem}
      actions={[{ label: "New schema", create: blankSchema }]}
      Form={SchemaForm}
      emptyText="Select a schema, or create a new one."
    />
  );
}

function SchemaForm({ initial, isNew, onSaved, onDeleted }: ItemFormProps<Schema>) {
  const [draft, setDraft] = useState(initial);
  const fields = useCanvasStore((s) => s.fields);
  const noteCount = useCanvasStore(
    (s) => s.nodes.filter((n) => n.data.schemaId === initial.id).length,
  );
  const saveSchema = useCanvasStore((s) => s.saveSchema);
  const deleteSchema = useCanvasStore((s) => s.deleteSchema);
  const update = (patch: Partial<Schema>) => setDraft((d) => ({ ...d, ...patch }));

  const included = draft.fieldIds.flatMap((id) => fields.filter((f) => f.id === id));
  const available = fields.filter((f) => !draft.fieldIds.includes(f.id));
  const move = (from: number, to: number) => {
    const ids = [...draft.fieldIds];
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id!);
    update({ fieldIds: ids });
  };
  const nameError = draft.name.trim() ? null : "Name is required.";

  // Changes save as soon as the schema is valid; a new schema appears in the list then.
  useAutoSave(draft, nameError === null, (d) => {
    const schema = { ...d, name: d.name.trim() };
    saveSchema(schema);
    if (isNew) {
      onSaved(schema);
    }
  });

  // Saving is immediate, so confirm before a removal that deletes note values.
  const removeField = (field: { id: string; name: string }) => {
    if (
      noteCount > 0 &&
      !window.confirm(`Removing “${field.name}” deletes its values from ${noteCount} note(s).`)
    ) {
      return;
    }
    update({ fieldIds: draft.fieldIds.filter((id) => id !== field.id) });
  };

  const handleDelete = () => {
    const message =
      `Delete the schema “${draft.name}”?` +
      (noteCount
        ? ` Its ${noteCount} note(s) become plain notes and lose their field values.`
        : "");
    if (window.confirm(message)) {
      deleteSchema(draft.id);
      onDeleted();
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <FormRow label="Name">
        <input
          aria-label="Schema name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Task"
          className={textInputClass}
        />
      </FormRow>
      <FormRow label="Icon">
        <div className="flex items-center gap-2">
          <IconPicker
            label="Choose icon"
            onPick={(icon) => update({ icon })}
            triggerClassName="flex size-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-50"
          >
            <IconByName
              name={draft.icon}
              className={`size-4 ${SCHEMA_COLOR_CLASSES[draft.color]}`}
            />
          </IconPicker>
          <fieldset className="flex gap-1">
            <legend className="sr-only">Color</legend>
            {SCHEMA_COLORS.map((color) => (
              <label
                key={color}
                title={color}
                className="flex size-6 cursor-pointer items-center justify-center rounded-full border border-transparent has-checked:border-gray-900 has-focus-visible:outline-2 has-focus-visible:outline-blue-600"
              >
                <input
                  type="radio"
                  name="schema-color"
                  value={color}
                  aria-label={color}
                  checked={draft.color === color}
                  onChange={() => update({ color })}
                  className="sr-only"
                />
                <span
                  className={`size-3.5 rounded-full bg-current ${SCHEMA_COLOR_CLASSES[color]}`}
                />
              </label>
            ))}
          </fieldset>
        </div>
      </FormRow>
      <FormRow label="Fields" hint="Notes of this type show these fields, in this order.">
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {included.map((field, i) => {
            return (
              <li key={field.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <FieldIcon field={field} className="size-3.5" />
                <span className="min-w-0 flex-1 truncate">
                  {field.name}
                  <span className="ml-2 text-xs text-gray-500">
                    {FIELD_TYPE_SPECS[field.type].label}
                  </span>
                </span>
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
                  disabled={i === included.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ArrowDownIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${field.name}`}
                  onClick={() => removeField(field)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <XIcon className="size-3.5" />
                </button>
              </li>
            );
          })}
          {included.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-gray-500">No fields yet.</li>
          )}
        </ul>
        {available.length > 0 && (
          <Dropdown
            label="Add field"
            value={null}
            placeholder="Add a field…"
            onChange={(id) => update({ fieldIds: [...draft.fieldIds, id] })}
            items={available.map((f) => ({
              value: f.id,
              label: `${f.name} (${FIELD_TYPE_SPECS[f.type].label})`,
              icon: <FieldIcon field={f} className="size-3.5" />,
            }))}
            className="mt-2"
          />
        )}
      </FormRow>
      {!isNew && (
        <FormRow label="Notes">
          <p className="text-sm text-gray-600">{noteCount} on the canvas</p>
        </FormRow>
      )}

      <FormErrors errors={nameError ? [nameError] : []} />
      {!isNew && !draft.builtIn && <DeleteButton label="Delete schema" onClick={handleDelete} />}
    </form>
  );
}
