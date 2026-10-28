import {
  $applyNodeReplacement,
  $createNodeSelection,
  $setSelection,
  DecoratorNode,
  type DOMConversion,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

import { Equation } from "./Equation";

export type SerializedEquationNode = Spread<
  { equation: string; inline: boolean },
  SerializedLexicalNode
>;

/**
 * LaTeX equation, either inline within text or a display block of its own. Rendered with KaTeX;
 * while the node is selected (see `$editEquation`) its source is edited in place instead.
 */
export class EquationNode extends DecoratorNode<JSX.Element> {
  __equation: string;
  __inline: boolean;

  static getType(): string {
    return "equation";
  }

  static clone(node: EquationNode): EquationNode {
    return new EquationNode(node.__equation, node.__inline, node.__key);
  }

  static importJSON(serializedNode: SerializedEquationNode): EquationNode {
    return $createEquationNode(serializedNode.equation, serializedNode.inline).updateFromJSON(
      serializedNode,
    );
  }

  static importDOM(): DOMConversionMap | null {
    return { span: convertEquationElement, div: convertEquationElement };
  }

  constructor(equation: string, inline: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedEquationNode>): this {
    return super.updateFromJSON(serializedNode).setEquation(serializedNode.equation);
  }

  exportJSON(): SerializedEquationNode {
    return { ...super.exportJSON(), equation: this.getEquation(), inline: this.__inline };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement(this.__inline ? "span" : "div");
    element.setAttribute("data-equation", this.getEquation());
    element.textContent = this.getTextContent();
    return { element };
  }

  createDOM(): HTMLElement {
    return document.createElement(this.__inline ? "span" : "div");
  }

  updateDOM(): false {
    return false;
  }

  isInline(): boolean {
    return this.__inline;
  }

  // Arrow keys and Backspace step into the source (EquationsPlugin). Lexical selecting the node
  // itself, e.g. on ⌥→, would start editing too and trap word and line moves in the source field.
  isKeyboardSelectable(): false {
    return false;
  }

  getEquation(): string {
    return this.getLatest().__equation;
  }

  setEquation(equation: string): this {
    const writable = this.getWritable();
    writable.__equation = equation;
    return writable;
  }

  getTextContent(): string {
    return this.__inline ? `$${this.getEquation()}$` : `$$${this.getEquation()}$$\n`;
  }

  decorate(): JSX.Element {
    return <Equation nodeKey={this.__key} equation={this.getEquation()} inline={this.__inline} />;
  }
}

function convertEquationElement(domNode: HTMLElement): DOMConversion | null {
  const equation = domNode.getAttribute("data-equation");
  if (equation === null) return null;
  const inline = domNode.tagName === "SPAN";
  return { conversion: () => ({ node: $createEquationNode(equation, inline) }), priority: 1 };
}

export function $createEquationNode(equation: string, inline: boolean): EquationNode {
  return $applyNodeReplacement(new EquationNode(equation, inline));
}

export function $isEquationNode(node: LexicalNode | null | undefined): node is EquationNode {
  return node instanceof EquationNode;
}

/** Where to put the caret in the source when an equation starts being edited. */
export type EquationCaret = "start" | "end";

// Read (and reset) by the equation that becomes selected next. Only one equation is edited at a time.
let pendingCaret: EquationCaret | null = null;

/** Enters the equation's source editor: selects the node, which swaps its rendering for the source. */
export function $editEquation(node: EquationNode, caret: EquationCaret): void {
  pendingCaret = caret;
  const selection = $createNodeSelection();
  selection.add(node.getKey());
  $setSelection(selection);
}

export function takePendingCaret(): EquationCaret {
  const caret = pendingCaret ?? "end";
  pendingCaret = null;
  return caret;
}
