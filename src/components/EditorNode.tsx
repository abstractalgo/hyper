import {
  Handle,
  NodeResizeControl,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { memo, useCallback, useLayoutEffect, useRef } from "react";

import { RichTextEditor } from "../editor/RichTextEditor.tsx";
import { useCanvasStore, type EditorNode } from "../store/canvas.ts";
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
  const updateNodeInternals = useUpdateNodeInternals();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { anchors, minHeight } = useMentionAnchors(rootRef, contentRef);

  // React Flow re-measures handles on the next frame; publish the anchors (and so the edges)
  // in a frame queued after that, so edges never reference handles it hasn't measured yet.
  useLayoutEffect(() => {
    updateNodeInternals(id);
    const frame = requestAnimationFrame(() => setMentionAnchors(id, anchors));
    return () => cancelAnimationFrame(frame);
  }, [id, anchors, updateNodeInternals, setMentionAnchors]);

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
      className={`relative flex h-full w-full flex-col rounded-lg border bg-white shadow-sm ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
      }`}
    >
      <div className="relative shrink-0 cursor-grab rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 active:cursor-grabbing">
        <NoteTitle title={data.title} onRename={handleRename} />
        <Handle
          type="target"
          id={TITLE_HANDLE_ID}
          position={Position.Left}
          isConnectable={false}
          className="note-handle"
        />
      </div>
      {/* nodrag/nowheel stop React Flow from hijacking text selection and scrolling */}
      <div ref={contentRef} className="nodrag nowheel min-h-0 flex-1 cursor-text overflow-y-auto">
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
      <NodeResizeControl
        position="bottom-right"
        minWidth={240}
        minHeight={minHeight}
        className="note-resize-control"
      />
    </div>
  );
});
