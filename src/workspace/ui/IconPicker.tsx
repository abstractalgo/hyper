import { Popover } from "@base-ui/react/popover";
import { useState, type ReactNode, type RefObject } from "react";

import { useCanvasStore } from "../../store/canvas.ts";
import { ICON_NAMES, IconByName } from "../icons.tsx";
import { customIconRef, type IconRef } from "../model.ts";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups.tsx";

const MAX_RESULTS = 96;

type IconPickerProps = {
  /** Called with an icon reference: a Lucide name, or `custom:<id>` for a custom icon. */
  onPick: (icon: IconRef) => void;
  label: string;
} & (
  | {
      /** Trigger contents (e.g. the current icon, or a "+" for adding). */
      children: ReactNode;
      triggerClassName?: string;
      open?: never;
      onOpenChange?: never;
      anchor?: never;
    }
  | {
      /** Without a trigger: opened from elsewhere (e.g. a menu item), next to `anchor`. */
      children?: never;
      triggerClassName?: never;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      anchor: RefObject<Element | null>;
    }
);

const cellClass = "flex size-8 items-center justify-center rounded text-gray-700 hover:bg-gray-100";

/** Searchable grid of the workspace's custom icons and Lucide icons, in a popover. */
export function IconPicker(props: IconPickerProps) {
  const { onPick, label } = props;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = props.open ?? uncontrolledOpen;
  const setOpen = props.onOpenChange ?? setUncontrolledOpen;
  const [query, setQuery] = useState("");
  const container = usePopupContainer();
  const customIcons = useCanvasStore((s) => s.customIcons);

  const q = query.trim().toLowerCase().replace(/\s+/g, "-");
  const custom = customIcons.filter((icon) => !q || icon.name.includes(q));
  const lucide = (q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES).slice(0, MAX_RESULTS);

  const pick = (icon: IconRef) => {
    onPick(icon);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {props.children !== undefined && (
        <Popover.Trigger aria-label={label} className={props.triggerClassName}>
          {props.children}
        </Popover.Trigger>
      )}
      <Popover.Portal container={container}>
        <Popover.Positioner
          sideOffset={4}
          align="start"
          anchor={props.anchor}
          className={POSITIONER_CLASS}
        >
          <Popover.Popup aria-label={label} className={`w-72 p-2 ${POPUP_CLASS}`}>
            <input
              aria-label="Search icons"
              placeholder="Search icons…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-2 h-7 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-500"
            />
            <div className="max-h-64 overflow-y-auto">
              {custom.length > 0 && (
                <>
                  <p className="px-1 pb-1 text-xs text-gray-500">Custom</p>
                  <div className="mb-2 grid grid-cols-8 gap-0.5">
                    {custom.map((icon) => (
                      <button
                        key={icon.id}
                        type="button"
                        title={icon.name}
                        aria-label={icon.name}
                        onClick={() => pick(customIconRef(icon.id))}
                        className={cellClass}
                      >
                        <IconByName name={customIconRef(icon.id)} className="size-5" />
                      </button>
                    ))}
                  </div>
                  {lucide.length > 0 && <p className="px-1 pb-1 text-xs text-gray-500">Icons</p>}
                </>
              )}
              <div className="grid grid-cols-8 gap-0.5">
                {lucide.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    aria-label={name}
                    onClick={() => pick(name)}
                    className={cellClass}
                  >
                    <IconByName name={name} className="size-4" />
                  </button>
                ))}
              </div>
              {custom.length === 0 && lucide.length === 0 && (
                <p className="px-1 py-2 text-xs text-gray-500">No icons found.</p>
              )}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
