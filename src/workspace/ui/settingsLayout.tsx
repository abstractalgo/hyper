import { PlusIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

export const textInputClass =
  "h-8 w-full rounded border border-gray-300 px-2 text-sm outline-none focus:border-blue-500";
export const dangerButtonClass = "h-8 rounded-md px-3 text-sm text-red-600 hover:bg-red-50";

type ListItem = { id: string; label: string; detail?: string; icon?: ReactNode };

/** Left column of a settings tab: selectable list plus an "add" button. */
export function ListPane({
  items,
  selectedId,
  onSelect,
  addLabel,
  onAdd,
}: {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-gray-200">
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={item.id === selectedId}
              onClick={() => onSelect(item.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-gray-50 aria-current:bg-gray-100"
            >
              {item.icon}
              <span className="min-w-0">
                <span className="block truncate text-sm text-gray-900">{item.label}</span>
                {item.detail && (
                  <span className="block truncate text-xs text-gray-500">{item.detail}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAdd}
        className="m-1 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        <PlusIcon className="size-4" />
        {addLabel}
      </button>
    </div>
  );
}

export function EditorPane({ children }: { children: ReactNode }) {
  return <div className="min-w-0 flex-1 overflow-y-auto p-4">{children}</div>;
}

export function FormRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3">
      <span className="pt-1.5 text-sm text-gray-600">{label}</span>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

/**
 * Saves `draft` whenever it changes and is valid; settings forms have no Save button. The draft
 * as first loaded isn't saved (nothing changed yet).
 */
export function useAutoSave<T>(draft: T, valid: boolean, save: (draft: T) => void) {
  const initial = useRef(draft);
  // Latest values, read by the effect so it only re-runs when the draft itself changes.
  const latest = useRef({ valid, save });
  useLayoutEffect(() => {
    latest.current = { valid, save };
  });
  useEffect(() => {
    if (draft !== initial.current && latest.current.valid) latest.current.save(draft);
  }, [draft]);
}
