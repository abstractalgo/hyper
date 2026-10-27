import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuRenderFn,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { $createTextNode, type TextNode } from "lexical";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useCanvasStore } from "../../store/canvas.ts";
import { $createNoteMentionNode } from "./NoteMentionNode.tsx";

const MAX_OPTIONS = 8;

class NoteOption extends MenuOption {
  constructor(
    readonly noteId: string,
    readonly label: string,
  ) {
    super(noteId);
  }
}

const renderMenu: MenuRenderFn<NoteOption> = (
  anchorElementRef,
  { options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
) => {
  if (!anchorElementRef.current || options.length === 0) return null;
  // Arrow keys / Enter / Escape are handled by Lexical; the buttons are for pointer users.
  return createPortal(
    <ul
      aria-label="Mention a note"
      className="absolute top-6 z-50 w-56 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
    >
      {options.map((option, i) => (
        <li key={option.key} ref={(el) => option.setRefElement(el)}>
          <button
            type="button"
            tabIndex={-1}
            aria-current={selectedIndex === i}
            className="block w-full cursor-pointer truncate px-3 py-1.5 text-left text-gray-800 aria-current:bg-gray-100"
            onMouseEnter={() => setHighlightedIndex(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => selectOptionAndCleanUp(option)}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>,
    anchorElementRef.current,
  );
};

type MentionsPluginProps = {
  /** The note hosting this editor; excluded from suggestions. */
  noteId: string;
};

export function MentionsPlugin({ noteId }: MentionsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  const nodes = useCanvasStore((s) => s.nodes);

  // Titles can contain spaces, so keep matching across whitespace.
  const triggerFn = useBasicTypeaheadTriggerMatch("@", {
    minLength: 0,
    maxLength: 50,
    allowWhitespace: true,
  });

  const options = useMemo(() => {
    const q = query?.toLowerCase() ?? "";
    return nodes
      .filter((n) => n.id !== noteId && n.data.title.toLowerCase().includes(q))
      .slice(0, MAX_OPTIONS)
      .map((n) => new NoteOption(n.id, n.data.title));
  }, [nodes, noteId, query]);

  const onSelectOption = (
    option: NoteOption,
    nodeToReplace: TextNode | null,
    closeMenu: () => void,
  ) => {
    editor.update(() => {
      const mention = $createNoteMentionNode(option.noteId);
      if (nodeToReplace) nodeToReplace.replace(mention);
      const space = $createTextNode(" ");
      mention.insertAfter(space);
      space.select(1, 1);
      closeMenu();
    });
  };

  return (
    <LexicalTypeaheadMenuPlugin<NoteOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={triggerFn}
      options={options}
      menuRenderFn={renderMenu}
    />
  );
}
