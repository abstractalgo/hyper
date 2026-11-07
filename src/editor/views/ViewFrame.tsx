import { Menu } from "@base-ui/react/menu";
import {
  BookmarkPlusIcon,
  CheckIcon,
  ChevronRightIcon,
  DatabaseIcon,
  ListFilterIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react";
import { useContext, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createNodeSelection, $setSelection, type NodeKey } from "lexical";

import { AncestorsContext, useFlowClasses } from "../../components/canvasView";
import { NoteTitle } from "../../components/NoteTitle";
import { newId, useCanvasStore } from "../../store/canvas";
import { TypeIcon } from "../../workspace/icons";
import {
  declarations,
  entriesOfTypes,
  ICON_KEY,
  isUnnamed,
  members,
  NOTE_TYPE_ID,
  TYPE_KEY,
  type Entry,
  type TypeExpr,
  type TypeId,
} from "../../workspace/typeSystem";
import {
  POPUP_CLASS,
  POSITIONER_CLASS,
  PopupContainerContext,
  useViewportPortal,
} from "../../workspace/ui/popups";
import { TypeBuilder } from "../../workspace/ui/TypeBuilder";
import { useIsNodeSelected } from "../useIsNodeSelected";

/** A field the rows have, as its declaration (label, icon, what its values are). */
export type RowField = Entry & { decl: NonNullable<Entry["decl"]> };

type Group = Extract<TypeExpr, { kind: "group" }>;

export const menuItemClass =
  "flex cursor-pointer items-center gap-2 py-1 pr-3 pl-2 text-xs outline-none select-none data-highlighted:bg-gray-100";
const toolButtonClass =
  "flex h-7 items-center gap-1 rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 data-popup-open:bg-gray-100";

const NO_IDS: string[] = [];

/** The note a view is in: what `this` is in the types it shows. */
export function useViewSelf(): string | null {
  return useContext(AncestorsContext).at(-1) ?? null;
}

/** IDs of the notes of `typeId`. Re-renders only when they change, not on every board change. */
export function useRowIds(typeId: TypeId | null): string[] {
  const self = useViewSelf();
  return useCanvasStore(
    useShallow((s) =>
      typeId
        ? members({ kind: "ref", typeId }, { nodes: s.notes, types: s.types, self }).map(
            (n) => n.id,
          )
        : NO_IDS,
    ),
  );
}

/** The fields of the rows' types (Type and Icon aside), in their types' order. */
export function useRowFields(rowIds: string[]): RowField[] {
  const types = useCanvasStore((s) => s.types);
  const rowTypeIds = useCanvasStore(
    useShallow((s) => [
      ...new Set(
        s.notes
          .filter((n) => rowIds.includes(n.id))
          .flatMap((n) => (n.data.fields[TYPE_KEY] ?? []).map(String)),
      ),
    ]),
  );
  return useMemo(() => {
    const declared = declarations(types);
    const keys = new Set(entriesOfTypes(rowTypeIds, types).map((e) => e.key));
    keys.delete(TYPE_KEY);
    keys.delete(ICON_KEY);
    return [...keys].flatMap((key) => {
      const field = declared.get(key);
      return field?.decl ? [field as RowField] : [];
    });
  }, [rowTypeIds, types]);
}

/**
 * A view of notes inside a note's text (a table, a kanban…): an island Lexical doesn't edit and
 * that doesn't drag the note. Wheeling over it pans and zooms the canvas the note is on, except
 * over a canvas view's own canvas, which pans and zooms itself. Its toolbar picks the notes, of a
 * named type or of the view's own filter (an unnamed type, edited here; naming it makes it a
 * collection like any other), and has the view's own `tools`; then the view itself, once there
 * are notes.
 */
export function ViewFrame({
  nodeKey,
  Icon,
  label,
  name,
  onRename,
  typeId,
  setTypeId,
  count,
  tools,
  children,
}: {
  /** The view's node in its note's text. */
  nodeKey: NodeKey;
  Icon: LucideIcon;
  /** What kind of view it is, e.g. "Table": its name until it's given one. */
  label: string;
  /** The name it was given, if any. */
  name: string | undefined;
  onRename: (name: string) => void;
  typeId: TypeId | null;
  setTypeId: (typeId: TypeId) => void;
  count: number;
  tools?: ReactNode;
  children: ReactNode;
}) {
  const viewportPortal = useViewportPortal();
  const [editor] = useLexicalComposerContext();
  const selected = useIsNodeSelected(editor, nodeKey);
  const types = useCanvasStore((s) => s.types);
  const saveType = useCanvasStore((s) => s.saveType);
  const deleteType = useCanvasStore((s) => s.deleteType);
  const own = types.find((t) => t.id === typeId && isUnnamed(t));
  const filter: Group | null = own
    ? own.expr.kind === "group"
      ? own.expr
      : { kind: "group", mode: "all", of: [own.expr] }
    : null;
  // A new filter starts open; an existing one opens from the toolbar.
  const [filterOpen, setFilterOpen] = useState(false);
  const { noDrag } = useFlowClasses();

  // An own filter goes with the view: it's deleted once the view shows something else.
  const dropOwn = () => {
    if (own) {
      deleteType(own.id);
    }
  };
  const pickRows = (value: string | null) => {
    if (value === null) {
      // Narrowing what's shown: the filter starts from the type picked so far.
      const id = newId();
      const of: TypeExpr[] = typeId ? [{ kind: "ref", typeId }] : [];
      saveType({
        id,
        name: "",
        icon: "list-filter",
        color: "gray",
        expr: { kind: "group", mode: "all", of },
      });
      setTypeId(id);
      setFilterOpen(true);
    } else if (value !== typeId) {
      dropOwn();
      setTypeId(value);
    }
  };
  // Naming the filter makes it a collection like any other (and no longer just this view's).
  const nameFilter = () => {
    const collectionName = window.prompt("Name the new collection:")?.trim();
    if (own && collectionName) {
      saveType({ ...own, name: collectionName });
      setFilterOpen(false);
    }
  };

  // Clicking the header (not its buttons) selects the view in its note's text, as moving the
  // caret onto it does: Backspace or Delete then removes it.
  const select = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest("button, input")) {
      return;
    }
    editor.getRootElement()?.focus({ preventScroll: true });
    editor.update(() => {
      const selection = $createNodeSelection();
      selection.add(nodeKey);
      $setSelection(selection);
    });
  };

  return (
    <PopupContainerContext.Provider value={viewportPortal}>
      <div
        contentEditable={false}
        className={`${noDrag} my-2 rounded-md border transition-colors duration-150 ${selected ? "border-[color-mix(in_oklab,var(--color-gray-200),var(--color-blue-400)_30%)]" : "border-gray-200"}`}
      >
        {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the keyboard gets here by moving the caret onto the view */}
        <div
          onClick={select}
          // Rounded like the frame (inside its border), or its corners would cover the frame's.
          className="flex flex-wrap items-center gap-1 rounded-t-[calc(var(--radius-md)-1px)] border-b border-gray-200 bg-gray-50 px-1.5 py-1 whitespace-nowrap"
        >
          <Icon className="size-3.5 shrink-0 text-gray-500" />
          {/* Renamed like a note's title: double-click. */}
          <div className="min-w-0 text-xs font-medium text-gray-700">
            <NoteTitle title={name ?? label} onRename={onRename} inputClassName="text-xs" />
          </div>
          {/* The view's actions show while the pointer is over the view (this one: its toolbar's
              parent, not a view around it), or while they're in use: a menu or the filter open,
              keyboard focus. */}
          <div className="ml-auto flex items-center opacity-0 transition-opacity duration-150 has-aria-pressed:opacity-100 has-data-popup-open:opacity-100 has-focus-visible:opacity-100 [:hover>*>&]:opacity-100">
            <SourceMenu
              typeId={typeId}
              own={own !== undefined}
              onPick={pickRows}
              onSave={nameFilter}
              container={viewportPortal}
            />
            {filter && (
              <button
                type="button"
                aria-pressed={filterOpen}
                onClick={() => setFilterOpen((o) => !o)}
                className={`${toolButtonClass} aria-pressed:bg-gray-100`}
              >
                <ListFilterIcon className="size-3.5" />
                Filter
              </button>
            )}
            {tools}
          </div>
        </div>
        {own && filter && filterOpen && (
          <div className="border-b border-gray-200 px-2 py-1.5">
            <TypeBuilder
              type={filter}
              onChange={(expr) => saveType({ ...own, expr })}
              selfId={own.id}
            />
          </div>
        )}
        {typeId === null ? (
          <p className="px-2 py-1.5 text-xs text-gray-500">
            Choose which notes to show, under Source.
          </p>
        ) : count === 0 ? (
          <p className="px-2 py-1.5 text-xs text-gray-500">No notes match.</p>
        ) : (
          children
        )}
      </div>
    </PopupContainerContext.Provider>
  );
}

