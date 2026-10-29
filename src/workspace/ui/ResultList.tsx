import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Keyboard navigation for a search box over a list of results: arrow keys move the highlighted
 * row (wrapping), Enter chooses it. Spread `onKeyDown` onto the input.
 */
export function useListNavigation<T>(items: readonly T[], onChoose: (item: T) => void) {
  const [active, setActive] = useState(0);
  // Results change as the query changes; keep the highlight on a row that exists.
  const current = Math.min(active, Math.max(items.length - 1, 0));
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive(items.length === 0 ? 0 : (current + step + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[current];
      if (item !== undefined) {
        onChoose(item);
      }
    }
  };
  return { active: current, setActive, onKeyDown, reset: () => setActive(0) };
}

type ResultListProps<T> = {
  items: readonly T[];
  getKey: (item: T) => string;
  /** Rows with the same group are listed under that heading (where the group changes). */
  getGroup?: (item: T) => string | undefined;
  active: number;
  setActive: (index: number) => void;
  /** The row's contents (its own buttons); the row itself handles highlighting. */
  renderItem: (item: T, index: number) => ReactNode;
  empty?: ReactNode;
  className?: string;
};

/**
 * The results under a search box: highlights the active row (`aria-current`), follows the mouse,
 * keeps the active row scrolled into view, and shows group headings.
 */
export function ResultList<T>({
  items,
  getKey,
  getGroup,
  active,
  setActive,
  renderItem,
  empty,
  className = "",
}: ResultListProps<T>) {
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <ul ref={listRef} className={className}>
      {items.map((item, i) => {
        const group = getGroup?.(item);
        const newGroup = group !== undefined && (i === 0 || getGroup?.(items[i - 1]!) !== group);
        return (
          <li key={getKey(item)}>
            {newGroup && <p className="px-2 pt-1.5 pb-1 text-xs text-gray-500">{group}</p>}
            <div
              aria-current={active === i}
              onMouseMove={() => active !== i && setActive(i)}
              className="group flex items-center gap-1 rounded aria-current:bg-gray-100"
            >
              {renderItem(item, i)}
            </div>
          </li>
        );
      })}
      {items.length === 0 && empty && <li className="px-2 py-1 text-xs text-gray-400">{empty}</li>}
    </ul>
  );
}
