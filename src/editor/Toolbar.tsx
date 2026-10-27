import { $isLinkNode } from "@lexical/link";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, $getNearestNodeOfType, mergeRegister } from "@lexical/utils";
import { Toggle } from "@base-ui/react/toggle";
import { Toolbar as BaseToolbar } from "@base-ui/react/toolbar";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type TextFormatType,
} from "lexical";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { LinkPopover } from "./LinkPopover.tsx";

type BlockType = "paragraph" | HeadingTagType | "quote" | "bullet" | "number" | "check";

const TEXT_FORMATS: { format: TextFormatType; label: string; icon: ReactNode }[] = [
  { format: "bold", label: "Bold", icon: <span className="font-bold">B</span> },
  { format: "italic", label: "Italic", icon: <span className="italic">I</span> },
  { format: "underline", label: "Underline", icon: <span className="underline">U</span> },
  {
    format: "strikethrough",
    label: "Strikethrough",
    icon: <span className="line-through">S</span>,
  },
  { format: "code", label: "Inline code", icon: <span className="font-mono">{"</>"}</span> },
];

const BLOCKS: { type: BlockType; label: string; icon: string }[] = [
  { type: "h1", label: "Heading 1", icon: "H1" },
  { type: "h2", label: "Heading 2", icon: "H2" },
  { type: "quote", label: "Quote", icon: "❝" },
  { type: "bullet", label: "Bulleted list", icon: "•" },
  { type: "number", label: "Numbered list", icon: "1." },
  { type: "check", label: "Checklist", icon: "☑" },
];

const buttonClass =
  "flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs text-gray-700 select-none hover:not-data-disabled:bg-gray-100 data-pressed:bg-gray-900 data-pressed:text-white data-disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-blue-600";

// Keep focus (and the selection) in the editor when clicking toolbar buttons.
const keepEditorFocus = (e: React.MouseEvent) => e.preventDefault();

export function Toolbar() {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState<Set<TextFormatType>>(new Set());
  const [blockType, setBlockType] = useState<BlockType>("paragraph");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;

    setFormats(new Set(TEXT_FORMATS.map((f) => f.format).filter((f) => selection.hasFormat(f))));

    const anchor = selection.anchor.getNode();
    const link = $findMatchingParent(anchor, $isLinkNode);
    setLinkUrl(link ? link.getURL() : null);

    const block =
      anchor.getKey() === "root"
        ? anchor
        : ($findMatchingParent(anchor, (n) => {
            const parent = n.getParent();
            return parent !== null && $isRootOrShadowRoot(parent);
          }) ?? anchor.getTopLevelElementOrThrow());

    if ($isListNode(block)) {
      const list = $getNearestNodeOfType(anchor, ListNode) ?? block;
      setBlockType(list.getListType());
    } else if ($isHeadingNode(block)) {
      setBlockType(block.getTag());
    } else {
      const type = block.getType();
      setBlockType(type === "quote" ? "quote" : "paragraph");
    }
  }, []);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) => {
          editorState.read($updateToolbar);
        }),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            $updateToolbar();
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW,
        ),
      ),
    [editor, $updateToolbar],
  );

  const toggleBlock = (type: BlockType) => {
    const next = blockType === type ? "paragraph" : type;
    if (next === "bullet") {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (next === "number") {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }
    if (next === "check") {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      return;
    }
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $setBlocksType(selection, () => {
        if (next === "quote") return $createQuoteNode();
        if (next === "paragraph") return $createParagraphNode();
        return $createHeadingNode(next);
      });
    });
  };

  return (
    <BaseToolbar.Root className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 px-1.5 py-1">
      <BaseToolbar.Group className="flex gap-0.5" aria-label="History">
        <BaseToolbar.Button
          className={buttonClass}
          aria-label="Undo"
          disabled={!canUndo}
          onMouseDown={keepEditorFocus}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
        >
          ↶
        </BaseToolbar.Button>
        <BaseToolbar.Button
          className={buttonClass}
          aria-label="Redo"
          disabled={!canRedo}
          onMouseDown={keepEditorFocus}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
        >
          ↷
        </BaseToolbar.Button>
      </BaseToolbar.Group>
      <BaseToolbar.Separator className="mx-1 h-4 w-px bg-gray-200" />
      <BaseToolbar.Group className="flex gap-0.5" aria-label="Text format">
        {TEXT_FORMATS.map(({ format, label, icon }) => (
          <BaseToolbar.Button
            key={format}
            render={<Toggle pressed={formats.has(format)} />}
            className={buttonClass}
            aria-label={label}
            onMouseDown={keepEditorFocus}
            onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
          >
            {icon}
          </BaseToolbar.Button>
        ))}
        <LinkPopover className={buttonClass} activeUrl={linkUrl} />
      </BaseToolbar.Group>
      <BaseToolbar.Separator className="mx-1 h-4 w-px bg-gray-200" />
      <BaseToolbar.Group className="flex gap-0.5" aria-label="Block type">
        {BLOCKS.map(({ type, label, icon }) => (
          <BaseToolbar.Button
            key={type}
            render={<Toggle pressed={blockType === type} />}
            className={buttonClass}
            aria-label={label}
            onMouseDown={keepEditorFocus}
            onClick={() => toggleBlock(type)}
          >
            {icon}
          </BaseToolbar.Button>
        ))}
      </BaseToolbar.Group>
    </BaseToolbar.Root>
  );
}
