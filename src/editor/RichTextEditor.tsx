import { LexicalComposer, type InitialConfigType } from "@lexical/react/LexicalComposer";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { ClickableLinkPlugin } from "@lexical/react/LexicalClickableLinkPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TabIndentationPlugin } from "@lexical/react/LexicalTabIndentationPlugin";
import type { EditorState } from "lexical";
import { useState } from "react";

import { MARKDOWN_TRANSFORMERS } from "./markdown";
import { MentionsPlugin } from "./mentions/MentionsPlugin";
import { EDITOR_NODES } from "./nodes";
import { editorTheme } from "./theme";
import { AUTO_LINK_MATCHERS, isSafeUrl } from "./url";

type RichTextEditorProps = {
  /** ID of the note this editor belongs to. */
  noteId: string;
  /** Serialized editor state to start from. Only read on mount. */
  initialContent: string | null;
  onChange: (serialized: string) => void;
  placeholder?: string;
};

export function RichTextEditor({
  noteId,
  initialContent,
  onChange,
  placeholder = "Start typing…",
}: RichTextEditorProps) {
  // Lexical owns its state after mount; freeze the initial config so re-renders don't reset it.
  const [initialConfig] = useState<InitialConfigType>(() => ({
    namespace: `note-${noteId}`,
    theme: editorTheme,
    nodes: EDITOR_NODES,
    editorState: initialContent ?? undefined,
    onError: (error) => {
      console.error(error);
    },
  }));

  const handleChange = (editorState: EditorState) => {
    onChange(JSON.stringify(editorState.toJSON()));
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="px-3 pt-2 pb-3.5 text-sm text-gray-900 outline-none"
              aria-placeholder={placeholder}
              placeholder={<div className="rte-placeholder">{placeholder}</div>}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      <HistoryPlugin />
      <ListPlugin />
      <CheckListPlugin />
      {/* Tab / Shift+Tab nests and un-nests list items */}
      <TabIndentationPlugin maxIndent={6} />
      <LinkPlugin
        validateUrl={isSafeUrl}
        attributes={{ target: "_blank", rel: "noopener noreferrer" }}
      />
      <AutoLinkPlugin matchers={AUTO_LINK_MATCHERS} />
      <ClickableLinkPlugin newTab />
      <MentionsPlugin noteId={noteId} />
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
    </LexicalComposer>
  );
}
