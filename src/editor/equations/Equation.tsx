import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { renderToString } from "katex";
import {
  $createParagraphNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isParagraphNode,
  $isNodeSelection,
  $setSelection,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

import {
  $editEquation,
  $isEquationNode,
  takePendingCaret,
  type EquationNode,
} from "./EquationNode";

type EquationProps = {
  nodeKey: NodeKey;
  equation: string;
  inline: boolean;
};

/**
 * Rendered equation, or its source with a live preview while the node is selected. The draft is
 * written back to the node when editing ends, so one edit is one undo step.
 */
export function Equation({ nodeKey, equation, inline }: EquationProps) {
  const [editor] = useLexicalComposerContext();
  const isEditing = useIsEditing(editor, nodeKey);
  const sourceRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const [draft, setDraft] = useState(equation);
  const [wasEditing, setWasEditing] = useState(isEditing);
  if (isEditing !== wasEditing) {
    setWasEditing(isEditing);
    if (isEditing) {
      setDraft(equation);
    }
  }

  useEffect(() => {
    const source = sourceRef.current;
    if (!isEditing || !source) {
      return;
    }
    const offset = takePendingCaret() === "start" ? 0 : source.value.length;
    source.focus();
    source.setSelectionRange(offset, offset);
  }, [isEditing]);

  /**
   * Commits the draft and moves the caret out of the equation, back into the text: right beside
   * it, on to the start/end of that line, or onto a new line after a display equation.
   */
  const exit = (side: "before" | "after", to: "beside" | "lineBoundary" | "newLine" = "beside") => {
    editor.update(
      () => {
        const node = $getNodeByKey(nodeKey);
        if (!$isEquationNode(node) || !$commitEquation(node, draft)) {
          return;
        }
        if (to === "newLine") {
          $selectNewLineAfter(node);
        } else {
          $selectBeside(node, side);
        }
      },
      {
        // Lexical has no line-boundary move of its own; continue natively once the caret is out.
        onUpdate:
          to === "lineBoundary"
            ? () =>
                window
                  .getSelection()
                  ?.modify("move", side === "before" ? "backward" : "forward", "lineboundary")
            : undefined,
      },
    );
    // Now, while the source field still has focus: once it unmounts, focus would fall to the body.
    editor.getRootElement()?.focus({ preventScroll: true });
  };

  // Leaving by other means (clicking elsewhere, switching windows) commits too.
  const handleBlur = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isEquationNode(node)) {
        return;
      }
      const wasSelected = $isEditing(nodeKey);
      if ($commitEquation(node, draft) && wasSelected) {
        $setSelection(null);
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = e.currentTarget;
    const selectionStart = e.currentTarget.selectionStart ?? 0;
    const selectionEnd = e.currentTarget.selectionEnd ?? 0;
    const collapsed = selectionStart === selectionEnd;
    const leave = (...args: Parameters<typeof exit>) => {
      e.preventDefault();
      exit(...args);
    };

    // Shift+Enter adds a line to a display equation
    if (e.key === "Enter" && !(e.shiftKey && !inline)) {
      leave("after", inline ? "beside" : "newLine");
    } else if (e.key === "Backspace" && value === "") {
      leave("before");
    } else if (!collapsed || e.shiftKey) {
      // Selecting within the source
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const side = e.key === "ArrowLeft" ? "before" : "after";
      const atEdge = side === "before" ? selectionStart === 0 : selectionEnd === value.length;
      // ⌘ goes to the start/end of the note's line, not of the source; ⌥ moves by word within it.
      if (e.metaKey) {
        leave(side, "lineBoundary");
      } else if (atEdge) {
        leave(side);
      }
    } else if (e.altKey || e.metaKey || e.ctrlKey) {
      // Native moves within the source
    } else if (e.key === "ArrowUp" && !value.slice(0, selectionStart).includes("\n")) {
      leave("before");
    } else if (e.key === "ArrowDown" && !value.slice(selectionEnd).includes("\n")) {
      leave("after");
    }
  };

  const startEditing = () => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isEquationNode(node)) {
        $editEquation(node, "end");
      }
    });
  };

  if (!isEditing) {
    const Tag = inline ? "span" : "div";
    return (
      <Tag
        // Lexical would otherwise turn the click into a caret selection, ending the edit it starts.
        ref={shieldFromLexical}
        className={inline ? "rte-equation" : "rte-equation rte-equation-block"}
        // Keep the browser from moving the caret, which would replace the selection set on click.
        onMouseDown={(e) => e.preventDefault()}
        onClick={startEditing}
      >
        <Katex source={equation} displayMode={!inline} />
      </Tag>
    );
  }

  const preview = draft.trim() !== "" && <Katex source={draft} displayMode={!inline} />;
  const sourceProps = {
    ref: sourceRef,
    value: draft,
    onChange: (e: { currentTarget: { value: string } }) => setDraft(e.currentTarget.value),
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    className: "rte-equation-source",
    placeholder: "LaTeX",
    spellCheck: false,
    autoCapitalize: "off",
    autoComplete: "off",
  };

  if (inline) {
    return (
      <span ref={shieldFromLexical} className="rte-equation-editor">
        {preview && <span className="rte-equation-preview">{preview}</span>}
        <input {...sourceProps} size={Math.max(draft.length, 5)} />
      </span>
    );
  }

  return (
    <div ref={shieldFromLexical} className="rte-equation-block rte-equation-editor">
      {preview && <div className="rte-equation-preview">{preview}</div>}
      <textarea {...sourceProps} rows={draft.split("\n").length} />
    </div>
  );
}

