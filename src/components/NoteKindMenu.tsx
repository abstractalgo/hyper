import { Menu } from "@base-ui/react/menu";
import { useStore } from "@xyflow/react";

import { NOTE_KIND_ORDER, NOTE_KINDS, NoteKindIcon } from "../notes/kinds.tsx";
import type { NoteKind } from "../store/canvas.ts";

type NoteKindMenuProps = {
  kind: NoteKind;
  onChange: (kind: NoteKind) => void;
};

/** The note's kind icon in its title bar; click to change the kind. */
export function NoteKindMenu({ kind, onChange }: NoteKindMenuProps) {
  // Render inside React Flow's viewport so the menu pans and zooms with the canvas.
  const viewportPortal = useStore((s) =>
    s.domNode?.querySelector<HTMLElement>(".react-flow__viewport-portal"),
  );

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`${NOTE_KINDS[kind].label} — change type`}
        className="nodrag flex size-5 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-blue-600 data-popup-open:bg-gray-200"
      >
        <NoteKindIcon kind={kind} className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal container={viewportPortal}>
        {/* The viewport disables pointer events; z-index lifts it above selected notes (1000). */}
        <Menu.Positioner
          sideOffset={4}
          align="start"
          className="nopan nowheel nodrag pointer-events-auto z-[2000]"
        >
          <Menu.Popup className="min-w-32 rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg outline-none">
            {NOTE_KIND_ORDER.map((k) => (
              <Menu.Item
                key={k}
                onClick={() => onChange(k)}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-800 outline-none select-none data-highlighted:bg-gray-100"
              >
                <NoteKindIcon kind={k} className="size-3.5" />
                {NOTE_KINDS[k].label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
