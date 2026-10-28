import { useState } from "react";

import { deleteWorkspace, openWorkspace, useCanvasStore } from "../../store/canvas";
import { useWorkspaces } from "../../store/workspaces";
import { DeleteButton, FormRow, textInputClass } from "./settingsLayout";

/** The active workspace itself: its name, and deleting it. */
export function WorkspaceTab() {
  const workspaces = useWorkspaces((s) => s.workspaces);
  const activeId = useWorkspaces((s) => s.activeId);
  const rename = useWorkspaces((s) => s.rename);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
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
      {workspaces.length > 1 && (
        <DeleteButton label="Delete workspace" onClick={() => void handleDelete()} />
      )}
    </form>
  );
}
