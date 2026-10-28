import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  HEADING,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type TextMatchTransformer,
  type Transformer,
} from "@lexical/markdown";
import { $isParagraphNode, $isRootNode } from "lexical";

import {
  $createEquationNode,
  $editEquation,
  $isEquationNode,
  EquationNode,
} from "./equations/EquationNode";

/**
 * `$$ ` starts editing a new equation: a display equation when typed on an empty line, otherwise
 * an inline one.
 */
const EQUATION: TextMatchTransformer = {
  dependencies: [EquationNode],
  export: (node) => {
    if (!$isEquationNode(node)) return null;
    return node.isInline() ? `$${node.getEquation()}$` : `$$${node.getEquation()}$$`;
  },
  regExp: /\$\$ $/,
  trigger: " ",
  replace: (textNode) => {
    const parent = textNode.getParent();
    const onEmptyLine =
      $isParagraphNode(parent) && $isRootNode(parent.getParent()) && parent.getChildrenSize() === 1;
    const equation = $createEquationNode("", !onEmptyLine);
    if (onEmptyLine) parent.replace(equation);
    else textNode.replace(equation);
    $editEquation(equation, "end");
  },
  type: "text-match",
};

/**
 * Markdown shortcuts (e.g. `- `, `1. `, `[] `, `# `, `> `, `**bold**`).
 * Only transformers whose nodes are registered in the editor: the default set
 * includes CODE, which needs CodeNode. CHECK_LIST must come before UNORDERED_LIST
 * so `- [ ] ` isn't swallowed as a bullet.
 */
export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  CHECK_LIST,
  UNORDERED_LIST,
  ORDERED_LIST,
  INLINE_CODE,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  LINK,
  EQUATION,
];
