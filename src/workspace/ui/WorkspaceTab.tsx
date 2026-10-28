import { useState } from "react";

import {
  deleteWorkspace,
  openWorkspace,
  useCanvasStore,
  type InlineLabels,
  type PropertiesPosition,
} from "../../store/canvas";
import { useWorkspaces } from "../../store/workspaces";
import { DeleteButton, FormRow, textInputClass } from "./settingsLayout";

const PROPERTIES_POSITIONS: { value: PropertiesPosition; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "top-inline", label: "Top, inline" },
  { value: "right", label: "Right" },
];

const INLINE_LABELS: { value: InlineLabels; label: string }[] = [
  { value: "name", label: "Names" },
  { value: "icon", label: "Icons" },
  { value: "both", label: "Both" },
];

/** A row of radio buttons for one setting. */
function RadioRow<V extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <div className="flex gap-4 pt-1.5 text-sm">
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-1.5">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

/** The active workspace itself: its name, how notes are laid out, and deleting it. */
export function WorkspaceTab() {
  const workspaces = useWorkspaces((s) => s.workspaces);
  const activeId = useWorkspaces((s) => s.activeId);
  const rename = useWorkspaces((s) => s.rename);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const propertiesPosition = useCanvasStore((s) => s.propertiesPosition);
  const setPropertiesPosition = useCanvasStore((s) => s.setPropertiesPosition);
  const inlineLabels = useCanvasStore((s) => s.inlineLabels);
  const setInlineLabels = useCanvasStore((s) => s.setInlineLabels);
  const active = workspaces.find((w) => w.id === activeId);
  // Saved as it's typed, unless it's blank.
  const [name, setName] = useState(active?.name ?? "");
  if (!active) return null;

  const handleDelete = async () => {
    const next = workspaces.find((w) => w.id !== active.id);
    if (!next) return;
    if (!window.confirm(`Delete the workspace “${active.name}” and all its notes?`)) return;
    setSettingsOpen(false);
    await openWorkspace(next.id);
    deleteWorkspace(active.id);
  };

  return (
    <form className="flex flex-col gap-3 p-4" onSubmit={(e) => e.preventDefault()}>
      <FormRow label="Name">
        <input
          aria-label="Workspace name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) rename(active.id, e.target.value.trim());
          }}
          placeholder="e.g. Side project"
          // Focused when settings open on this tab (as they do for a new workspace).
          // oxlint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          className={textInputClass}
        />
      </FormRow>
      <FormRow
        label="Properties"
        hint="Where notes show their fields: above the text (one per row, or inline), or beside it."
      >
        <RadioRow
          name="properties-position"
          options={PROPERTIES_POSITIONS}
          value={propertiesPosition}
          onChange={setPropertiesPosition}
        />
      </FormRow>
      {propertiesPosition === "top-inline" && (
        <FormRow label="Labels" hint="What shows next to each value; the name also shows on hover.">
          <RadioRow
            name="inline-labels"
            options={INLINE_LABELS}
            value={inlineLabels}
            onChange={setInlineLabels}
          />
        </FormRow>
      )}
      {workspaces.length > 1 && (
        <DeleteButton label="Delete workspace" onClick={() => void handleDelete()} />
      )}
    </form>
  );
}
