import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { isFieldInUse, newId, useCanvasStore } from "../../store/canvas.ts";
import {
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  isSelectType,
  OPTION_COLOR_CLASSES,
  OPTION_COLORS,
  validateField,
  type OptionColor,
  type FieldDef,
  type FieldType,
} from "../model.ts";
import { FieldValueEditor } from "./FieldValueEditor.tsx";
import {
  dangerButtonClass,
  EditorPane,
  FormRow,
  ListPane,
  primaryButtonClass,
  selectClass,
  textInputClass,
} from "./settingsLayout.tsx";

const blankField = (): FieldDef => ({
  id: newId(),
  name: "",
  type: "text",
  multiple: false,
  required: false,
  defaultValue: [],
  referenceSchemaId: null,
  options: [],
});

/** Changing between these keeps values meaningful (option IDs either way). */
const compatibleTypes = (a: FieldType, b: FieldType) =>
  a === b || (isSelectType(a) && isSelectType(b));

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
          // "Multi-select" already says it holds several values.
          detail: `${FIELD_TYPE_LABELS[f.type]}${f.multiple && !isSelectType(f.type) ? " · multiple" : ""}`,
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

  const handleDelete = () => {
    const notesWithValues = nodes.filter((n) => (n.data.fields[draft.id]?.length ?? 0) > 0).length;
    const message =
      `Delete the field “${draft.name}”? It will be removed from ${usedBy.length} schema(s)` +
      (notesWithValues ? ` and its values deleted from ${notesWithValues} note(s).` : ".");
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
      <FormRow
        label="Type"
        hint={
          draft.builtIn
            ? "Built-in field; its type is fixed."
            : inUse
              ? isSelectType(initial.type)
                ? "Notes have values, so it can only switch between Select and Multi-select."
                : "Notes have values for this field, so its type can't change."
              : undefined
        }
      >
        <select
          aria-label="Field type"
          value={draft.type}
          disabled={draft.builtIn || (inUse && !isSelectType(initial.type))}
          onChange={(e) => {
            const type = e.target.value as FieldType;
            // Select types fix the cardinality; other defaults aren't meaningful for a new type.
            const multiple = isSelectType(type) ? type === "multiselect" : draft.multiple;
            update({
              type,
              multiple,
              defaultValue: compatibleTypes(draft.type, type)
                ? draft.defaultValue.slice(0, multiple ? undefined : 1)
                : [],
            });
          }}
          className={selectClass}
        >
          {FIELD_TYPES.filter((t) => !inUse || compatibleTypes(initial.type, t)).map((t) => (
            <option key={t} value={t}>
              {FIELD_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </FormRow>
      {draft.type === "reference" && (
        <FormRow label="Refers to">
          <select
            aria-label="Referenced schema"
            value={draft.referenceSchemaId ?? ""}
            onChange={(e) =>
              update({
                referenceSchemaId: e.target.value || null,
                defaultValue: [],
              })
            }
            className={selectClass}
          >
            <option value="">Any note</option>
            {schemas.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name} notes
              </option>
            ))}
          </select>
        </FormRow>
      )}
      {isSelectType(draft.type) && (
        <FormRow label="Options">
          <OptionsEditor field={draft} onChange={setDraft} />
        </FormRow>
      )}
      {!isSelectType(draft.type) && (
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
                {multiple ? "Multiple values" : "Single value"}
              </label>
            ))}
          </div>
        </FormRow>
      )}
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

/** The option list of a select field in settings: rename, recolor, delete, add. */
function OptionsEditor({
  field,
  onChange,
}: {
  field: FieldDef;
  onChange: (field: FieldDef) => void;
}) {
  const setOption = (id: string, patch: { name?: string; color?: OptionColor }) =>
    onChange({
      ...field,
      options: field.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  const removeOption = (id: string) =>
    onChange({
      ...field,
      options: field.options.filter((o) => o.id !== id),
      defaultValue: field.defaultValue.filter((v) => v !== id),
    });
  const addOption = () =>
    onChange({
      ...field,
      options: [
        ...field.options,
        {
          id: newId(),
          name: "",
          color: OPTION_COLORS[field.options.length % OPTION_COLORS.length]!,
        },
      ],
    });

  return (
    <div className="flex flex-col gap-1">
      {field.options.map((option) => (
        <div key={option.id} className="flex items-center gap-1.5">
          <select
            aria-label={`Color of ${option.name || "option"}`}
            value={option.color}
            onChange={(e) => setOption(option.id, { color: e.target.value as OptionColor })}
            className={`h-7 w-20 rounded border-0 px-1 text-xs capitalize ${OPTION_COLOR_CLASSES[option.color]}`}
          >
            {OPTION_COLORS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            aria-label="Option name"
            value={option.name}
            placeholder="Option name"
            onChange={(e) => setOption(option.id, { name: e.target.value })}
            className={`${textInputClass} h-7`}
          />
          <button
            type="button"
            aria-label={`Delete ${option.name || "option"}`}
            onClick={() => removeOption(option.id)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addOption}
        className="flex w-fit items-center gap-1 rounded px-1.5 py-1 text-sm text-gray-700 hover:bg-gray-100"
      >
        <PlusIcon className="size-3.5" />
        Add option
      </button>
    </div>
  );
}
