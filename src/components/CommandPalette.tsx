import { Dialog } from "@base-ui/react/dialog";
import { useReactFlow } from "@xyflow/react";
import { go as fuzzySearch } from "fuzzysort";
import {
  FocusIcon,
  PlusIcon,
  ScanIcon,
  SettingsIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { NOTE_WIDTH, useCanvasStore } from "../store/canvas.ts";
import { NoteIcon } from "../workspace/icons.tsx";
import { useGoToNote } from "./useGoToNote.ts";

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl+";
const MAX_NOTES = 50;

type Row = {
  key: string;
  /** What fuzzy search matches against. */
  text: string;
  icon: ReactNode;
  /** Shown on the right: a note's type, or an action's shortcut. */
  hint?: string;
  run: () => void;
};

type Action = { key: string; label: string; Icon: LucideIcon; hint?: string; run: () => void };

/**
 * Cmd+P (Ctrl+P elsewhere): fuzzy-search notes by title and jump to one. Starting the query with
 * ">" lists actions instead (create a note, open settings, delete the selection, zoom…).
 */
export function CommandPalette() {
  // One state, so opening always starts from an empty search (whatever opened it).
  const [{ open, query, active }, setState] = useState({ open: false, query: "", active: 0 });
  const setOpen = (next: boolean) =>
    setState((s) => (next ? { open: true, query: "", active: 0 } : { ...s, open: false }));
  const setQuery = (q: string) => setState((s) => ({ ...s, query: q, active: 0 }));
  const setActive = (update: number | ((i: number) => number)) =>
    setState((s) => ({ ...s, active: typeof update === "function" ? update(s.active) : update }));
  const listRef = useRef<HTMLUListElement>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const schemas = useCanvasStore((s) => s.schemas);
  const addNode = useCanvasStore((s) => s.addNode);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const { screenToFlowPosition, deleteElements, fitView, zoomIn, zoomOut, zoomTo } = useReactFlow();
  const goToNote = useGoToNote();

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() === "p" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        // Overrides the browser's Print.
        e.preventDefault();
        setState((s) => (s.open ? { ...s, open: false } : { open: true, query: "", active: 0 }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selected = nodes.filter((n) => n.selected);
  const actions: Action[] = [
    {
      key: "create",
      label: "Create new note",
      Icon: PlusIcon,
      run: () => {
        const center = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        const id = addNode({ x: center.x - NOTE_WIDTH / 2, y: center.y - 40 });
        // Select it once React Flow knows about it.
        requestAnimationFrame(() => goToNote(id));
      },
    },
    {
      key: "settings",
      label: "Workspace settings…",
      Icon: SettingsIcon,
      hint: `${MOD},`,
      run: () => setSettingsOpen(true),
    },
    ...(selected.length > 0
      ? [
          {
            key: "delete",
            label:
              selected.length === 1
                ? `Delete “${selected[0]!.data.title}”`
                : `Delete ${selected.length} selected notes`,
            Icon: Trash2Icon,
            hint: "⌫",
            run: () => void deleteElements({ nodes: selected.map((n) => ({ id: n.id })) }),
          },
        ]
      : []),
    {
      key: "fit",
      label: "Zoom to fit",
      Icon: FocusIcon,
      run: () => void fitView({ duration: 300, maxZoom: 1 }),
    },
    {
      key: "zoom-in",
      label: "Zoom in",
      Icon: ZoomInIcon,
      run: () => void zoomIn({ duration: 200 }),
    },
    {
      key: "zoom-out",
      label: "Zoom out",
      Icon: ZoomOutIcon,
      run: () => void zoomOut({ duration: 200 }),
    },
    {
      key: "zoom-100",
      label: "Zoom to 100%",
      Icon: ScanIcon,
      run: () => void zoomTo(1, { duration: 200 }),
    },
  ];

  const actionMode = query.startsWith(">");
  const search = (actionMode ? query.slice(1) : query).trim();
  const rows: Row[] = actionMode
    ? (search
        ? fuzzySearch(search, actions, { key: "label", threshold: 0 }).map((r) => r.obj)
        : actions
      ).map((a) => ({
        key: a.key,
        text: a.label,
        icon: <a.Icon className="size-4 text-gray-500" />,
        hint: a.hint,
        run: a.run,
      }))
    : (search
        ? fuzzySearch(search, nodes, {
            key: (n) => n.data.title,
            threshold: 0,
            limit: MAX_NOTES,
          }).map((r) => r.obj)
        : nodes.toSorted((a, b) => a.data.title.localeCompare(b.data.title)).slice(0, MAX_NOTES)
      ).map((n) => ({
        key: n.id,
        text: n.data.title,
        icon: <NoteIcon noteId={n.id} className="size-4" />,
        hint: schemas.find((s) => s.id === n.data.schemaId)?.name,
        run: () => goToNote(n.id),
      }));

  const close = () => setOpen(false);
  const runRow = (row: Row) => {
    close();
    row.run();
  };

  // Keep the highlighted row in view while moving through the list with the keyboard.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (rows.length === 0 ? 0 : (i + step + rows.length) % rows.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) runRow(row);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Popup
          aria-label="Command palette"
          className="fixed top-[15vh] left-1/2 z-50 flex max-h-[60vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl outline-none"
        >
          <input
            aria-label="Search notes, or type > for actions"
            placeholder="Search notes…  (type > for actions)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="h-11 shrink-0 border-b border-gray-200 px-4 text-sm outline-none"
          />
          <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
            {rows.map((row, i) => (
              <li key={row.key}>
                <button
                  type="button"
                  aria-current={active === i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => runRow(row)}
                  className="flex w-full items-center gap-2.5 rounded px-3 py-1.5 text-left text-sm text-gray-800 aria-current:bg-gray-100"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{row.text}</span>
                  {row.hint && <span className="shrink-0 text-xs text-gray-400">{row.hint}</span>}
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">
                {actionMode ? "No matching actions." : "No matching notes."}
              </li>
            )}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
