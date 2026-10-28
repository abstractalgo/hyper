import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuRenderFn,
  type TriggerFn,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { go as fuzzySearch, highlight as fuzzyHighlight } from "fuzzysort";
import { $createTextNode, type TextNode } from "lexical";
import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useCanvasStore, type EditorNode } from "../../store/canvas.ts";
import { NoteIcon } from "../../workspace/icons.tsx";
import { MentionMenu } from "./MentionMenu.tsx";
import { $createNoteMentionNode } from "./NoteMentionNode.tsx";

const MAX_MATCHES = 8;
const MAX_QUERY_LENGTH = 75;

/**
 * `@` at the start of the text or after whitespace/`(`, followed by anything on the same line:
 * titles can contain spaces, dashes and other punctuation. A space straight after `@`, or two
 * spaces in a row, ends mention mode.
 */
const MENTION_REGEX = new RegExp(`(^|\\s|\\()@([^\\n@]{0,${MAX_QUERY_LENGTH}})$`);

const mentionTrigger: TriggerFn = (text) => {
  const match = MENTION_REGEX.exec(text);
  if (!match) return null;
  const [, lead = "", query = ""] = match;
  if (/^\s|\s{2}/.test(query)) return null;
  return {
    leadOffset: match.index + lead.length,
    matchingString: query,
    replaceableString: `@${query}`,
  };
};

/** A stable empty list for the closed menu's store selector. */
const NO_NOTES: EditorNode[] = [];

class NoteOption extends MenuOption {
  constructor(
    readonly noteId: string,
    readonly label: ReactNode,
  ) {
    super(noteId);
  }
}

class CreateNoteOption extends MenuOption {
  constructor(readonly noteTitle: string) {
    super("create-note");
  }
}

type MentionOption = NoteOption | CreateNoteOption;

const renderMatch = (match: string, i: number) => (
  <span key={i} className="font-semibold text-blue-700">
    {match}
  </span>
);

const renderMenu: MenuRenderFn<MentionOption> = (
  anchorElementRef,
  { options, selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
  query,
) => {
  if (!anchorElementRef.current || options.length === 0) return null;
  // Arrow keys / Enter / Escape are handled by Lexical; the buttons are for pointer users.
  // Portaled to <body> and positioned by MentionMenu rather than Lexical's anchor element.
  return createPortal(
    <MentionMenu query={query}>
      <ul aria-label="Mention a note">
        {options.map((option, i) => (
          <li key={option.key} ref={(el) => option.setRefElement(el)}>
            <button
              type="button"
              tabIndex={-1}
              aria-current={selectedIndex === i}
              className={`block w-full cursor-pointer truncate px-3 py-1.5 text-left text-gray-800 aria-current:bg-gray-100 ${
                option instanceof CreateNoteOption ? "border-t border-gray-100 text-gray-600" : ""
              }`}
              onMouseEnter={() => setHighlightedIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectOptionAndCleanUp(option)}
            >
              {option instanceof CreateNoteOption ? (
                <>
                  <span className="mr-1 text-gray-400">+</span>
                  Create “<span className="font-medium text-gray-900">{option.noteTitle}</span>”
                </>
              ) : (
                <>
                  <NoteIcon
                    noteId={option.noteId}
                    className="mr-1.5 inline-block size-3.5 align-[-0.15em]"
                  />
                  {option.label}
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </MentionMenu>,
    document.body,
  );
};

type MentionsPluginProps = {
  /** The note hosting this editor; excluded from suggestions and used to place new notes. */
  noteId: string;
};

export function MentionsPlugin({ noteId }: MentionsPluginProps) {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);
  // Only read while the @ menu is open: subscribing to every note would re-render each note's
  // editor on every drag frame.
  const nodes = useCanvasStore((s) => (query === null ? NO_NOTES : s.nodes));
  const createNoteBeside = useCanvasStore((s) => s.createNoteBeside);

  const options = useMemo((): MentionOption[] => {
    if (query === null) return [];
    const others = nodes.filter((n) => n.id !== noteId);
    const search = query.trim();
    if (!search) {
      return others.slice(0, MAX_MATCHES).map((n) => new NoteOption(n.id, n.data.title));
    }

    const matches = fuzzySearch(search, others, {
      key: (n) => n.data.title,
      limit: MAX_MATCHES,
      threshold: 0,
    }).map((r) => new NoteOption(r.obj.id, fuzzyHighlight(r, renderMatch)));
    // Offer to create a note unless one (other than this one) already has exactly this title.
    const exists = nodes.some((n) => n.data.title.toLowerCase() === search.toLowerCase());
    return exists ? matches : [...matches, new CreateNoteOption(search)];
  }, [nodes, noteId, query]);

  const onSelectOption = (
    option: MentionOption,
    nodeToReplace: TextNode | null,
    closeMenu: () => void,
  ) => {
    const targetId =
      option instanceof CreateNoteOption
        ? createNoteBeside(noteId, option.noteTitle)
        : option.noteId;
    editor.update(() => {
      const mention = $createNoteMentionNode(targetId);
      if (nodeToReplace) nodeToReplace.replace(mention);
      const space = $createTextNode(" ");
      mention.insertAfter(space);
      space.select(1, 1);
      closeMenu();
    });
  };

  return (
    <LexicalTypeaheadMenuPlugin<MentionOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      triggerFn={mentionTrigger}
      options={options}
      menuRenderFn={renderMenu}
    />
  );
}
