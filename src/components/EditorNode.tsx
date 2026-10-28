import {
  Handle,
  NodeResizeControl,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { memo, useCallback, useLayoutEffect, useRef } from "react";

import { RichTextEditor } from "../editor/RichTextEditor";
import { NOTE_COLOR_CLASSES } from "../workspace/model";
import {
  isNoteHighlighted,
  linkSide,
  oppositeSide,
  useCanvasStore,
  type EditorNode,
  type LinkSide,
} from "../store/canvas";
import { NoteProperties } from "./NoteProperties";
import { NoteSchemaMenu } from "./NoteSchemaMenu";
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
}: NodeProps<EditorNode>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setMentionAnchors = useCanvasStore((s) => s.setMentionAnchors);
  const setHighlight = useCanvasStore((s) => s.setHighlight);
  const highlighted = useCanvasStore((s) => isNoteHighlighted(s, id));
  // Matches what Canvas draws: which sides of the title have incoming links (as one string, so
  // this only re-renders when that changes, not on every drag frame).
  const incomingSides = useCanvasStore((s) =>
    [
      ...new Set(
        Object.entries(s.mentionAnchors).flatMap(([sourceId, sourceAnchors]) =>
          sourceId !== id && sourceAnchors.some((a) => a.targetId === id)
            ? [oppositeSide(linkSide(s.nodes, sourceId, id))]
            : [],
        ),
      ),
    ].join(","),
  );
  const updateNodeInternals = useUpdateNodeInternals();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const anchors = useMentionAnchors(rootRef, contentRef);
  // Each mention's handle sits on the side facing the note it mentions.
  const anchorSides = useCanvasStore((s) =>
    anchors.map((a) => linkSide(s.nodes, id, a.targetId)).join(","),
  );
  const sideOf = (i: number) => (anchorSides.split(",")[i] ?? "right") as LinkSide;

  // Handles moved, appeared or disappeared: have React Flow re-measure them, and publish the
  // anchors that edges are derived from (Canvas waits for the measurement before drawing).
  useLayoutEffect(() => {
    setMentionAnchors(id, anchors);
    updateNodeInternals(id);
  }, [id, anchors, updateNodeInternals, setMentionAnchors]);
  // Handles also move when they switch sides, as notes are dragged past each other.
  const measuredSides = useRef(anchorSides);
  useLayoutEffect(() => {
    if (measuredSides.current === anchorSides) return;
    measuredSides.current = anchorSides;
    updateNodeInternals(id);
  }, [id, anchorSides, updateNodeInternals]);

  const handleChange = useCallback(
    (content: string) => updateNodeData(id, { content }),
    [id, updateNodeData],
  );
  const handleRename = useCallback(
    (title: string) => updateNodeData(id, { title }),
    [id, updateNodeData],
  );

  return (
    <div
      ref={rootRef}
      className={`relative flex w-full flex-col rounded-lg border bg-white shadow-sm ${
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
        <NoteSchemaMenu noteId={id} />
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
              incomingSides.includes(side) ? "note-handle-clickable nodrag" : "invisible"
            }`}
            onClick={(e) => {
              // Don't let the node's own click handler clear the highlight right away.
              e.stopPropagation();
              setHighlight({ kind: "incoming", noteId: id });
            }}
          />
        ))}
      </div>
      <NoteProperties noteId={id} />
      {/* nodrag: selecting text shouldn't drag the note. nokey: React Flow ignores keys typed here
          (it only skips contenteditable elements themselves, and a focused todo item isn't one, so
          arrows would move the note). No overflow: notes grow with content. */}
      <div ref={contentRef} className="nodrag nokey cursor-text">
        <RichTextEditor noteId={id} initialContent={data.content} onChange={handleChange} />
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
