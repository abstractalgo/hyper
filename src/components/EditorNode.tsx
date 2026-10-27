import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo, useCallback } from "react";

import { RichTextEditor } from "../editor/RichTextEditor.tsx";
import { useCanvasStore, type EditorNode } from "../store/canvas.ts";
import { NoteTitle } from "./NoteTitle.tsx";

export const EditorNodeView = memo(function EditorNodeView({
  id,
  data,
  selected,
}: NodeProps<EditorNode>) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
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
      className={`w-[360px] rounded-lg border bg-white shadow-sm ${
        selected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="cursor-grab rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 active:cursor-grabbing">
        <NoteTitle title={data.title} onRename={handleRename} />
      </div>
      {/* nodrag/nowheel stop React Flow from hijacking text selection and scrolling */}
      <div className="nodrag nowheel cursor-text">
        <RichTextEditor noteId={id} initialContent={data.content} onChange={handleChange} />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
});
