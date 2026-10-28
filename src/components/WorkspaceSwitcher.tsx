import { Menu } from "@base-ui/react/menu";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { openWorkspace, useCanvasStore } from "../store/canvas";
import { useWorkspaces } from "../store/workspaces";
import { POPUP_CLASS, POSITIONER_CLASS } from "../workspace/ui/popups";

const itemClass =
  "flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-2 outline-none select-none data-highlighted:bg-gray-100";

/**
 * The active workspace's name, opening a menu to switch to another workspace or create one.
 * Renaming and deleting are in the workspace's settings.
 */
export function WorkspaceSwitcher() {
  const workspaces = useWorkspaces((s) => s.workspaces);
  const activeId = useWorkspaces((s) => s.activeId);
  const create = useWorkspaces((s) => s.create);
  const setSettingsTab = useCanvasStore((s) => s.setSettingsTab);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const active = workspaces.find((w) => w.id === activeId);

  // Opens the new workspace, with its settings open to name it.
  const createWorkspace = async () => {
    await openWorkspace(create("Untitled workspace"));
    setSettingsTab("workspace");
    setSettingsOpen(true);
  };

  return (
    <Menu.Root>
      <Menu.Trigger className="flex h-8 max-w-64 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 data-popup-open:bg-gray-50">
        <span className="truncate">{active?.name}</span>
        <ChevronsUpDownIcon className="size-3.5 shrink-0 text-gray-400" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`min-w-56 py-1 ${POPUP_CLASS}`}>
            <Menu.Group>
              <Menu.GroupLabel className="px-3 pt-1.5 pb-1 text-xs text-gray-500">
                Workspaces
              </Menu.GroupLabel>
              <Menu.RadioGroup
                value={activeId}
                onValueChange={(id: string) => void openWorkspace(id)}
              >
                {workspaces.map((w) => (
                  <Menu.RadioItem key={w.id} value={w.id} className={itemClass}>
                    <span className="flex size-3.5 items-center justify-center">
                      <Menu.RadioItemIndicator>
                        <CheckIcon className="size-3.5" />
                      </Menu.RadioItemIndicator>
                    </span>
                    <span className="truncate">{w.name}</span>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
            <Menu.Separator className="my-1 h-px bg-gray-200" />
            <Menu.Item onClick={() => void createWorkspace()} className={itemClass}>
              <PlusIcon className="size-3.5 text-gray-500" />
              New workspace
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
