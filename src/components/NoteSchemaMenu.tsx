import { Menu } from "@base-ui/react/menu";

import { useCanvasStore } from "../store/canvas.ts";
import { SchemaIcon } from "../workspace/icons.tsx";
import { POPUP_CLASS, POSITIONER_CLASS, useViewportPortal } from "../workspace/ui/popups.tsx";

type NoteSchemaMenuProps = {
  schemaId: string | null;
  onChange: (schemaId: string | null) => void;
};

const itemClass =
  "flex cursor-pointer items-center gap-2 px-3 py-1.5 outline-none select-none data-highlighted:bg-gray-100";

/** The note's type icon in its title bar; click to change the note's schema. */
export function NoteSchemaMenu({ schemaId, onChange }: NoteSchemaMenuProps) {
  const schemas = useCanvasStore((s) => s.schemas);
  const current = schemas.find((s) => s.id === schemaId);
  const viewportPortal = useViewportPortal();

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${current?.name ?? "Note"}, change type`}
        className="nodrag flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 data-popup-open:bg-gray-200"
      >
        <SchemaIcon schemaId={schemaId} className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal container={viewportPortal}>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`min-w-36 py-1 ${POPUP_CLASS}`}>
            <Menu.Item onClick={() => onChange(null)} className={itemClass}>
              <SchemaIcon schemaId={null} className="size-3.5" />
              Note
            </Menu.Item>
            {schemas.map((schema) => (
              <Menu.Item key={schema.id} onClick={() => onChange(schema.id)} className={itemClass}>
                <SchemaIcon schemaId={schema.id} className="size-3.5" />
                {schema.name}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
