import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ImageIcon, RotateCcwIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useCanvasStore, useNoteData } from "../store/canvas";
import { IconByName, SchemaIcon } from "../workspace/icons";
import { NOTE_COLOR_CLASSES, NOTE_COLORS, type NoteColor } from "../workspace/model";
import { IconPicker } from "../workspace/ui/IconPicker";
import {
  POPUP_CLASS,
  POSITIONER_CLASS,
  PopupContainerContext,
  usePopupContainer,
  useViewportPortal,
} from "../workspace/ui/popups";

type NoteSchemaMenuProps = { noteId: string };

const itemClass =
  "flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-2 outline-none select-none data-highlighted:bg-gray-100";
const groupLabelClass = "px-3 pt-1.5 pb-1 text-xs text-gray-500";

/** Radio groups use "" for "none", since Base UI treats an undefined value as uncontrolled. */
const NONE = "";

function Checked() {
  return (
    <span className="flex size-3.5 items-center justify-center">
      <Menu.RadioItemIndicator>
        <CheckIcon className="size-3.5" />
      </Menu.RadioItemIndicator>
    </span>
  );
}

/**
 * A note's icon button (in its title bar, and next to option notes in settings). Opens a menu to
 * change the note's type (schema), its own icon and its color; type and color apply immediately
 * and the menu stays open.
 */
export function NoteSchemaMenu({ noteId }: NoteSchemaMenuProps) {
  const schemaId = useNoteData(noteId, "schemaId") ?? null;
  const color = useNoteData(noteId, "color") ?? null;
  const icon = useNoteData(noteId, "icon") ?? null;
  const setNoteSchema = useCanvasStore((s) => s.setNoteSchema);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const onSchemaChange = (id: string | null) => setNoteSchema(noteId, id);
  const onColorChange = (c: NoteColor | null) => updateNodeData(noteId, { color: c });
  const onIconChange = (i: string | null) => updateNodeData(noteId, { icon: i });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pickingIcon, setPickingIcon] = useState(false);
  const schemas = useCanvasStore((s) => s.schemas);
  const current = schemas.find((s) => s.id === schemaId);
  // On the canvas the menu renders in React Flow's viewport (so it zooms with the note); inside
  // settings, the surrounding PopupContainerContext points it at the page body instead.
  const viewportPortal = useViewportPortal();
  const container = usePopupContainer() ?? viewportPortal;

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          ref={triggerRef}
          aria-label={`${current?.name ?? "Note"}, change type, icon or color`}
          className="nodrag flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-blue-600 data-popup-open:bg-black/10"
        >
          {icon ? (
            <IconByName name={icon} className="size-3.5" />
          ) : (
            <SchemaIcon schemaId={schemaId} className="size-3.5" />
          )}
        </Menu.Trigger>
        <Menu.Portal container={container}>
          <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
            <Menu.Popup
              className={`max-h-[var(--available-height)] min-w-40 overflow-y-auto py-1 ${POPUP_CLASS}`}
            >
              <Menu.Group>
                <Menu.GroupLabel className={groupLabelClass}>Type</Menu.GroupLabel>
                <Menu.RadioGroup
                  value={schemaId ?? NONE}
                  onValueChange={(value: string) => onSchemaChange(value === NONE ? null : value)}
                >
                  <Menu.RadioItem value={NONE} className={itemClass}>
                    <Checked />
                    <SchemaIcon schemaId={null} className="size-3.5" />
                    Note
                  </Menu.RadioItem>
                  {schemas.map((schema) => (
                    <Menu.RadioItem key={schema.id} value={schema.id} className={itemClass}>
                      <Checked />
                      <SchemaIcon schemaId={schema.id} className="size-3.5" />
                      {schema.name}
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
              <Menu.Separator className="my-1 h-px bg-gray-200" />
              <Menu.Group>
                <Menu.GroupLabel className={groupLabelClass}>Icon</Menu.GroupLabel>
                {/* Closes the menu and opens the icon picker next to the same button. */}
                <Menu.Item onClick={() => setPickingIcon(true)} className={`${itemClass} pl-7.5`}>
                  {icon ? (
                    <IconByName name={icon} className="size-3.5" />
                  ) : (
                    <ImageIcon className="size-3.5 text-gray-500" />
                  )}
                  Choose icon…
                </Menu.Item>
                {icon && (
                  <Menu.Item onClick={() => onIconChange(null)} className={`${itemClass} pl-7.5`}>
                    <RotateCcwIcon className="size-3.5 text-gray-500" />
                    Use the type's icon
                  </Menu.Item>
                )}
              </Menu.Group>
              <Menu.Separator className="my-1 h-px bg-gray-200" />
              <Menu.Group>
                <Menu.GroupLabel className={groupLabelClass}>Color</Menu.GroupLabel>
                <Menu.RadioGroup
                  value={color ?? NONE}
                  onValueChange={(value: string) =>
                    onColorChange(value === NONE ? null : (value as NoteColor))
                  }
                >
                  <Menu.RadioItem value={NONE} className={itemClass}>
                    <Checked />
                    <span className="size-3.5 rounded border border-gray-300 bg-white" />
                    Default
                  </Menu.RadioItem>
                  {NOTE_COLORS.map((c) => (
                    <Menu.RadioItem key={c} value={c} className={`${itemClass} capitalize`}>
                      <Checked />
                      <span className={`size-3.5 rounded ${NOTE_COLOR_CLASSES[c]}`} />
                      {c}
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
              </Menu.Group>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <PopupContainerContext.Provider value={container}>
        <IconPicker
          label="Note icon"
          open={pickingIcon}
          onOpenChange={setPickingIcon}
          anchor={triggerRef}
          onPick={onIconChange}
        />
      </PopupContainerContext.Provider>
    </>
  );
}
