import {
  Handle,
  NodeResizeControl,
  Position,
  useStoreApi,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { memo, useCallback, useContext, useLayoutEffect, useMemo, useRef } from "react";

import { RichTextEditor } from "../editor/RichTextEditor";
import { NOTE_COLOR_CLASSES } from "../workspace/model";
import {
  linkSide,
  oppositeSide,
  useCanvasStore,
  type EditorNodeData,
  type LinkSide,
} from "../store/canvas";
import { AncestorsContext, isNoteHighlighted, useCanvasView, useFlowClasses } from "./canvasView";
import { NoteProperties } from "./NoteProperties";
import { NoteTypeMenu } from "./NoteTypeMenu";
import { NoteTitle } from "./NoteTitle";
import { useMentionAnchors } from "./useMentionAnchors";

/** Every note receives incoming mention edges on this handle, level with its title. */
/** Incoming links attach next to the title, on the side facing the mentioning note. */
export const TITLE_HANDLE_IDS = {
  left: "title-left",
  right: "title-right",
} as const satisfies Record<LinkSide, string>;

const POSITIONS = { left: Position.Left, right: Position.Right } satisfies Record<
  LinkSide,
  Position
>;

export const EditorNodeView = memo(function EditorNodeView({
  id,
  data,
  selected,
}: NodeProps<Node<EditorNodeData, "editor">>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  // Links, where notes are and what's highlighted are this canvas's (see useCanvasView).
  const setAnchors = useCanvasView((s) => s.setAnchors);
  const { noDrag } = useFlowClasses();
  const setHighlight = useCanvasView((s) => s.setHighlight);
  const highlighted = useCanvasView((s) => isNoteHighlighted(s, id));
  // Matches what the canvas draws: which sides of the title have incoming links (as a string, so
  // this only re-renders when that changes, not on every drag frame).
  const incomingSides = useCanvasView((s) =>
    [
      ...new Set(
        Object.entries(s.anchors).flatMap(([sourceId, sourceAnchors]) =>
          sourceId !== id && sourceId in s.layout && sourceAnchors.some((a) => a.targetId === id)
            ? [oppositeSide(linkSide(s.layout, sourceId, id))]
            : [],
        ),
      ),
    ].join(","),
  );
  const propertiesRight = useCanvasStore((s) => s.propertiesPosition === "right");
  // Re-measures this note's handles, from its own element: React Flow's useUpdateNodeInternals
  // looks the note up by ID inside the whole canvas, which would find the same note shown in a
  // canvas inside another note.
  const flowStore = useStoreApi();
  const rootRef = useRef<HTMLDivElement>(null);
  const updateNodeInternals = useCallback(() => {
    const nodeElement = rootRef.current?.closest<HTMLDivElement>(".react-flow__node");
    if (nodeElement) {
      flowStore.getState().updateNodeInternals(new Map([[id, { id, nodeElement, force: true }]]));
    }
  }, [id, flowStore]);
  const contentRef = useRef<HTMLDivElement>(null);
  const anchors = useMentionAnchors(rootRef, contentRef);
  // Each mention's handle sits on the side facing the note it mentions.
  const anchorSides = useCanvasView((s) =>
    anchors.map((a) => linkSide(s.layout, id, a.targetId)).join(","),
  );
  const sideOf = (i: number) => (anchorSides.split(",")[i] ?? "right") as LinkSide;

  // Handles moved, appeared or disappeared: have React Flow re-measure them, and publish the
  // anchors that edges are derived from (Canvas waits for the measurement before drawing).
  useLayoutEffect(() => {
    setAnchors(id, anchors);
    updateNodeInternals();
  }, [id, anchors, updateNodeInternals, setAnchors]);
  // Handles also move when they switch sides, as notes are dragged past each other.
  const measuredSides = useRef(anchorSides);
  useLayoutEffect(() => {
    if (measuredSides.current === anchorSides) {
      return;
    }
    measuredSides.current = anchorSides;
    updateNodeInternals();
  }, [anchorSides, updateNodeInternals]);

  const handleChange = useCallback(
    (content: string) => updateNodeData(id, { content }),
    [id, updateNodeData],
  );
  // Views in this note's text (e.g. a canvas) are inside this note, and whatever contains it.
  const outer = useContext(AncestorsContext);
  const ancestors = useMemo(() => [...outer, id], [outer, id]);
  const handleRename = useCallback(
    (title: string) => updateNodeData(id, { title }),
    [id, updateNodeData],
  );

  return (
    <div
      ref={rootRef}
      // group/note: parts of the note that only show while it's hovered.
      className={`group/note relative flex w-full flex-col rounded-lg border bg-white shadow-sm ${
        highlighted
          ? "border-amber-400 ring-4 ring-amber-200"
          : selected
            ? "border-blue-500 ring-2 ring-blue-200"
            : "border-gray-200"
      }`}
    >
      <div
        className={`relative flex shrink-0 cursor-grab items-center gap-1.5 rounded-t-lg border-b py-1.5 pr-3 pl-2 text-sm font-semibold active:cursor-grabbing ${
          data.color
            ? `border-black/5 ${NOTE_COLOR_CLASSES[data.color]}`
            : "border-gray-200 bg-gray-50 text-gray-900"
        }`}
      >
        <NoteTypeMenu noteId={id} />
        <div className="min-w-0 flex-1">
          <NoteTitle title={data.title} onRename={handleRename} />
        </div>
        {(["left", "right"] as const).map((side) => (
          <Handle
            key={side}
            type="target"
            id={TITLE_HANDLE_IDS[side]}
            position={POSITIONS[side]}
            isConnectable={false}
            // Hidden rather than unmounted, so it's already measured when the first edge arrives.
            className={`note-handle ${
              incomingSides.includes(side) ? `note-handle-clickable ${noDrag}` : "invisible"
            }`}
            onClick={(e) => {
              // Don't let the node's own click handler clear the highlight right away.
              e.stopPropagation();
              setHighlight({ kind: "incoming", noteId: id });
            }}
          />
        ))}
      </div>
      {/* Fields above the text, or right of it (a workspace setting). The editor keeps its place
          in the tree either way, so switching doesn't remount it. */}
      <div className={propertiesRight ? "flex flex-row-reverse" : "flex flex-col"}>
        <NoteProperties noteId={id} selected={selected} />
        {/* nodrag: selecting text shouldn't drag the note. nokey: React Flow ignores keys typed here
            (it only skips contenteditable elements themselves, and a focused todo item isn't one, so
            arrows would move the note). No overflow: notes grow with content. */}
        <div ref={contentRef} className={`${noDrag} nokey min-w-0 flex-1 cursor-text`}>
          <AncestorsContext.Provider value={ancestors}>
            <RichTextEditor noteId={id} content={data.content} onChange={handleChange} />
          </AncestorsContext.Provider>
        </div>
      </div>
      {anchors.map((anchor, i) => (
        <Handle
          key={anchor.handleId}
          type="source"
          id={anchor.handleId}
          position={POSITIONS[sideOf(i)]}
          isConnectable={false}
          className="note-handle"
          style={{ top: anchor.y }}
        />
      ))}
      {/* Width only: the height always follows the content. */}
      <NodeResizeControl
        position="bottom-right"
        resizeDirection="horizontal"
        minWidth={240}
        className="note-resize-control"
      />
    </div>
  );
});
