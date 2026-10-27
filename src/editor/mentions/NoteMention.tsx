import { useReactFlow } from "@xyflow/react";

import { useCanvasStore } from "../../store/canvas.ts";

export function NoteMention({ noteId }: { noteId: string }) {
  const title = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.title);
  const { fitView } = useReactFlow();

  if (title === undefined) {
    return (
      <span className="rte-mention rte-mention-missing" title="This note was deleted">
        @deleted note
      </span>
    );
  }

  return (
    <button
      type="button"
      className="rte-mention"
      // Read by useMentionAnchors to place this mention's edge handle.
      data-mention-target={noteId}
      title={`Go to “${title}”`}
      onClick={() => void fitView({ nodes: [{ id: noteId }], duration: 300, maxZoom: 1 })}
    >
      @{title}
    </button>
  );
}
