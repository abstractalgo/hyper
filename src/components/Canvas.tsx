import { Button } from "@base-ui/react/button";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import { useShallow } from "zustand/react/shallow";

import { useCanvasStore } from "../store/canvas.ts";
import { EditorNodeView } from "./EditorNode.tsx";

const nodeTypes: NodeTypes = { editor: EditorNodeView };

export function Canvas() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      addNode: s.addNode,
    })),
  );
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = () => {
    addNode(
      screenToFlowPosition({ x: window.innerWidth / 2 - 180, y: window.innerHeight / 2 - 100 }),
    );
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      fitViewOptions={{ maxZoom: 1 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} />
      <Controls />
      <MiniMap pannable zoomable />
      <Panel position="top-left">
        <Button
          className="h-8 rounded-md bg-gray-900 px-3 text-sm font-medium text-white shadow-sm select-none hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={handleAddNode}
        >
          Add note
        </Button>
      </Panel>
    </ReactFlow>
  );
}
