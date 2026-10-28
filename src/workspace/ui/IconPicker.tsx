import { Popover } from "@base-ui/react/popover";
import { useMemo, useState, type ReactNode } from "react";

import { ICON_NAMES, LucideByName } from "../icons.tsx";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups.tsx";

const MAX_RESULTS = 96;

type IconPickerProps = {
  onPick: (name: string) => void;
  /** Trigger contents (e.g. the current icon, or a "+" for adding). */
  children: ReactNode;
  label: string;
  triggerClassName?: string;
};

/** Searchable grid of Lucide icons in a popover. */
export function IconPicker({ onPick, children, label, triggerClassName = "" }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const container = usePopupContainer();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, "-");
    return (q ? ICON_NAMES.filter((n) => n.includes(q)) : ICON_NAMES).slice(0, MAX_RESULTS);
  }, [query]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={label} className={triggerClassName}>
        {children}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Popover.Popup className={`w-72 p-2 ${POPUP_CLASS}`}>
            <input
              aria-label="Search icons"
              placeholder="Search icons…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mb-2 h-7 w-full rounded border border-gray-300 px-2 text-xs outline-none focus:border-blue-500"
            />
            <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto">
              {results.map((name) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  onClick={() => {
                    onPick(name);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex size-8 items-center justify-center rounded text-gray-700 hover:bg-gray-100"
                >
                  <LucideByName name={name} className="size-4" />
                </button>
              ))}
            </div>
            {results.length === 0 && (
              <p className="px-1 py-2 text-xs text-gray-500">No icons found.</p>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
