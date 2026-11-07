import { $getSelection, $isNodeSelection, type LexicalEditor, type NodeKey } from "lexical";
import { useSyncExternalStore } from "react";

/**
 * Whether a node itself is selected (the caret "on" it, e.g. after arrowing onto it, or a click
 * that selects it), not a text selection that merely spans it. Only while the editor has focus:
 * Lexical keeps a node selection after focus leaves.
 */
export function useIsNodeSelected(editor: LexicalEditor, nodeKey: NodeKey): boolean {
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
