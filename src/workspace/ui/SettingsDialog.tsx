import { Dialog } from "@base-ui/react/dialog";
import { SettingsIcon, XIcon } from "lucide-react";
import { lazy, Suspense } from "react";

// The tabs, forms and pickers are only needed once the dialog is opened.
const SettingsPanel = lazy(() => import("./SettingsPanel.tsx"));

/** Workspace settings: custom fields and note schemas. Opened from the canvas gear button. */
export function SettingsDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Workspace settings"
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
            <SettingsPanel />
          </Suspense>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
