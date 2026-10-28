import type { EditorThemeClasses } from "lexical";

export const editorTheme: EditorThemeClasses = {
  paragraph: "rte-paragraph",
  quote: "rte-quote",
  heading: {
    h1: "rte-h1",
    h2: "rte-h2",
    h3: "rte-h3",
  },
  list: {
    ul: "rte-ul",
    ol: "rte-ol",
    checklist: "rte-checklist",
    listitem: "rte-listitem",
    listitemChecked: "rte-listitem-checked",
    listitemUnchecked: "rte-listitem-unchecked",
    nested: { listitem: "rte-nested-listitem" },
  },
  link: "rte-link",
  text: {
    bold: "rte-bold",
    italic: "rte-italic",
    underline: "rte-underline",
    strikethrough: "rte-strikethrough",
    underlineStrikethrough: "rte-underline-strikethrough",
    code: "rte-code",
  },
};
