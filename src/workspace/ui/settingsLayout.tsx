import { PlusIcon } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

export const textInputClass =
  "h-8 w-full rounded border border-gray-300 px-2 text-sm outline-none focus:border-blue-500";
const dangerButtonClass = "h-8 rounded-md px-3 text-sm text-red-600 hover:bg-red-50";

export type ListItem = { id: string; label: string; detail?: string; icon?: ReactNode };

/** Left column of a settings tab: selectable list plus "add" buttons. */
function ListPane({
  items,
  selectedId,
  onSelect,
  actions,
}: {
  items: ListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  actions: { label: string; onClick: () => void }[];
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
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          className="mx-1 mb-1 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <PlusIcon className="size-4" />
          {action.label}
        </button>
      ))}
    </div>
  );
}

function EditorPane({ children }: { children: ReactNode }) {
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

/** Validation messages under a settings form. */
export function FormErrors({ errors }: { errors: readonly string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="text-xs text-red-600">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

/** The red delete button at the bottom of a settings form. */
export function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="pt-1">
      <button type="button" onClick={onClick} className={dangerButtonClass}>
        {label}
      </button>
    </div>
  );
}

/** What a settings form gets: the item to edit and how to report saving or deleting it. */
export type ItemFormProps<T> = {
  initial: T;
  /** Not saved yet: it is saved (and listed) once valid. */
  isNew: boolean;
  onSaved: (item: T) => void;
  onDeleted: () => void;
};

/**
 * A settings tab: a list of items on the left, and a form for the selected (or a new) item on the
 * right. Owns which item is selected and the new, not-yet-saved item.
 */
export function SettingsCollection<T extends { id: string }>({
  items,
  toListItem,
  actions,
  Form,
  emptyText,
}: {
  items: readonly T[];
  toListItem: (item: T) => ListItem;
  /** "New …" buttons, each making a blank item to fill in. */
  actions: { label: string; create: () => T }[];
  /** The form for one item; remounted (fresh draft) whenever another item is selected. */
  Form: ComponentType<ItemFormProps<T>>;
  emptyText: ReactNode;
}) {
  const [draft, setDraft] = useState<T | null>(items[0] ?? null);
  const select = (item: T) => setDraft(item);
  const saved = draft !== null && items.some((i) => i.id === draft.id);

  return (
    <div className="flex min-h-0 flex-1">
      <ListPane
        items={items.map(toListItem)}
        selectedId={saved ? draft.id : null}
        onSelect={(id) => select(items.find((i) => i.id === id)!)}
        actions={actions.map(({ label, create }) => ({ label, onClick: () => setDraft(create()) }))}
      />
      <EditorPane>
        {draft ? (
          <Form
            key={draft.id}
            initial={draft}
            isNew={!saved}
            onSaved={select}
            onDeleted={() => setDraft(null)}
          />
        ) : (
          <p className="text-sm text-gray-500">{emptyText}</p>
        )}
      </EditorPane>
    </div>
  );
}
