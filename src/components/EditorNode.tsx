import {
  Handle,
  NodeResizeControl,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { memo, useCallback, useLayoutEffect, useRef } from "react";

import { RichTextEditor } from "../editor/RichTextEditor.tsx";
import { OPTION_COLOR_CLASSES, type OptionColor } from "../workspace/model.ts";
import { isNoteHighlighted, useCanvasStore, type EditorNode } from "../store/canvas.ts";
import { NoteProperties } from "./NoteProperties.tsx";
import { NoteSchemaMenu } from "./NoteSchemaMenu.tsx";
import { NoteTitle } from "./NoteTitle.tsx";
import { useMentionAnchors } from "./useMentionAnchors.ts";

/** Every note receives incoming mention edges on this handle, level with its title. */
export const TITLE_HANDLE_ID = "title";

export const EditorNodeView = memo(function EditorNodeView({
  id,
  data,
  selected,
}: NodeProps<EditorNode>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setMentionAnchors = useCanvasStore((s) => s.setMentionAnchors);
  const setHighlight = useCanvasStore((s) => s.setHighlight);
  const highlighted = useCanvasStore((s) => isNoteHighlighted(s, id));
  // Matches what Canvas draws: an incoming edge exists when another note mentions this one.
  const hasIncoming = useCanvasStore((s) =>
    Object.entries(s.mentionAnchors).some(
      ([sourceId, sourceAnchors]) =>
        sourceId !== id && sourceAnchors.some((a) => a.targetId === id),
    ),
  );
  const updateNodeInternals = useUpdateNodeInternals();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const anchors = useMentionAnchors(rootRef, contentRef);

  // Handles moved, appeared or disappeared: have React Flow re-measure them, and publish the
  // anchors that edges are derived from (Canvas waits for the measurement before drawing).
  useLayoutEffect(() => {
    setMentionAnchors(id, anchors);
    updateNodeInternals(id);
  }, [id, anchors, updateNodeInternals, setMentionAnchors]);

  const handleChange = useCallback(
    (content: string) => updateNodeData(id, { content }),
    [id, updateNodeData],
  );
  const setNoteSchema = useCanvasStore((s) => s.setNoteSchema);
  const handleSchemaChange = useCallback(
    (schemaId: string | null) => setNoteSchema(id, schemaId),
    [id, setNoteSchema],
  );
  const handleColorChange = useCallback(
    (color: OptionColor | null) => updateNodeData(id, { color }),
    [id, updateNodeData],
  );
  const handleIconChange = useCallback(
    (icon: string | null) => updateNodeData(id, { icon }),
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
            ? `border-black/5 ${OPTION_COLOR_CLASSES[data.color]}`
            : "border-gray-200 bg-gray-50 text-gray-900"
        }`}
      >
        <NoteSchemaMenu
          schemaId={data.schemaId}
          color={data.color ?? null}
          icon={data.icon ?? null}
          onSchemaChange={handleSchemaChange}
          onColorChange={handleColorChange}
          onIconChange={handleIconChange}
        />
        <div className="min-w-0 flex-1">
          <NoteTitle title={data.title} onRename={handleRename} />
        </div>
        <Handle
          type="target"
          id={TITLE_HANDLE_ID}
          position={Position.Left}
          isConnectable={false}
          // Hidden rather than unmounted, so it's already measured when the first edge arrives.
          className={`note-handle ${hasIncoming ? "note-handle-clickable nodrag" : "invisible"}`}
          onClick={(e) => {
            // Don't let the node's own click handler clear the highlight right away.
            e.stopPropagation();
            setHighlight({ kind: "incoming", noteId: id });
          }}
        />
      </div>
      <NoteProperties noteId={id} />
      {/* nodrag: selecting text shouldn't drag the note. No overflow: notes grow with content. */}
      <div ref={contentRef} className="nodrag cursor-text">
        <RichTextEditor noteId={id} initialContent={data.content} onChange={handleChange} />
      </div>
      {anchors.map((anchor) => (
        <Handle
          key={anchor.handleId}
          type="source"
          id={anchor.handleId}
          position={Position.Right}
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
