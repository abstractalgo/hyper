import { Menu } from "@base-ui/react/menu";
import { CheckIcon } from "lucide-react";

import { useCanvasStore } from "../store/canvas.ts";
import { SchemaIcon } from "../workspace/icons.tsx";
import { OPTION_COLOR_CLASSES, OPTION_COLORS, type OptionColor } from "../workspace/model.ts";
import { POPUP_CLASS, POSITIONER_CLASS, useViewportPortal } from "../workspace/ui/popups.tsx";

type NoteSchemaMenuProps = {
  schemaId: string | null;
  color: OptionColor | null;
  onSchemaChange: (schemaId: string | null) => void;
  onColorChange: (color: OptionColor | null) => void;
};

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
 * The note's type icon in its title bar. Opens a menu to change the note's type (schema) and
 * its color; both apply immediately and the menu stays open.
 */
export function NoteSchemaMenu({
  schemaId,
  color,
  onSchemaChange,
  onColorChange,
}: NoteSchemaMenuProps) {
  const schemas = useCanvasStore((s) => s.schemas);
  const current = schemas.find((s) => s.id === schemaId);
  const viewportPortal = useViewportPortal();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${current?.name ?? "Note"}, change type or color`}
        className="nodrag flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-blue-600 data-popup-open:bg-black/10"
      >
        <SchemaIcon schemaId={schemaId} className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal container={viewportPortal}>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`max-h-[70vh] min-w-40 overflow-y-auto py-1 ${POPUP_CLASS}`}>
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
              <Menu.GroupLabel className={groupLabelClass}>Color</Menu.GroupLabel>
              <Menu.RadioGroup
                value={color ?? NONE}
                onValueChange={(value: string) =>
                  onColorChange(value === NONE ? null : (value as OptionColor))
                }
              >
                <Menu.RadioItem value={NONE} className={itemClass}>
                  <Checked />
                  <span className="size-3.5 rounded border border-gray-300 bg-white" />
                  Default
                </Menu.RadioItem>
                {OPTION_COLORS.map((c) => (
                  <Menu.RadioItem key={c} value={c} className={`${itemClass} capitalize`}>
                    <Checked />
                    <span className={`size-3.5 rounded ${OPTION_COLOR_CLASSES[c]}`} />
                    {c}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
