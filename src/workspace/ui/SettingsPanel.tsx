import { Tabs } from "@base-ui/react/tabs";

import { useCanvasStore, type SettingsTab } from "../../store/canvas";
import { FieldsTab } from "./FieldsTab";
import { IconsTab } from "./IconsTab";
import { SchemasTab } from "./SchemasTab";
import { WorkspaceTab } from "./WorkspaceTab";

const tabClass =
  "h-9 border-b-2 border-transparent px-3 text-sm text-gray-600 hover:text-gray-900 data-active:border-gray-900 data-active:text-gray-900";

/** Contents of the settings dialog; loaded on first open (see SettingsDialog). */
export default function SettingsPanel() {
  // In the store, so that e.g. a new workspace can open settings on its Workspace tab.
  const tab = useCanvasStore((s) => s.settingsTab);
  const setTab = useCanvasStore((s) => s.setSettingsTab);
  return (
    <Tabs.Root
      value={tab}
      onValueChange={(value: SettingsTab) => setTab(value)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Tabs.List className="flex gap-1 border-b border-gray-200 px-2">
        <Tabs.Tab value="fields" className={tabClass}>
          Fields
        </Tabs.Tab>
        <Tabs.Tab value="schemas" className={tabClass}>
          Schemas
        </Tabs.Tab>
        <Tabs.Tab value="icons" className={tabClass}>
          Icons
        </Tabs.Tab>
        <Tabs.Tab value="workspace" className={tabClass}>
          Workspace
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="fields" className="flex min-h-0 flex-1">
        <FieldsTab />
      </Tabs.Panel>
      <Tabs.Panel value="schemas" className="flex min-h-0 flex-1">
        <SchemasTab />
      </Tabs.Panel>
      <Tabs.Panel value="icons" className="flex min-h-0 flex-1">
        <IconsTab />
      </Tabs.Panel>
      <Tabs.Panel value="workspace" className="min-h-0 flex-1 overflow-y-auto">
        <WorkspaceTab />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
