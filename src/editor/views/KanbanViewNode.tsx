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

import type { KeyId, TypeId } from "../../workspace/typeSystem";
import { KanbanView } from "./KanbanView";

/** What a kanban shows: the notes of a type, as cards, in a column per value of a field. */
export type KanbanConfig = {
  /** What the view was named; until then it shows what kind of view it is. */
  name?: string;
  /**
   * The type whose notes are the cards (a named one, or the kanban's own unnamed filter); null
   * until one is picked.
   */
  typeId: TypeId | null;
  /** The field whose values are the columns (one holding a single note, like Status); null picks the first. */
  groupBy: KeyId | null;
};

type SerializedKanbanViewNode = Spread<{ config: KanbanConfig }, SerializedLexicalNode>;

/**
 * A live kanban inside a note's text: the notes of a type as cards, in a column per value of one
 * of their fields (moving a card sets it). Only what to show is saved here, never the data.
 */
export class KanbanViewNode extends DecoratorNode<JSX.Element> {
  __config: KanbanConfig;

  static getType(): string {
    return "kanban-view";
  }

  static clone(node: KanbanViewNode): KanbanViewNode {
    return new KanbanViewNode(node.__config, node.__key);
  }

  static importJSON(serializedNode: SerializedKanbanViewNode): KanbanViewNode {
    return $createKanbanViewNode(serializedNode.config).updateFromJSON(serializedNode);
  }

  constructor(config: KanbanConfig, key?: NodeKey) {
    super(key);
    this.__config = config;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedKanbanViewNode>): this {
    return super.updateFromJSON(serializedNode).setConfig(serializedNode.config);
  }

  exportJSON(): SerializedKanbanViewNode {
    return { ...super.exportJSON(), config: this.getConfig() };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = "rte-kanban-view";
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getConfig(): KanbanConfig {
    return this.getLatest().__config;
  }

  setConfig(config: KanbanConfig): this {
    const writable = this.getWritable();
    writable.__config = config;
    return writable;
  }

  getTextContent(): string {
    return "";
  }

  decorate(): JSX.Element {
    return <KanbanView nodeKey={this.__key} config={this.__config} />;
  }
}

export function $createKanbanViewNode(
  config: KanbanConfig = { typeId: null, groupBy: null },
): KanbanViewNode {
  return $applyNodeReplacement(new KanbanViewNode(config));
}

export const $isKanbanViewNode = (node: LexicalNode | null | undefined): node is KanbanViewNode =>
  node instanceof KanbanViewNode;
