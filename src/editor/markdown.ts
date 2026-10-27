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
  type Transformer,
} from "@lexical/markdown";

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
];
