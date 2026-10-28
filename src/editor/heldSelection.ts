import {
  $generateJSONFromSelectedNodes,
  $generateNodesFromSerializedNodes,
  $insertGeneratedNodes,
} from "@lexical/clipboard";
import { createHeadlessEditor } from "@lexical/headless";
import {
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  getNearestEditorFromDOMNode,
  SKIP_SCROLL_INTO_VIEW_TAG,
  type BaseSelection,
  type LexicalEditor,
} from "lexical";

import { $createNoteMentionNode } from "./mentions/NoteMentionNode";
import { EDITOR_NODES } from "./nodes";

/**
 * A note editor's selection, held while focus is elsewhere (e.g. in the command palette): the
 * editor drops its selection as soon as focus leaves it.
 */
export type HeldSelection = {
  editor: LexicalEditor;
  selection: BaseSelection;
  /** The note the editor belongs to. */
  noteId: string;
  /** The selected text, whitespace collapsed; empty for a caret. */
  text: string;
};

/** The selection of the note editor that has focus, or null if focus isn't in one. */
export function holdEditorSelection(): HeldSelection | null {
  const root = document.activeElement;
  if (!(root instanceof HTMLElement) || !root.isContentEditable) return null;
  const editor = getNearestEditorFromDOMNode(root);
  const noteId = root.closest(".react-flow__node")?.getAttribute("data-id");
  if (!editor || !noteId) return null;
  return editor.getEditorState().read(() => {
    const selection = $getSelection();
    if (!selection) return null;
    const text = selection.getTextContent().replace(/\s+/g, " ").trim();
    return { editor, selection: selection.clone(), noteId, text };
  });
}

/**
 * Focuses the editor again and applies `apply` with the held selection back in place (it does
 * nothing if what was selected has been deleted since). Without scrolling: the canvas, not the
 * page, decides what's in view.
 */
function resume(held: HeldSelection, apply?: () => void) {
  held.editor.getRootElement()?.focus({ preventScroll: true });
  held.editor.update(
    () => {
      const { selection } = held;
      if (
        $isRangeSelection(selection) &&
        (!$getNodeByKey(selection.anchor.key) || !$getNodeByKey(selection.focus.key))
      ) {
        return;
      }
      $setSelection(selection.clone());
      apply?.();
    },
    { tag: SKIP_SCROLL_INTO_VIEW_TAG },
  );
}

export const restoreEditorSelection = (held: HeldSelection) => resume(held);

/** Replaces the held selection with a mention of `noteId`, leaving the caret after it. */
export function replaceWithMention(held: HeldSelection, noteId: string) {
  resume(held, () => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    const mention = $createNoteMentionNode(noteId);
    selection.insertNodes([mention]);
    mention.selectNext();
  });
}

/**
 * The held selection's content (formatting, lists, mentions…) as a note's serialized editor state,
 * the way copy and paste would carry it over.
 */
export function selectionAsContent(held: HeldSelection): string {
  const { nodes } = held.editor.read(() =>
    $generateJSONFromSelectedNodes(held.editor, held.selection),
  );
  const editor = createHeadlessEditor({
    nodes: EDITOR_NODES,
    onError: (error) => {
      throw error;
    },
  });
  editor.update(
    () => {
      const selection = $getRoot().select();
      $insertGeneratedNodes(editor, $generateNodesFromSerializedNodes(nodes), selection);
    },
    { discrete: true },
  );
  return JSON.stringify(editor.getEditorState().toJSON());
}
