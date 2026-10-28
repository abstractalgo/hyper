import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isNodeSelection, type LexicalEditor, type NodeKey } from "lexical";
import { useEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from "react";

import { useGoToNote } from "../../components/useGoToNote";
import { locateMention } from "../../components/useMentionAnchors";
import { NoteIcon } from "../../workspace/icons";
import { NOTE_COLOR_CLASSES } from "../../workspace/model";
import { useCanvasStore, useNoteData } from "../../store/canvas";

/**
 * Whether the mention itself is selected (the caret "on" it, e.g. after arrowing onto it), not a
 * text selection that merely spans it. Only while the editor has focus: Lexical keeps a node
 * selection after focus leaves.
 */
function useIsNodeSelected(editor: LexicalEditor, nodeKey: NodeKey): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const root = editor.getRootElement();
      root?.addEventListener("focus", onChange);
      root?.addEventListener("blur", onChange);
      const unregister = editor.registerUpdateListener(onChange);
      return () => {
        root?.removeEventListener("focus", onChange);
        root?.removeEventListener("blur", onChange);
        unregister();
      };
    },
    () =>
      editor.getRootElement() === document.activeElement &&
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        return $isNodeSelection(selection) && selection.has(nodeKey);
      }),
  );
}

export function NoteMention({ noteId, nodeKey }: { noteId: string; nodeKey: NodeKey }) {
  const [editor] = useLexicalComposerContext();
  const title = useNoteData(noteId, "title");
  const color = useNoteData(noteId, "color");
  const goToNote = useGoToNote();
  const setHoveredMention = useCanvasStore((s) => s.setHoveredMention);
  const ref = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const selected = useIsNodeSelected(editor, nodeKey);

  // Hovered or selected, the mention highlights the note it points to and the link there.
  const active = hovered || selected;
  useEffect(() => {
    if (!active || !ref.current) return;
    const location = locateMention(ref.current);
    if (!location) return;
    setHoveredMention({ ...location, targetId: noteId });
    // Also when the mention is deleted while active (it never gets mouseleave then).
    return () => setHoveredMention(null);
  }, [active, noteId, setHoveredMention]);

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
      ref={ref}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- see above
      role="button"
      tabIndex={0}
      className={`rte-mention ${color ? `rte-mention-colored ${NOTE_COLOR_CLASSES[color]}` : ""} ${
        selected ? "rte-mention-selected" : ""
      }`}
      // Read by useMentionAnchors to place this mention's edge handle.
      data-mention-target={noteId}
      onClick={goToMentionedNote}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToNote(noteId);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Plain notes have no icon of their own, so their mentions show just the title. */}
      <NoteIcon noteId={noteId} className="rte-mention-icon" showPlain={false} />
      {title}
    </span>
  );
}
