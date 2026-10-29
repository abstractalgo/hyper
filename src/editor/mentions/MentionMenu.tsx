import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const GAP = 4;
const VIEWPORT_MARGIN = 8;

/**
 * Viewport rect of the `@query` text being typed, derived from the DOM selection: the caret
 * sits right after the query, and the trigger only matches within a single text node.
 */
function getQueryRect(queryLength: number): { left: number; top: number; bottom: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const caret = selection.getRangeAt(0);
  const range = caret.cloneRange();
  const start = caret.startOffset - (queryLength + 1);
  if (caret.startContainer.nodeType === Node.TEXT_NODE && start >= 0) {
    range.setStart(caret.startContainer, start);
  }
  const bounds = range.getBoundingClientRect();
  const first = range.getClientRects()[0] ?? bounds;
  if (bounds.width === 0 && bounds.height === 0) {
    return null;
  }
  return { left: first.left, top: bounds.top, bottom: bounds.bottom };
}

type MentionMenuProps = {
  /** The text typed after `@`; used to anchor the menu at the `@`. */
  query: string;
  children: ReactNode;
};

/**
 * Floating container for the mention suggestions, positioned in the viewport (it's portaled
 * to `document.body`): left-aligned with the `@`, just below the line, flipping above only
 * when it would run off the bottom of the window.
 *
 * Lexical's built-in anchor flips based on the editor's own bounds, which inside a small note
 * on the canvas makes the menu jump between above and below.
 */
export function MentionMenu({ query, children }: MentionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const place = () => {
      const rect = getQueryRect(query.length);
      const menu = menuRef.current;
      if (!rect || !menu) {
        return;
      }
      const { offsetWidth: width, offsetHeight: height } = menu;
      const fitsBelow = rect.bottom + GAP + height <= window.innerHeight - VIEWPORT_MARGIN;
      const top = fitsBelow
        ? rect.bottom + GAP
        : Math.max(VIEWPORT_MARGIN, rect.top - GAP - height);
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN),
      );
      // Runs after every render (the query and options change as you type), so only update
      // when the position actually moved.
      setStyle((prev) => (prev.top === top && prev.left === left ? prev : { top, left }));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });

  return (
    <div
      ref={menuRef}
      style={style}
      className="fixed z-50 w-64 overflow-hidden rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
    >
      {children}
    </div>
  );
}
