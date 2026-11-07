import {
  applyNodeChanges,
  ReactFlow,
  useStore,
  type Edge,
  type Node,
  type NodeChange,
  type NodeTypes,
  type ReactFlowProps,
  type ReactFlowState,
} from "@xyflow/react";
import { useId, useLayoutEffect, useMemo, useState } from "react";
import { useStore as useZustandStore, type StoreApi } from "zustand";
import { useShallow } from "zustand/react/shallow";

import {
  linkSide,
  NOTE_WIDTH,
  oppositeSide,
  useCanvasStore,
  type EditorNodeData,
  type Layout,
  type Placement,
} from "../store/canvas";
import {
  CanvasViewContext,
  createCanvasView,
  DEFAULT_FLOW_CLASSES,
  isLinkHighlighted,
  type CanvasViewState,
} from "./canvasView";
import { EditorNodeView, TITLE_HANDLE_IDS } from "./EditorNode";

/** A note as React Flow renders it. */
type FlowNote = Node<EditorNodeData, "editor">;

const nodeTypes: NodeTypes = { editor: EditorNodeView };

/** What React Flow tracks about a note while it's shown: selection, measured size, a drag… */
type Live = Pick<FlowNote, "selected" | "measured" | "dragging"> & {
  /** Where it's being dragged to, until it's dropped (and placed). */
  position?: FlowNote["position"];
  /** How wide it's being resized to, until it's let go (and placed). */
  width?: number;
};

/** Where a note without a placement goes: a grid, in the order notes are given. */
const autoPlace = (index: number): Placement => ({
  x: (index % 3) * (NOTE_WIDTH + 60),
  y: Math.floor(index / 3) * 320,
  width: NOTE_WIDTH,
});

/** `nodeId:handleId` of every source handle React Flow has measured, as one comparable string. */
const measuredSourceHandles = (s: ReactFlowState) => {
  const keys: string[] = [];
  for (const [nodeId, node] of s.nodeLookup) {
    for (const handle of node.internals.handleBounds?.source ?? []) {
      keys.push(`${nodeId}:${handle.id}`);
    }
  }
  return keys.join("\n");
};

/**
 * One edge per `@mention` between notes in this canvas: from the mention's handle to the
 * mentioned note's title.
 *
 * An edge is only emitted once React Flow has measured its source handle. Handles appear and
 * disappear as mentions are typed or deleted (and when a note remounts), and an edge pointing
 * at a handle React Flow doesn't know about yet (or anymore) fails to render.
 */
function useMentionEdges(view: StoreApi<CanvasViewState>, layout: Layout): Edge[] {
  const mentionAnchors = useZustandStore(view, (s) => s.anchors);
  const hoveredMention = useZustandStore(view, (s) => s.hoveredMention);
  const highlight = useZustandStore(view, (s) => s.highlight);
  const measured = useStore(measuredSourceHandles);

  return useMemo(() => {
    const handles = new Set(measured.split("\n"));
    return Object.entries(mentionAnchors).flatMap(([source, anchors]) =>
      source in layout
        ? anchors
            .filter(
              (a) =>
                a.targetId !== source &&
                a.targetId in layout &&
                handles.has(`${source}:${a.handleId}`),
            )
            .map((a) => ({
              id: `${source}:${a.handleId}`,
              source,
              sourceHandle: a.handleId,
              target: a.targetId,
              // Leaves on the side facing the target, enters on the side facing the source.
              targetHandle: TITLE_HANDLE_IDS[oppositeSide(linkSide(layout, source, a.targetId))],
              ...(isLinkHighlighted(
                { hoveredMention, highlight },
                { sourceId: source, handleId: a.handleId, targetId: a.targetId },
              ) && { className: "mention-edge-highlighted", zIndex: 1 }),
            }))
        : [],
    );
  }, [mentionAnchors, layout, measured, hoveredMention, highlight]);
}

type NoteCanvasProps = {
  /** The notes to show, by ID. */
  noteIds: string[];
  /** Where they are; notes it doesn't place go on a grid. */
  layout: Layout;
  /** Notes were moved or resized (on drop, not every frame). */
  onPlace: (placements: Layout) => void;
  /** Notes were deleted (with the Delete key); unset, they can't be deleted here. */
  onDeleteNotes?: (ids: string[]) => void;
  /** Notes' heights were measured. */
  onMeasure?: (heights: Record<string, number>) => void;
  /** A canvas inside a note: it gets class names of its own (see FlowClasses). */
  nested?: boolean;
} & Omit<ReactFlowProps<FlowNote>, "nodes" | "edges" | "onNodesChange" | "nodeTypes" | "onDelete">;

/**
 * Notes on a canvas: any notes, in any layout. The main canvas is one (all notes, the
 * workspace's layout); so is a canvas view in a note's text (a type's notes, its own layout).
 * Notes are live views of the store: the same note can be on several canvases at once. What's
 * the canvas's own (where notes are shown, the links between them, what's highlighted) is in its
 * own store, which its notes read (see useCanvasView).
 */
