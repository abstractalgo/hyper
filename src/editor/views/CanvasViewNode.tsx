import {
  $applyNodeReplacement,
  DecoratorNode,
  type LexicalNode,
  type LexicalUpdateJSON,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from "lexical";
import type { JSX } from "react";

import type { Layout } from "../../store/canvas";
import type { TypeId } from "../../workspace/typeSystem";
import { CanvasView } from "./CanvasView";

/** What a canvas view shows: the notes of a type, and where it places them. */
export type CanvasConfig = {
  /** What the view was named; until then it shows what kind of view it is. */
  name?: string;
  /**
   * The type whose notes are shown (a named one, or the canvas's own unnamed filter); null until
   * one is picked.
   */
  typeId: TypeId | null;
  /** Where this canvas places its notes (notes it doesn't place yet go on a grid). */
  layout: Layout;
};

type SerializedCanvasViewNode = Spread<{ config: CanvasConfig }, SerializedLexicalNode>;

/**
 * A canvas inside a note's text: the notes of a type, as full notes (editable, with their own
 * views), placed in a layout of its own. Only what to show and where is saved here, never the
 * notes themselves: they're the same notes as everywhere else.
 */
export class CanvasViewNode extends DecoratorNode<JSX.Element> {
  __config: CanvasConfig;

  static getType(): string {
    return "canvas-view";
  }

  static clone(node: CanvasViewNode): CanvasViewNode {
    return new CanvasViewNode(node.__config, node.__key);
  }

  static importJSON(serializedNode: SerializedCanvasViewNode): CanvasViewNode {
    return $createCanvasViewNode(serializedNode.config).updateFromJSON(serializedNode);
  }

  constructor(config: CanvasConfig, key?: NodeKey) {
    super(key);
    this.__config = config;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedCanvasViewNode>): this {
    return super.updateFromJSON(serializedNode).setConfig(serializedNode.config);
  }

  exportJSON(): SerializedCanvasViewNode {
    return { ...super.exportJSON(), config: this.getConfig() };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = "rte-canvas-view";
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getConfig(): CanvasConfig {
    return this.getLatest().__config;
  }

  setConfig(config: CanvasConfig): this {
    const writable = this.getWritable();
    writable.__config = config;
    return writable;
  }

  getTextContent(): string {
    return "";
  }

  decorate(): JSX.Element {
    return <CanvasView nodeKey={this.__key} config={this.__config} />;
  }
}

export function $createCanvasViewNode(
  config: CanvasConfig = { typeId: null, layout: {} },
): CanvasViewNode {
  return $applyNodeReplacement(new CanvasViewNode(config));
}

export const $isCanvasViewNode = (node: LexicalNode | null | undefined): node is CanvasViewNode =>
  node instanceof CanvasViewNode;
