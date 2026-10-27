import { ReactFlowProvider } from "@xyflow/react";

import { Canvas } from "./components/Canvas.tsx";

export default function App() {
  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <Canvas />
      </div>
    </ReactFlowProvider>
  );
}