export function NoteCanvas({
  noteIds,
  layout,
  onPlace,
  onDeleteNotes,
  onMeasure,
  nested = false,
  children,
  ...flowProps
}: NoteCanvasProps) {
  const data = useCanvasStore(
    useShallow((s) => noteIds.map((id) => s.notes.find((n) => n.id === id)?.data)),
  );
  const [live, setLive] = useState<Record<string, Live>>({});

  const nodes = noteIds.flatMap((id, i): FlowNote[] => {
    const note = data[i];
    if (!note) {
      return [];
    }
    const placed = layout[id] ?? autoPlace(i);
    const { position, width, ...tracked } = live[id] ?? {};
    return [
      {
        id,
        type: "editor",
        data: note,
        position: position ?? { x: placed.x, y: placed.y },
        width: width ?? placed.width,
        ...tracked,
      },
    ];
  });
  const shown: Layout = useMemo(
    () =>
      Object.fromEntries(nodes.map((n) => [n.id, { ...n.position, width: n.width ?? NOTE_WIDTH }])),
    // Only positions and widths matter, as one comparable string.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(nodes.map((n) => [n.id, n.position, n.width]))],
  );
  // This canvas's own state; its notes read where the others are from here.
  const uid = useId().replace(/[^\w-]/g, "");
  const [view] = useState(() =>
    createCanvasView(
      nested
        ? { noDrag: `nodrag-${uid}`, noPan: `nopan-${uid}`, noWheel: `nowheel-${uid}` }
        : DEFAULT_FLOW_CLASSES,
    ),
  );
  const { noDrag, noPan, noWheel } = view.getState().classes;
  useLayoutEffect(() => view.getState().setLayout(shown), [view, shown]);
  const edges = useMentionEdges(view, shown);
  const setHighlight = useZustandStore(view, (s) => s.setHighlight);

  const onNodesChange = (changes: NodeChange<FlowNote>[]) => {
    const removed = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
    if (removed.length > 0) {
      onDeleteNotes?.(removed);
    }
    const next = applyNodeChanges(
      changes.filter((c) => c.type !== "remove"),
      nodes,
    );
    const byId = new Map(next.map((n) => [n.id, n]));
    const placements: Layout = {};
    const heights: Record<string, number> = {};
    const updated = { ...live };
    for (const n of next) {
      updated[n.id] = {
        ...updated[n.id],
        selected: n.selected,
        measured: n.measured,
        dragging: n.dragging,
      };
    }
    for (const c of changes) {
      const n = c.type === "position" || c.type === "dimensions" ? byId.get(c.id) : undefined;
      if (!n) {
        continue;
      }
      const placement = { ...n.position, width: n.width ?? NOTE_WIDTH };
      if (c.type === "position" && c.position) {
        // Shown where it's dragged; placed (saved) when dropped.
        updated[c.id] = { ...updated[c.id], position: c.dragging ? c.position : undefined };
        if (!c.dragging) {
          placements[c.id] = placement;
        }
      } else if (c.type === "dimensions" && c.dimensions) {
        if (c.resizing !== undefined) {
          updated[c.id] = { ...updated[c.id], width: c.resizing ? c.dimensions.width : undefined };
          if (!c.resizing) {
            placements[c.id] = { ...placement, width: c.dimensions.width };
          }
        }
        heights[c.id] = c.dimensions.height;
      }
    }
    setLive(Object.fromEntries(Object.entries(updated).filter(([id]) => byId.has(id))));
    if (Object.keys(placements).length > 0) {
      onPlace(placements);
    }
    if (onMeasure && Object.keys(heights).length > 0) {
      onMeasure(heights);
    }
  };

  return (
    <CanvasViewContext.Provider value={view}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgeClick={(_, edge) =>
          setHighlight({
            kind: "link",
            link: {
              sourceId: edge.source,
              handleId: edge.sourceHandle ?? "",
              targetId: edge.target,
            },
          })
        }
        onPaneClick={() => setHighlight(null)}
        onNodeClick={() => setHighlight(null)}
        deleteKeyCode={onDeleteNotes ? undefined : null}
        noDragClassName={noDrag}
        noPanClassName={noPan}
        noWheelClassName={noWheel}
        zoomOnDoubleClick={false}
        // Two-finger trackpad scrolling pans; pinch (or Ctrl/Cmd + wheel) zooms. Speed 1 moves the
        // canvas as far as the fingers move, like scrolling a page (React Flow's default is 0.5).
        panOnScroll
        panOnScrollSpeed={1}
        // Edges only come from @mentions, so they can't be drawn, edited or selected by hand.
        nodesConnectable={false}
        edgesFocusable={false}
        edgesReconnectable={false}
        minZoom={0.1}
        {...flowProps}
      >
        {children}
      </ReactFlow>
    </CanvasViewContext.Provider>
  );
}
