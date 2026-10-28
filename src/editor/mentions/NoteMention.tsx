import { useEffect, useRef, type MouseEvent } from "react";

import { useGoToNote } from "../../components/useGoToNote.ts";
import { locateMention } from "../../components/useMentionAnchors.ts";
import { NoteIcon } from "../../workspace/icons.tsx";
import { NOTE_COLOR_CLASSES } from "../../workspace/model.ts";
import { useCanvasStore, useNoteData } from "../../store/canvas.ts";

export function NoteMention({ noteId }: { noteId: string }) {
  const title = useNoteData(noteId, "title");
  const color = useNoteData(noteId, "color");
  const goToNote = useGoToNote();
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
  const goToMentionedNote = (e: MouseEvent) => {
    // Otherwise the click reaches the note containing the mention, which React Flow selects.
    e.stopPropagation();
    goToNote(noteId);
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
        color ? `rte-mention rte-mention-colored ${NOTE_COLOR_CLASSES[color]}` : "rte-mention"
      }
      // Read by useMentionAnchors to place this mention's edge handle.
      data-mention-target={noteId}
      onClick={goToMentionedNote}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Plain notes have no icon of their own, so their mentions show just the title. */}
      <NoteIcon noteId={noteId} className="rte-mention-icon" showPlain={false} />
      {title}
    </button>
  );
}