/**
 * Whether the equation is being edited: selected as a node, which only `$editEquation` does. Not
 * `node.isSelected()`, which is also true for a text selection spanning it (e.g. on ⌥⇧→).
 */
function useIsEditing(editor: LexicalEditor, nodeKey: NodeKey): boolean {
  return useSyncExternalStore(
    (onChange) => editor.registerUpdateListener(onChange),
    () => editor.getEditorState().read(() => $isEditing(nodeKey)),
  );
}

function $isEditing(nodeKey: NodeKey): boolean {
  const selection = $getSelection();
  return $isNodeSelection(selection) && selection.has(nodeKey);
}

function Katex({ source, displayMode }: { source: string; displayMode: boolean }) {
  const result = useMemo(() => {
    try {
      return { html: renderToString(source, { displayMode, throwOnError: true }) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [source, displayMode]);

  if (source.trim() === "") {
    return <span className="rte-equation-empty">Empty equation</span>;
  }
  if ("error" in result) {
    return (
      <span className="rte-equation-error" title={result.error}>
        {source}
      </span>
    );
  }
  return <span dangerouslySetInnerHTML={{ __html: result.html }} />;
}

/**
 * Writes the source back to the node. An equation left empty is removed, with the caret put where
 * it was. Returns whether the node is still there.
 */
function $commitEquation(node: EquationNode, source: string): boolean {
  if (source.trim() !== "") {
    if (node.getEquation() !== source) {
      node.setEquation(source);
    }
    return true;
  }
  if (node.isInline()) {
    node.selectPrevious();
    node.remove();
  } else {
    const paragraph = $createParagraphNode();
    node.replace(paragraph);
    paragraph.select();
  }
  return false;
}

/** Puts the caret on an empty line after a display equation, adding one unless it's there. */
function $selectNewLineAfter(node: EquationNode): void {
  const next = node.getNextSibling();
  if ($isParagraphNode(next) && next.isEmpty()) {
    next.select();
  } else {
    const paragraph = $createParagraphNode();
    node.insertAfter(paragraph);
    paragraph.select();
  }
}

/** Puts the caret right before or after the equation, entering a neighboring equation directly. */
function $selectBeside(node: EquationNode, side: "before" | "after"): void {
  const sibling = side === "before" ? node.getPreviousSibling() : node.getNextSibling();
  if ($isEquationNode(sibling)) {
    $editEquation(sibling, side === "before" ? "end" : "start");
  } else if (node.isInline()) {
    if (side === "before") {
      node.selectPrevious();
    } else {
      node.selectNext(0, 0);
    }
  } else if ($isElementNode(sibling)) {
    if (side === "before") {
      sibling.selectEnd();
    } else {
      sibling.selectStart();
    }
  } else {
    // A display equation at the start or end of the note: make a line to land on.
    const paragraph = $createParagraphNode();
    if (side === "before") {
      node.insertBefore(paragraph);
    } else {
      node.insertAfter(paragraph);
    }
    paragraph.select();
  }
}

// Root-element events Lexical would otherwise handle as its own (e.g. arrow keys moving or
// Backspace deleting the selected node) even though they happen in the source field.
const SHIELDED_EVENTS = [
  "keydown",
  "pointerdown",
  "compositionstart",
  "compositionend",
  "beforeinput",
  "input",
  "click",
  "cut",
  "copy",
  "paste",
  "dragstart",
  "drop",
];

// Lexical skips events carrying its own "already handled" flag (as for nested editors).
const markHandled = (event: Event) => Object.assign(event, { _lexicalHandled: true });

function shieldFromLexical(element: HTMLElement | null) {
  if (!element) {
    return;
  }
  for (const name of SHIELDED_EVENTS) {
    element.addEventListener(name, markHandled);
  }
  return () => {
    for (const name of SHIELDED_EVENTS) {
      element.removeEventListener(name, markHandled);
    }
  };
}
