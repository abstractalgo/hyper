import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Popover } from "@base-ui/react/popover";
import { Toolbar } from "@base-ui/react/toolbar";
import { $findMatchingParent } from "@lexical/utils";
import { $getSelection, $isRangeSelection, $setSelection, type BaseSelection } from "lexical";
import { useRef, useState, type FormEvent } from "react";

import { normalizeUrl } from "./url.ts";

type LinkPopoverProps = {
  className: string;
  /** URL of the link at the current selection, or null when the selection isn't in a link. */
  activeUrl: string | null;
};

export function LinkPopover({ className, activeUrl }: LinkPopoverProps) {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);
  // Focus moves into the popover input, so remember where the editor selection was.
  const savedSelection = useRef<BaseSelection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      savedSelection.current = editor.getEditorState().read(() => $getSelection()?.clone() ?? null);
      setValue(activeUrl ?? "");
      setInvalid(false);
    }
    setOpen(next);
  };

  const applyLink = (url: string | null) => {
    editor.update(() => {
      if (savedSelection.current) $setSelection(savedSelection.current.clone());
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      // A collapsed caret inside a link edits/removes that whole link.
      if (selection.isCollapsed()) {
        const link = $findMatchingParent(selection.anchor.getNode(), $isLinkNode);
        if (!link) return;
        selection.anchor.set(link.getKey(), 0, "element");
        selection.focus.set(link.getKey(), link.getChildrenSize(), "element");
      }
    });
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    setOpen(false);
    editor.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(value);
    if (!url) {
      setInvalid(true);
      return;
    }
    applyLink(url);
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Toolbar.Button
        render={<Popover.Trigger />}
        className={className}
        aria-label="Link"
        aria-pressed={activeUrl !== null}
        data-pressed={activeUrl !== null ? "" : undefined}
        onMouseDown={(e) => e.preventDefault()}
      >
        🔗
      </Toolbar.Button>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start">
          <Popover.Popup
            initialFocus={inputRef}
            className="w-72 rounded-md border border-gray-200 bg-white p-2 shadow-lg outline-none"
          >
            <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
              <input
                type="text"
                ref={inputRef}
                placeholder="https://example.com"
                aria-label="URL"
                aria-invalid={invalid}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setInvalid(false);
                }}
                className="h-8 rounded border border-gray-300 px-2 text-sm outline-none focus:border-blue-500 aria-invalid:border-red-500"
              />
              {invalid && (
                <p className="text-xs text-red-600">Enter a valid http(s) or mailto URL.</p>
              )}
              <div className="flex justify-end gap-1">
                {activeUrl !== null && (
                  <button
                    type="button"
                    onClick={() => applyLink(null)}
                    className="h-7 rounded px-2 text-xs text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="submit"
                  className="h-7 rounded bg-gray-900 px-2 text-xs font-medium text-white hover:bg-gray-700"
                >
                  {activeUrl !== null ? "Update" : "Apply"}
                </button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
