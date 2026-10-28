import { useState } from "react";

import { newId, useCanvasStore } from "../../store/canvas.ts";
import { IconByName } from "../icons.tsx";
import { customIconRef, validateCustomIcon, type CustomIcon } from "../model.ts";
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

const blankIcon = (): CustomIcon => ({ id: newId(), name: "", url: "" });

/** Workspace custom icons: a slug and an image URL each, usable wherever icons are picked. */
const iconListItem = (icon: CustomIcon): ListItem => ({
  id: icon.id,
  label: icon.name,
  icon: <IconByName name={customIconRef(icon.id)} className="size-4" />,
});

export function IconsTab() {
  const icons = useCanvasStore((s) => s.customIcons);
  return (
    <SettingsCollection
      items={icons}
      toListItem={iconListItem}
      actions={[{ label: "New icon", create: blankIcon }]}
      Form={IconForm}
      emptyText="Custom icons are images you can use anywhere an icon is picked: a note (e.g. a person's avatar), a type, a field, or an Icon field's value. Create one to start."
    />
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

function IconForm({ initial, isNew, onSaved, onDeleted }: ItemFormProps<CustomIcon>) {
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

      {/* A blank new icon isn't an error yet. */}
      <FormErrors errors={draft.name || draft.url ? errors : []} />
      {!isNew && <DeleteButton label="Delete icon" onClick={handleDelete} />}
    </form>
  );
}
