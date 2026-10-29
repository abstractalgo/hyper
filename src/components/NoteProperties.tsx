import { Menu } from "@base-ui/react/menu";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useCanvasStore, useNoteData, type PropertiesPosition } from "../store/canvas";
import type { FieldDef } from "../workspace/model";
import { FieldValueEditor } from "../workspace/ui/FieldValueEditor";
import {
  POPUP_CLASS,
  POSITIONER_CLASS,
  PopupContainerContext,
  useViewportPortal,
} from "../workspace/ui/popups";
import { FieldIcon } from "../workspace/icons";

const GRID = "grid grid-cols-[minmax(4rem,auto)_1fr] content-start items-center gap-x-2 gap-y-0.5";

const INLINE_VALUE_CLASS =
  "min-w-0 [&>*]:w-auto [&_input]:ml-0! [&_input]:min-w-7 [&_.truncate]:overflow-visible [&_.truncate]:whitespace-normal";

/** How the fields are laid out, per workspace setting. */
const LAYOUT_CLASSES: Record<PropertiesPosition, string> = {
  // One name/value row per field, between title bar and text.
  top: `${GRID} border-b`,
  // Name/value items side by side, wrapping onto more lines as needed.
  "top-inline": "flex flex-wrap items-center gap-x-1 gap-y-0.5 border-b",
  // A column right of the text: as wide as the names and values need, up to half the note.
  right: `${GRID} max-w-1/2 border-l`,
};

/**
 * The note's schema fields as editable names and values: above the text (in rows, or inline), or
 * in a column right of it (a workspace setting).
 */
export function NoteProperties({ noteId, selected }: { noteId: string; selected: boolean }) {
  const fields = useCanvasStore(
    useShallow((s) => {
      const note = s.nodes.find((n) => n.id === noteId);
      const schema = s.schemas.find((sc) => sc.id === note?.data.schemaId);
      return (schema?.fieldIds ?? [])
        .map((id) => s.fields.find((f) => f.id === id))
        .filter((f): f is FieldDef => f !== undefined);
    }),
  );
  const values = useNoteData(noteId, "fields");
  const setNoteField = useCanvasStore((s) => s.setNoteField);
  const viewportPortal = useViewportPortal();
  const position = useCanvasStore((s) => s.propertiesPosition);
  const inline = position === "top-inline";
  const labels = useCanvasStore((s) => (inline ? s.inlineLabels : "both"));
  // Inline, empty fields are tucked into a menu; picking one shows it here so it can be filled in.
  // Once the note is deselected, fields still empty go back into the menu.
  const [revealed, setRevealed] = useState<string[]>([]);
  const [wasSelected, setWasSelected] = useState(selected);
  if (selected !== wasSelected) {
    setWasSelected(selected);
    if (!selected) {
      setRevealed([]);
    }
  }
  const isShown = (field: FieldDef) =>
    !inline || (values?.[field.id]?.length ?? 0) > 0 || revealed.includes(field.id);

  if (fields.length === 0) {
    return null;
  }
  const emptyFields = fields.filter((f) => !isShown(f));

  return (
    <PopupContainerContext.Provider value={viewportPortal}>
      {/* nodrag: using inputs shouldn't drag the note */}
      <dl className={`nodrag shrink-0 border-gray-100 px-3 py-1.5 ${LAYOUT_CLASSES[position]}`}>
        {fields.filter(isShown).map((field) => (
          <div
            key={field.id}
            // In a grid each name and value take a cell; inline, they stay together as one item.
            className={
              position === "top-inline"
                ? "flex max-w-full shrink-0 items-center gap-1.5"
                : "contents"
            }
          >
            <dt
              className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500"
              title={field.name}
            >
              {labels !== "name" && <FieldIcon field={field} className="size-3.5" />}
              {/* Icons only: the name is still there for screen readers (and on hover). */}
              <span className={labels === "icon" ? "sr-only" : "truncate"}>{field.name}</span>
            </dt>
            {/* Inline, every value shows in full: editors take their content's width (not the
                row's), and text wraps rather than ending in "…". Inputs don't pull themselves 5px left
                (to line up across rows): there are no rows, and it'd clip their text. */}
            <dd className={inline ? INLINE_VALUE_CLASS : "min-w-0"}>
              <FieldValueEditor
                field={field}
                value={values?.[field.id] ?? []}
                onChange={(value) => setNoteField(noteId, field.id, value)}
                noteId={noteId}
              />
            </dd>
          </div>
        ))}
        {emptyFields.length > 0 && (
          <EmptyFieldsMenu
            fields={emptyFields}
            container={viewportPortal}
            onPick={(id) => setRevealed((ids) => [...ids, id])}
          />
        )}
      </dl>
    </PopupContainerContext.Provider>
  );
}

const menuItemClass =
  "flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-2 text-xs outline-none select-none data-highlighted:bg-gray-100";

/** The inline layout's "⋮" menu: the note's empty fields, any of which can be shown to fill it in. */
function EmptyFieldsMenu({
  fields,
  container,
  onPick,
}: {
  fields: FieldDef[];
  container: HTMLElement | null;
  onPick: (fieldId: string) => void;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Empty properties (${fields.length})`}
        title="Empty properties"
        // At the end of the line, and only visible while the note is hovered (or the menu is open,
        // or it has keyboard focus).
        className="ml-auto flex h-6 items-center rounded px-0.5 text-gray-400 opacity-0 group-hover/note:opacity-100 hover:bg-gray-100 hover:text-gray-700 focus-visible:opacity-100 data-popup-open:bg-gray-100 data-popup-open:opacity-100"
      >
        <EllipsisVerticalIcon className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`min-w-36 py-1 ${POPUP_CLASS}`}>
            {fields.map((field) => (
              <Menu.Item key={field.id} onClick={() => onPick(field.id)} className={menuItemClass}>
                <FieldIcon field={field} className="size-3.5" />
                {field.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
