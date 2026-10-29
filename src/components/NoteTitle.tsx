import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

type NoteTitleProps = {
  title: string;
  onRename: (title: string) => void;
};

export function NoteTitle({ title, onRename }: NoteTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = draft !== null;

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

  return (
    <input
      ref={inputRef}
      aria-label="Note title"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className="nodrag w-full rounded border border-blue-400 bg-white px-1 text-sm font-semibold text-gray-900 outline-none"
    />
  );
}
