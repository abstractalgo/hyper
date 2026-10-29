import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_LEFT_COMMAND,
  KEY_ARROW_RIGHT_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  mergeRegister,
  type ElementNode,
  type LexicalEditor,
  type PointType,
} from "lexical";
import { useEffect } from "react";

import { $editEquation, $isEquationNode, type EquationNode } from "./EquationNode";

type Direction = "previous" | "next";

/**
 * Arrow keys step into an equation next to the caret, as if its source were text: ←/→ (and
 * Backspace/Delete) into the equation right beside it, ↑/↓ into a display equation above or below
 * the caret's line.
 */
export function EquationsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const enter =
      (direction: Direction, vertical: boolean) =>
      (event: KeyboardEvent): boolean => {
        if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
          return false;
        }
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const equation = vertical
          ? $displayEquationOnEdgeLine(editor, selection.focus, direction)
          : $equationBeside(selection.focus, direction);
        if (!equation) {
          return false;
        }
        event.preventDefault();
        $editEquation(equation, direction === "next" ? "start" : "end");
        return true;
      };

    return mergeRegister(
      editor.registerCommand(
        KEY_ARROW_LEFT_COMMAND,
        enter("previous", false),
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(KEY_ARROW_RIGHT_COMMAND, enter("next", false), COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ARROW_UP_COMMAND, enter("previous", true), COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_ARROW_DOWN_COMMAND, enter("next", true), COMMAND_PRIORITY_LOW),
      // Deleting into an equation edits its source rather than removing it whole.
      editor.registerCommand(KEY_BACKSPACE_COMMAND, enter("previous", false), COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_DELETE_COMMAND, enter("next", false), COMMAND_PRIORITY_LOW),
    );
  }, [editor]);

  return null;
}

/** The equation directly beside the caret: inline in the same line, or the next/previous block. */
function $equationBeside(point: PointType, direction: Direction): EquationNode | null {
  const node = point.getNode();
  let sibling = null;
  if ($isTextNode(node)) {
    const atEdge = point.offset === (direction === "next" ? node.getTextContentSize() : 0);
    if (atEdge) {
      sibling = direction === "next" ? node.getNextSibling() : node.getPreviousSibling();
    }
  } else if ($isElementNode(node)) {
    sibling = node.getChildAtIndex(direction === "next" ? point.offset : point.offset - 1);
  }
  if ($isEquationNode(sibling)) {
    return sibling;
  }

  const block = node.getTopLevelElement();
  if (!block || !$isAtBlockEdge(point, block, direction)) {
    return null;
  }
  const neighbor = direction === "next" ? block.getNextSibling() : block.getPreviousSibling();
  return $isEquationNode(neighbor) ? neighbor : null;
}

function $isAtBlockEdge(point: PointType, block: ElementNode, direction: Direction): boolean {
  const edge = direction === "next" ? block.getLastDescendant() : block.getFirstDescendant();
  if (edge === null) {
    return point.key === block.getKey();
  }
  if ($isTextNode(edge)) {
    return (
      point.key === edge.getKey() &&
      point.offset === (direction === "next" ? edge.getTextContentSize() : 0)
    );
  }
  // An inline decorator or line break: the caret is on its parent, before or after it.
  const parent = edge.getParentOrThrow();
  return (
    point.key === parent.getKey() &&
    point.offset === (direction === "next" ? parent.getChildrenSize() : 0)
  );
}

/** A display equation right above/below the caret's block, when the caret is on its first/last line. */
function $displayEquationOnEdgeLine(
  editor: LexicalEditor,
  point: PointType,
  direction: Direction,
): EquationNode | null {
  const block = point.getNode().getTopLevelElement();
  if (!block) {
    return null;
  }
  const neighbor = direction === "next" ? block.getNextSibling() : block.getPreviousSibling();
  if (!$isEquationNode(neighbor)) {
    return null;
  }

  const blockElement = editor.getElementByKey(block.getKey());
  const domSelection = window.getSelection();
  if (!blockElement || !domSelection || domSelection.rangeCount === 0) {
    return null;
  }
  const caret = domSelection.getRangeAt(0).getBoundingClientRect();
  // A caret in an empty line has no box; such a block is a single line anyway.
  if (caret.height === 0) {
    return neighbor;
  }
  const box = blockElement.getBoundingClientRect();
  const onEdgeLine =
    direction === "next"
      ? box.bottom - caret.bottom < caret.height
      : caret.top - box.top < caret.height;
  return onEdgeLine ? neighbor : null;
}
