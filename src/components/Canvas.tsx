import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  useStore,
  type Edge,
  type NodeTypes,
  type ReactFlowState,
} from "@xyflow/react";
import { useMemo, type MouseEvent } from "react";
import { useShallow } from "zustand/react/shallow";

import { NOTE_WIDTH, useCanvasStore } from "../store/canvas.ts";
import { EditorNodeView, TITLE_HANDLE_ID } from "./EditorNode.tsx";

const nodeTypes: NodeTypes = { editor: EditorNodeView };

/** Approximate rendered height of a note's title bar, used to center new notes on the cursor. */
const TITLE_BAR_HEIGHT = 28;

/** `nodeId:handleId` of every source handle React Flow has measured, as one comparable string. */
const measuredSourceHandles = (s: ReactFlowState) => {
  const keys: string[] = [];
  for (const [nodeId, node] of s.nodeLookup) {
    for (const handle of node.internals.handleBounds?.source ?? [])
      keys.push(`${nodeId}:${handle.id}`);
  }
  return keys.join("\n");
};

/**
 * One edge per `@mention`: from the mention's handle to the mentioned note's title.
 *
 * An edge is only emitted once React Flow has measured its source handle. Handles appear and
 * disappear as mentions are typed or deleted (and when a note remounts), and an edge pointing
 * at a handle React Flow doesn't know about yet (or anymore) fails to render.
 */
function useMentionEdges(): Edge[] {
  const mentionAnchors = useCanvasStore((s) => s.mentionAnchors);
  const nodeIds = useCanvasStore(useShallow((s) => s.nodes.map((n) => n.id)));
  const measured = useStore(measuredSourceHandles);

  return useMemo(() => {
    const exists = new Set(nodeIds);
    const handles = new Set(measured.split("\n"));
    return Object.entries(mentionAnchors).flatMap(([source, anchors]) =>
      exists.has(source)
        ? anchors
            .filter(
              (a) =>
                a.targetId !== source &&
                exists.has(a.targetId) &&
                handles.has(`${source}:${a.handleId}`),
            )
            .map((a) => ({
              id: `${source}:${a.handleId}`,
              source,
              sourceHandle: a.handleId,
              target: a.targetId,
              targetHandle: TITLE_HANDLE_ID,
            }))
        : [],
    );
  }, [mentionAnchors, nodeIds, measured]);
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

  // Double-clicking empty canvas (the pane itself, not a note or control) adds a note there,
  // with its title bar centered under the cursor.
  const handleDoubleClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.classList.contains("react-flow__pane")) return;
    const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode({ x: x - NOTE_WIDTH / 2, y: y - TITLE_BAR_HEIGHT / 2 });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onDoubleClick={handleDoubleClick}
      zoomOnDoubleClick={false}
      // Edges only come from @mentions, so they can't be drawn, edited or selected by hand.
      nodesConnectable={false}
      edgesFocusable={false}
      edgesReconnectable={false}
      fitView
      fitViewOptions={{ maxZoom: 1 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
