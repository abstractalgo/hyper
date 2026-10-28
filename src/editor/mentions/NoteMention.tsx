import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useEffect, useRef, type MouseEvent } from "react";

import { locateMention } from "../../components/useMentionAnchors.ts";
import { NoteIcon } from "../../workspace/icons.tsx";
import { OPTION_COLOR_CLASSES } from "../../workspace/model.ts";
import { useCanvasStore } from "../../store/canvas.ts";

export function NoteMention({ noteId }: { noteId: string }) {
  const title = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.title);
  const color = useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.color);
  const { getInternalNode, getZoom, setCenter } = useReactFlow();
  const flowStore = useStoreApi();
  const setHighlight = useCanvasStore((s) => s.setHighlight);
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

  // Pan so the mentioned note is centered (keeping the zoom level) and select it.
  const goToNote = (e: MouseEvent) => {
    // Otherwise the click reaches the note containing the mention, which React Flow selects.
    e.stopPropagation();
    const node = getInternalNode(noteId);
    if (!node) return;
    const { x, y } = node.internals.positionAbsolute;
    const { width = 0, height = 0 } = node.measured;
    void setCenter(x + width / 2, y + height / 2, { zoom: getZoom(), duration: 300 });
    flowStore.getState().addSelectedNodes([noteId]);
    // A click on a note normally clears link highlights; this one no longer reaches the note.
    setHighlight(null);
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
      className={
        color ? `rte-mention rte-mention-colored ${OPTION_COLOR_CLASSES[color]}` : "rte-mention"
      }
      // Read by useMentionAnchors to place this mention's edge handle.
      data-mention-target={noteId}
      onClick={goToNote}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Plain notes have no icon of their own, so their mentions show just the title. */}
      <NoteIcon noteId={noteId} className="rte-mention-icon" showPlain={false} />
      {title}
    </button>
  );
}
