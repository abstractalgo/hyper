import { Button } from "@base-ui/react/button";
import {
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  ReactFlow,
  useReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { NOTE_WIDTH, useCanvasStore } from "../store/canvas.ts";
import { EditorNodeView, TITLE_HANDLE_ID } from "./EditorNode.tsx";

const nodeTypes: NodeTypes = { editor: EditorNodeView };

/** One edge per `@mention`: from the mention's handle to the mentioned note's title. */
function useMentionEdges(): Edge[] {
  const mentionAnchors = useCanvasStore((s) => s.mentionAnchors);
  const nodeIds = useCanvasStore(useShallow((s) => s.nodes.map((n) => n.id)));

  return useMemo(() => {
    const exists = new Set(nodeIds);
    return Object.entries(mentionAnchors).flatMap(([source, anchors]) =>
      exists.has(source)
        ? anchors
            .filter((a) => a.targetId !== source && exists.has(a.targetId))
            .map((a) => ({
              id: `${source}:${a.handleId}`,
              source,
              sourceHandle: a.handleId,
              target: a.targetId,
              targetHandle: TITLE_HANDLE_ID,
            }))
        : [],
    );
  }, [mentionAnchors, nodeIds]);
}

export function Canvas() {
  const { nodes, onNodesChange, addNode } = useCanvasStore(
    useShallow((s) => ({
      nodes: s.nodes,
      onNodesChange: s.onNodesChange,
      addNode: s.addNode,
    })),
  );
  const edges = useMentionEdges();
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = () => {
    addNode(
      screenToFlowPosition({
        x: window.innerWidth / 2 - NOTE_WIDTH / 2,
        y: window.innerHeight / 2 - 100,
      }),
    );
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      // Edges only come from @mentions, so they can't be drawn, edited or selected by hand.
      nodesConnectable={false}
      edgesFocusable={false}
      edgesReconnectable={false}
      fitView
      fitViewOptions={{ maxZoom: 1 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} />
      <Controls showInteractive={false} />
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