/** A menu item's check mark (or the space for one). */
export function Checked({ on }: { on: boolean }) {
  return (
    <span className="flex size-3.5 items-center justify-center">
      {on && <CheckIcon className="size-3.5" />}
    </span>
  );
}

/**
 * "Source": which notes the view shows. A named type (or collection), or the view's own filter;
 * an own filter can be saved as a collection, usable anywhere.
 */
function SourceMenu({
  typeId,
  own,
  onPick,
  onSave,
  container,
}: {
  typeId: TypeId | null;
  /** Whether the view shows its own filter. */
  own: boolean;
  /** A type's ID, or null for a new own filter. */
  onPick: (typeId: TypeId | null) => void;
  onSave: () => void;
  container: HTMLElement | null;
}) {
  const types = useCanvasStore((s) => s.types).filter(
    (t) => t.id !== NOTE_TYPE_ID && !isUnnamed(t),
  );
  return (
    <Menu.Root>
      <Menu.Trigger className={toolButtonClass}>
        <DatabaseIcon className="size-3.5" />
        Source
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="end" className={POSITIONER_CLASS}>
          <Menu.Popup className={`max-h-80 min-w-48 overflow-y-auto py-1 ${POPUP_CLASS}`}>
            {types.map((t) => (
              <Menu.Item key={t.id} onClick={() => onPick(t.id)} className={menuItemClass}>
                <Checked on={t.id === typeId} />
                <TypeIcon typeId={t.id} className="size-3.5" />
                {t.name}
              </Menu.Item>
            ))}
            <Menu.Separator className="my-1 h-px bg-gray-200" />
            <Menu.Item onClick={() => !own && onPick(null)} className={menuItemClass}>
              <Checked on={own} />
              <ListFilterIcon className="size-3.5 text-gray-500" />
              {own ? "Own filter" : "Own filter…"}
            </Menu.Item>
            {own && (
              <Menu.Item onClick={onSave} className={menuItemClass}>
                <Checked on={false} />
                <BookmarkPlusIcon className="size-3.5 text-gray-500" />
                Save as collection…
              </Menu.Item>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** "View": how the view shows its notes, as submenus (a table's columns, a kanban's grouping). */
export function ViewMenu({ children }: { children: ReactNode }) {
  const container = useViewportPortal();
  return (
    <Menu.Root>
      <Menu.Trigger className={toolButtonClass}>
        <SlidersHorizontalIcon className="size-3.5" />
        View
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="end" className={POSITIONER_CLASS}>
          <Menu.Popup className={`min-w-48 py-1 ${POPUP_CLASS}`}>{children}</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** One of View's submenus: its name, what it's set to now, and its items. */
export function ViewSubmenu({
  Icon,
  label,
  current,
  children,
}: {
  Icon: LucideIcon;
  label: string;
  current?: string;
  children: ReactNode;
}) {
  const container = useViewportPortal();
  return (
    <Menu.SubmenuRoot>
      <Menu.SubmenuTrigger className={menuItemClass}>
        <Icon className="size-3.5 text-gray-500" />
        {label}
        <span className="ml-auto max-w-32 truncate pl-3 text-gray-500">{current}</span>
        <ChevronRightIcon className="size-3.5 text-gray-400" />
      </Menu.SubmenuTrigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={2} className={POSITIONER_CLASS}>
          <Menu.Popup className={`max-h-80 min-w-40 overflow-y-auto py-1 ${POPUP_CLASS}`}>
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.SubmenuRoot>
  );
}
