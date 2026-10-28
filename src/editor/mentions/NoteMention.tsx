import { useEffect, useRef, type MouseEvent } from "react";

import { useGoToNote } from "../../components/useGoToNote";
import { locateMention } from "../../components/useMentionAnchors";
import { NoteIcon } from "../../workspace/icons";
import { NOTE_COLOR_CLASSES } from "../../workspace/model";
import { useCanvasStore, useNoteData } from "../../store/canvas";

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

  // A span rather than a <button>: buttons lay out as inline blocks, so a long mention would wrap
  // inside its own box instead of with the text around it.
  return (
    <span
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- see above
      role="button"
      tabIndex={0}
      className={
        color ? `rte-mention rte-mention-colored ${NOTE_COLOR_CLASSES[color]}` : "rte-mention"
      }
      // Read by useMentionAnchors to place this mention's edge handle.
      data-mention-target={noteId}
      onClick={goToMentionedNote}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToNote(noteId);
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Plain notes have no icon of their own, so their mentions show just the title. */}
      <NoteIcon noteId={noteId} className="rte-mention-icon" showPlain={false} />
      {title}
    </span>
  );
}
