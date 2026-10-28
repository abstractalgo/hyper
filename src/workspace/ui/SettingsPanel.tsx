import { Tabs } from "@base-ui/react/tabs";

import { useCanvasStore } from "../../store/canvas.ts";
import { FieldsTab } from "./FieldsTab.tsx";
import { SchemasTab } from "./SchemasTab.tsx";
import { secondaryButtonClass } from "./settingsLayout.tsx";

const tabClass =
  "h-9 border-b-2 border-transparent px-3 text-sm text-gray-600 hover:text-gray-900 data-active:border-gray-900 data-active:text-gray-900";

/** Contents of the settings dialog; loaded on first open (see SettingsDialog). */
export default function SettingsPanel() {
  const loadBoard = useCanvasStore((s) => s.loadBoard);

  const resetBoard = async () => {
    if (
      window.confirm(
        "Replace the whole board, fields and schemas with the sample? This can't be undone.",
      )
    ) {
      const { createSampleBoard } = await import("../../sample/sampleNotes.ts");
      loadBoard(createSampleBoard());
    }
  };

  return (
    <>
      <Tabs.Root defaultValue="fields" className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="flex gap-1 border-b border-gray-200 px-2">
          <Tabs.Tab value="fields" className={tabClass}>
            Fields
          </Tabs.Tab>
          <Tabs.Tab value="schemas" className={tabClass}>
            Schemas
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="fields" className="flex min-h-0 flex-1">
          <FieldsTab />
        </Tabs.Panel>
        <Tabs.Panel value="schemas" className="flex min-h-0 flex-1">
          <SchemasTab />
        </Tabs.Panel>
      </Tabs.Root>
      <div className="flex justify-end border-t border-gray-200 px-4 py-2">
        <button type="button" onClick={() => void resetBoard()} className={secondaryButtonClass}>
          Reset to sample board
        </button>
      </div>
    </>
  );
}
