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
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { HISTORIC_TAG, type EditorState, type LexicalEditor } from "lexical";
import { useEffect, useRef, useState } from "react";

import { fixChecklistZoom } from "./checklistZoom";
import { EquationsPlugin } from "./equations/EquationsPlugin";
import { MARKDOWN_TRANSFORMERS } from "./markdown";
import { MentionsPlugin } from "./mentions/MentionsPlugin";
import { EDITOR_NODES } from "./nodes";
import { editorTheme } from "./theme";
import { AUTO_LINK_MATCHERS, isSafeUrl } from "./url";

type RichTextEditorProps = {
  /** ID of the note this editor belongs to. */
  noteId: string;
  /**
   * The note's serialized editor state. The editor starts from it, and loads it again when it
   * changes elsewhere (the same note in another view).
   */
  content: string | null;
  onChange: (serialized: string) => void;
  placeholder?: string;
};

export function RichTextEditor({
  noteId,
  content,
  onChange,
  placeholder = "Start typing…",
}: RichTextEditorProps) {
  // Lexical owns its state after mount; freeze the initial config so re-renders don't reset it.
  const [initialConfig] = useState<InitialConfigType>(() => ({
    namespace: `note-${noteId}`,
    theme: editorTheme,
    nodes: EDITOR_NODES,
    editorState: content ?? undefined,
    onError: (error) => {
      console.error(error);
    },
  }));

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => fixChecklistZoom(containerRef.current!), []);

  // What the store has for this note as far as this editor knows: what it saved, or loaded.
  const known = useRef(content);
  // When the note's text changes elsewhere (the same note in another view, e.g. a canvas inside a
  // note), load it here. Not undoable here: it's not this editor's edit.
  const editorRef = useRef<LexicalEditor>(null);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || content === null || content === known.current) {
      return;
    }
    known.current = content;
    editor.setEditorState(editor.parseEditorState(content), { tag: HISTORIC_TAG });
  }, [content]);
  const handleChange = (editorState: EditorState) => {
    const serialized = JSON.stringify(editorState.toJSON());
    // Loading text saved elsewhere changes the editor too; that isn't new.
    if (serialized !== known.current) {
      known.current = serialized;
      onChange(serialized);
    }
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div ref={containerRef} className="relative">
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
      <EquationsPlugin />
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  );
}
