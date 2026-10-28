import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { Klass, LexicalNode } from "lexical";

import { EquationNode } from "./equations/EquationNode";
import { NoteMentionNode } from "./mentions/NoteMentionNode";

/** Every node type a note can contain. Shared by the live editor and headless tooling. */
export const EDITOR_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  NoteMentionNode,
  EquationNode,
];
