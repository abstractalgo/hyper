import { useReactFlow } from "@xyflow/react";
import { useEffect, useRef, type MouseEvent } from "react";

import { locateMention } from "../../components/useMentionAnchors.ts";
import { useCanvasStore } from "../../store/canvas.ts";

export function NoteMention({ noteId }: { noteId: string }) {
  const title = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.title);
  const { getInternalNode, getZoom, setCenter } = useReactFlow();
  const setHoveredMention = useCanvasStore((s) => s.setHoveredMention);
  const isHovered = useRef(false);

  const handleMouseEnter = (e: MouseEvent<HTMLElement>) => {
    const location = locateMention(e.currentTarget);
    if (!location) return;
    isHovered.current = true;
    setHoveredMention({ ...location, targetId: noteId });
  };
  const handleMouseLeave = () => {
    isHovered.current = false;
    setHoveredMention(null);
  };
  // A mention deleted while hovered never gets mouseleave.
  useEffect(
    () => () => {
      if (isHovered.current) setHoveredMention(null);
    },
    [setHoveredMention],
  );

  // Pan so the mentioned note is centered, keeping the current zoom level.
  const panToNote = () => {
    const node = getInternalNode(noteId);
    if (!node) return;
    const { x, y } = node.internals.positionAbsolute;
    const { width = 0, height = 0 } = node.measured;
    void setCenter(x + width / 2, y + height / 2, { zoom: getZoom(), duration: 300 });
  };

  if (title === undefined) {
    return (
      <span className="rte-mention rte-mention-missing" title="This note was deleted">
        deleted note
      </span>
    );
  }

  return (
    <button
      type="button"
      className="rte-mention"
      // Read by useMentionAnchors to place this mention's edge handle.
      data-mention-target={noteId}
      onClick={panToNote}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {title}
    </button>
  );
}
