import { ReactFlowProvider } from "@xyflow/react";

import { Canvas } from "./components/Canvas";
import { WorkspaceSwitcher } from "./components/WorkspaceSwitcher";
import { useWorkspaces } from "./store/workspaces";
import { SettingsDialog } from "./workspace/ui/SettingsDialog";

export default function App() {
  // A fresh canvas per workspace: its own viewport, notes and editors.
  const activeId = useWorkspaces((s) => s.activeId);
  return (
    <ReactFlowProvider key={activeId}>
      <div className="relative h-full w-full">
        <Canvas />
        {/* Over the canvas; settings show the workspace's notes, so they're in its provider. */}
        <div className="absolute top-[15px] left-[15px] z-10 flex items-center gap-1.5">
          <WorkspaceSwitcher />
          <SettingsDialog />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
