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
import { TableView } from "./TableView";

/** What a table view shows: the notes of a type, as rows, and which of their fields as columns. */
export type TableConfig = {
  /** What the view was named; until then it shows what kind of view it is. */
  name?: string;
  /**
   * The type whose notes are the rows (a named one, or the table's own unnamed filter); null
   * until one is picked.
   */
  typeId: TypeId | null;
  /** Fields shown as columns, in order; null shows all the rows' fields. */
  columns: KeyId[] | null;
};

type SerializedTableViewNode = Spread<{ config: TableConfig }, SerializedLexicalNode>;

/**
 * A live table of notes inside a note's text: its rows are the notes of a type, its cells their
 * fields (editing a cell edits the note). Only what to show is saved here, never the data.
 */
export class TableViewNode extends DecoratorNode<JSX.Element> {
  __config: TableConfig;

  static getType(): string {
    return "table-view";
  }

  static clone(node: TableViewNode): TableViewNode {
    return new TableViewNode(node.__config, node.__key);
  }

  static importJSON(serializedNode: SerializedTableViewNode): TableViewNode {
    return $createTableViewNode(serializedNode.config).updateFromJSON(serializedNode);
  }

  constructor(config: TableConfig, key?: NodeKey) {
    super(key);
    this.__config = config;
  }

  updateFromJSON(serializedNode: LexicalUpdateJSON<SerializedTableViewNode>): this {
    return super.updateFromJSON(serializedNode).setConfig(serializedNode.config);
  }

  exportJSON(): SerializedTableViewNode {
    return { ...super.exportJSON(), config: this.getConfig() };
  }

  createDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = "rte-table-view";
    return element;
  }

  updateDOM(): false {
    return false;
  }

  isInline(): false {
    return false;
  }

  getConfig(): TableConfig {
    return this.getLatest().__config;
  }

  setConfig(config: TableConfig): this {
    const writable = this.getWritable();
    writable.__config = config;
    return writable;
  }

  getTextContent(): string {
    return "";
  }

  decorate(): JSX.Element {
    return <TableView nodeKey={this.__key} config={this.__config} />;
  }
}

export function $createTableViewNode(
  config: TableConfig = { typeId: null, columns: null },
): TableViewNode {
  return $applyNodeReplacement(new TableViewNode(config));
}

export const $isTableViewNode = (node: LexicalNode | null | undefined): node is TableViewNode =>
  node instanceof TableViewNode;
