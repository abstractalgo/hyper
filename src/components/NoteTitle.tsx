import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

import { useFlowClasses } from "./canvasView";

type NoteTitleProps = {
  title: string;
  onRename: (title: string) => void;
  /** The input's text style while editing (the title bar's, by default). */
  inputClassName?: string;
};

/** A note's title: double-click to edit it; Enter or leaving saves, Escape cancels. */
export function NoteTitle({
  title,
  onRename,
  inputClassName = "text-sm font-semibold",
}: NoteTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = draft !== null;
  const { noDrag } = useFlowClasses();

  // Select the title once when editing starts, not on every keystroke.
  useLayoutEffect(() => {
    if (isEditing) {
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = () => {
    const next = draft?.trim();
    if (next && next !== title) {
      onRename(next);
    }
    setDraft(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit();
    }
    if (e.key === "Escape") {
      setDraft(null);
    }
  };

  if (draft === null) {
    return (
      <span className="block truncate" onDoubleClick={() => setDraft(title)}>
        {title}
      </span>
    );
  }

  // The input lies over a hidden copy of what's typed, which gives it the title's width: it doesn't
  // change size when editing starts (a table's column would shrink to fit a stretchy input), and it
  // grows as you type. Pulled out by its border and padding, so the text doesn't move either.
  return (
    <span className="-mx-[5px] grid grid-cols-[minmax(0,1fr)]">
      <span
        aria-hidden
        className={`invisible col-start-1 row-start-1 overflow-hidden border px-1 whitespace-pre ${inputClassName}`}
      >
        {draft || " "}
      </span>
      <input
        ref={inputRef}
        aria-label="Note title"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`${noDrag} col-start-1 row-start-1 w-full min-w-0 rounded border border-blue-400 bg-white px-1 text-gray-900 outline-none ${inputClassName}`}
      />
    </span>
  );
}
