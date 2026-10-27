import {
  $applyNodeReplacement,
  DecoratorNode,
  type DOMConversionMap,
  type DOMExportOutput,
  type LexicalNode,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

import { useCanvasStore } from "../../store/canvas.ts";
import { NoteMention } from "./NoteMention.tsx";

export type SerializedNoteMentionNode = Spread<{ noteId: string }, SerializedLexicalNode>;

/**
 * Inline reference to another note. Only the note's stable ID is stored;
 * the visible label is looked up at render time so renames propagate.
 */
export class NoteMentionNode extends DecoratorNode<JSX.Element> {
  __noteId: string;

  static getType(): string {
    return "note-mention";
  }

  static clone(node: NoteMentionNode): NoteMentionNode {
    return new NoteMentionNode(node.__noteId, node.__key);
  }

  static importJSON(serializedNode: SerializedNoteMentionNode): NoteMentionNode {
    return $createNoteMentionNode(serializedNode.noteId).updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        const noteId = domNode.getAttribute("data-note-mention");
        if (noteId === null) return null;
        return { conversion: () => ({ node: $createNoteMentionNode(noteId) }), priority: 1 };
      },
    };
  }

  constructor(noteId: string, key?: NodeKey) {
    super(key);
    this.__noteId = noteId;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedNoteMentionNode>): this {
    return super.updateFromJSON(serializedNode).setNoteId(serializedNode.noteId);
  }

  exportJSON(): SerializedNoteMentionNode {
    return { ...super.exportJSON(), noteId: this.getNoteId() };
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute("data-note-mention", this.getNoteId());
    element.textContent = this.getTextContent();
    return { element };
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  isInline(): true {
    return true;
  }

  getNoteId(): string {
    return this.getLatest().__noteId;
  }

  setNoteId(noteId: string): this {
    const writable = this.getWritable();
    writable.__noteId = noteId;
    return writable;
  }

  getTextContent(): string {
    const note = useCanvasStore.getState().nodes.find((n) => n.id === this.getNoteId());
    return `@${note?.data.title ?? "deleted note"}`;
  }

  decorate(): JSX.Element {
    return <NoteMention noteId={this.getNoteId()} />;
  }
}

export function $createNoteMentionNode(noteId: string): NoteMentionNode {
  return $applyNodeReplacement(new NoteMentionNode(noteId));
}

export function $isNoteMentionNode(node: LexicalNode | null | undefined): node is NoteMentionNode {
  return node instanceof NoteMentionNode;
}
