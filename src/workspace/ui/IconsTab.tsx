import { useState } from "react";

import { newId, useCanvasStore } from "../../store/canvas.ts";
import { IconByName } from "../icons.tsx";
import { customIconRef, validateCustomIcon, type CustomIcon } from "../model.ts";
import {
  dangerButtonClass,
  EditorPane,
  FormRow,
  ListPane,
  textInputClass,
  useAutoSave,
} from "./settingsLayout.tsx";

const blankIcon = (): CustomIcon => ({ id: newId(), name: "", url: "" });

/** Workspace custom icons: a slug and an image URL each, usable wherever icons are picked. */
export function IconsTab() {
  const icons = useCanvasStore((s) => s.customIcons);
  const [selectedId, setSelectedId] = useState<string | null>(icons[0]?.id ?? null);
  const [draft, setDraft] = useState<CustomIcon | null>(icons[0] ?? null);

  const select = (icon: CustomIcon) => {
    setSelectedId(icon.id);
    setDraft(icon);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        items={icons.map((icon) => ({
          id: icon.id,
          label: icon.name,
          icon: <IconByName name={customIconRef(icon.id)} className="size-4" />,
        }))}
        selectedId={selectedId}
        onSelect={(id) => select(icons.find((i) => i.id === id)!)}
        addLabel="New icon"
        onAdd={() => {
          setSelectedId(null);
          setDraft(blankIcon());
        }}
      />
      <EditorPane>
        {draft ? (
          <IconForm
            key={draft.id}
            initial={draft}
            isNew={!icons.some((i) => i.id === draft.id)}
            onSaved={select}
            onDeleted={() => {
              setSelectedId(null);
              setDraft(null);
            }}
          />
        ) : (
          <p className="text-sm text-gray-500">
            Custom icons are images you can use anywhere an icon is picked: a note (e.g. a person's
            avatar), a type, a field, or an Icon field's value. Create one to start.
          </p>
        )}
      </EditorPane>
    </div>
  );
}

/** How many places reference an icon: types, fields, notes and Icon field values. */
function useIconUsage(ref: string) {
  return useCanvasStore((s) => {
    const iconFields = new Set(s.fields.filter((f) => f.type === "icon").map((f) => f.id));
    return (
      s.schemas.filter((sc) => sc.icon === ref).length +
      s.fields.filter((f) => f.icon === ref).length +
      s.nodes.filter(
        (n) =>
          n.data.icon === ref ||
          Object.entries(n.data.fields).some(([id, v]) => iconFields.has(id) && v.includes(ref)),
      ).length
    );
  });
}

function IconForm({
  initial,
  isNew,
  onSaved,
  onDeleted,
}: {
  initial: CustomIcon;
  isNew: boolean;
  onSaved: (icon: CustomIcon) => void;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const icons = useCanvasStore((s) => s.customIcons);
  const saveCustomIcon = useCanvasStore((s) => s.saveCustomIcon);
  const deleteCustomIcon = useCanvasStore((s) => s.deleteCustomIcon);
  const ref = customIconRef(draft.id);
  const usage = useIconUsage(ref);

  const url = draft.url.trim();
  const errors = validateCustomIcon({ ...draft, url }, icons);
  // Changes save as soon as the icon is valid; a new icon appears in the list then. (The hook
  // watches `draft` itself: a copy made during render would look changed every time.)
  useAutoSave(draft, errors.length === 0, (d) => {
    const icon = { ...d, url: d.url.trim() };
    saveCustomIcon(icon);
    if (isNew) onSaved(icon);
  });

  const handleDelete = () => {
    const message =
      `Delete the icon “${draft.name}”?` +
      (usage ? ` It's used in ${usage} place(s), which will show no icon instead.` : "");
    if (window.confirm(message)) {
      deleteCustomIcon(draft.id);
      onDeleted();
    }
  };

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
      <FormRow label="Name" hint="A slug, used to find the icon in pickers.">
        <input
          aria-label="Icon name"
          value={draft.name}
          // Typed spaces and capitals become a slug right away.
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value.toLowerCase().replace(/\s+/g, "-") }))
          }
          placeholder="e.g. ana-silva"
          className={textInputClass}
        />
      </FormRow>
      <FormRow label="Image URL">
        <input
          aria-label="Image URL"
          value={draft.url}
          onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          placeholder="https://…"
          className={textInputClass}
        />
      </FormRow>
      {/^https?:\/\//i.test(url) && (
        <FormRow label="Preview">
          <div className="flex items-end gap-3">
            <img
              src={url}
              alt=""
              className="size-12 rounded-full border border-gray-200 object-cover"
            />
            <img src={url} alt="" className="size-4 rounded-full object-cover" />
          </div>
        </FormRow>
      )}
      {!isNew && (
        <FormRow label="Used in">
          <p className="text-sm text-gray-600">
            {usage === 0 ? "Not used yet" : `${usage} place${usage === 1 ? "" : "s"}`}
          </p>
        </FormRow>
      )}

      {errors.length > 0 && (draft.name || draft.url) && (
        <ul className="text-xs text-red-600">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {!isNew && (
        <div className="pt-1">
          <button type="button" onClick={handleDelete} className={dangerButtonClass}>
            Delete icon
          </button>
        </div>
      )}
    </form>
  );
}
