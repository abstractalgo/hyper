import { Dialog } from "@base-ui/react/dialog";
import { SettingsIcon, XIcon } from "lucide-react";
import { lazy, Suspense, useEffect } from "react";

import { useCanvasStore } from "../../store/canvas";
import { PopupContainerContext } from "./popups";

// The tabs, forms and pickers are only needed once the dialog is opened.
const SettingsPanel = lazy(() => import("./SettingsPanel"));

/** Workspace settings: custom fields and note schemas. Opened from the canvas gear button. */
const SHORTCUT_LABEL = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘," : "Ctrl+,";

export function SettingsDialog() {
  // In the store so the command palette can open it too.
  const open = useCanvasStore((s) => s.settingsOpen);
  const setOpen = useCanvasStore((s) => s.setSettingsOpen);

  // Cmd+, (Ctrl+, elsewhere), the usual "Settings" shortcut, toggles the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "," && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Workspace settings"
        title={`Workspace settings (${SHORTCUT_LABEL})`}
        className="flex size-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900"
      >
        <SettingsIcon className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex h-[min(600px,calc(100vh-2rem))] w-[min(820px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white shadow-xl outline-none">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              Workspace settings
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close"
              className="rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <XIcon className="size-4" />
            </Dialog.Close>
          </div>
          <Suspense fallback={<p className="p-4 text-sm text-gray-500">Loading…</p>}>
            {/* Popups in settings (e.g. a note's type & color menu) open over the dialog. */}
            <PopupContainerContext.Provider value={document.body}>
              <SettingsPanel />
            </PopupContainerContext.Provider>
          </Suspense>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
