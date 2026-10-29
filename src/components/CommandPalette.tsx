import { Dialog } from "@base-ui/react/dialog";
import { useReactFlow } from "@xyflow/react";
import { go as fuzzySearch } from "fuzzysort";
import {
  ArrowLeftRightIcon,
  TextCursorInputIcon,
  TextSelectIcon,
  FocusIcon,
  PlusIcon,
  ScanIcon,
  SettingsIcon,
  Trash2Icon,
  ZoomInIcon,
  ZoomOutIcon,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  holdEditorSelection,
  replaceWithMention,
  restoreEditorSelection,
  selectionAsContent,
  type HeldSelection,
} from "../editor/heldSelection";
import { nextNoteTitle, NOTE_WIDTH, openWorkspace, useCanvasStore } from "../store/canvas";
import { useWorkspaces } from "../store/workspaces";
import { NoteIcon } from "../workspace/icons";
import { ResultList, useListNavigation } from "../workspace/ui/ResultList";
import { useGoToNote } from "./useGoToNote";

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);
const MOD = IS_MAC ? "⌘" : "Ctrl+";
const MAX_NOTES = 50;
/** Actions on the editor selection, listed first (in this order) whenever they match. */
const SELECTION_ACTIONS = ["create-titled", "create-from-selection"];
const selectionRank = (key: string) => {
  const i = SELECTION_ACTIONS.indexOf(key);
  return i < 0 ? SELECTION_ACTIONS.length : i;
};

type Row = {
  key: string;
  /** What fuzzy search matches against. */
  text: string;
  icon: ReactNode;
  /** Shown on the right: a note's type, or an action's shortcut. */
  hint?: string;
  run: () => void;
  /** Whether focus goes back to the editor selection the palette was opened from. */
  returnsToEditor?: boolean;
};

type Action = {
  key: string;
  label: string;
  Icon: LucideIcon;
  hint?: string;
  run: () => void;
  returnsToEditor?: boolean;
};

/**
 * Cmd+P (Ctrl+P elsewhere): fuzzy-search notes by title and jump to one. Starting the query with
 * ">" lists actions instead (create a note, open settings, delete the selection, zoom…).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  // The editor selection the palette was opened from (if any), to return to afterwards.
  const [held, setHeld] = useState<HeldSelection | null>(null);

  const close = useCallback(
    (returnToEditor: boolean) => {
      setOpen(false);
      // After the dialog has let go of focus.
      if (returnToEditor && held) {
        requestAnimationFrame(() => restoreEditorSelection(held));
      }
    },
    [held],
  );

  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() === "p" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        // Overrides the browser's Print.
        e.preventDefault();
        if (open) {
          close(true);
        } else {
          setHeld(holdEditorSelection());
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  return (
    // Dismissing it (Escape, clicking outside) returns to the editor selection.
    <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close(true))}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Popup
          aria-label="Command palette"
          // Focus is handed back by `close` when the palette was opened from an editor.
          finalFocus={!held}
          className="fixed top-[15vh] left-1/2 z-50 flex max-h-[60vh] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl outline-none"
        >
          {/* Mounted only while open, so every open starts with an empty search. */}
          <PaletteBody held={held} onClose={close} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The search box and results; its state lives only as long as the palette is open. */
function PaletteBody({
  held,
  onClose,
}: {
  held: HeldSelection | null;
  onClose: (returnToEditor: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const nodes = useCanvasStore((s) => s.nodes);
  const schemas = useCanvasStore((s) => s.schemas);
  const addNode = useCanvasStore((s) => s.addNode);
  const createNoteBeside = useCanvasStore((s) => s.createNoteBeside);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const { screenToFlowPosition, deleteElements, fitView, zoomIn, zoomOut, zoomTo } = useReactFlow();
  const goToNote = useGoToNote();

  const selected = nodes.filter((n) => n.selected);
  const workspaces = useWorkspaces((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaces((s) => s.activeId);
  const actions: Action[] = [
    // Selected text becomes a note of its own (as its title, or as its content), mentioned where
    // the text was.
    ...(held?.text
      ? [
          {
            key: "create-titled",
            label: `Create note titled “${held.text}”`,
            Icon: TextCursorInputIcon,
            run: () => {
              const id = createNoteBeside(held.noteId, held.text);
              requestAnimationFrame(() => replaceWithMention(held, id));
            },
          },
          {
            key: "create-from-selection",
            label: "Create note from selection",
            Icon: TextSelectIcon,
            run: () => {
              const content = selectionAsContent(held);
              const id = createNoteBeside(held.noteId, nextNoteTitle(nodes));
              updateNodeData(id, { content });
              requestAnimationFrame(() => replaceWithMention(held, id));
            },
          },
        ]
      : []),
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
      returnsToEditor: true,
      Icon: FocusIcon,
      run: () => void fitView({ duration: 300, maxZoom: 1 }),
    },
    {
      key: "zoom-in",
      label: "Zoom in",
      returnsToEditor: true,
      Icon: ZoomInIcon,
      run: () => void zoomIn({ duration: 200 }),
    },
    {
      key: "zoom-out",
      label: "Zoom out",
      returnsToEditor: true,
      Icon: ZoomOutIcon,
      run: () => void zoomOut({ duration: 200 }),
    },
    {
      key: "zoom-100",
      label: "Zoom to 100%",
      returnsToEditor: true,
      Icon: ScanIcon,
      run: () => void zoomTo(1, { duration: 200 }),
    },
    ...workspaces
      .filter((w) => w.id !== activeWorkspaceId)
      .map((w) => ({
        key: `workspace:${w.id}`,
        label: `Switch to workspace “${w.name}”`,
        Icon: ArrowLeftRightIcon,
        run: () => void openWorkspace(w.id),
      })),
  ];

  const actionMode = query.startsWith(">");
  const search = (actionMode ? query.slice(1) : query).trim();
  const rows: Row[] = actionMode
    ? (search
        ? fuzzySearch(search, actions, { key: "label", threshold: 0 })
            .map((r) => r.obj)
            // Acting on the selection stays first whenever it matches (above "Create new note").
            .toSorted((a, b) => selectionRank(a.key) - selectionRank(b.key))
        : actions
      ).map((a) => ({
        key: a.key,
        text: a.label,
        icon: <a.Icon className="size-4 text-gray-500" />,
        hint: a.hint,
        run: a.run,
        returnsToEditor: a.returnsToEditor,
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

  const runRow = (row: Row) => {
    onClose(row.returnsToEditor ?? false);
    row.run();
  };
  const nav = useListNavigation(rows, runRow);

  return (
    <>
      <input
        aria-label="Search notes, or type > for actions"
        placeholder="Search notes…  (type > for actions)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          nav.reset();
        }}
        onKeyDown={nav.onKeyDown}
        className="h-11 shrink-0 border-b border-gray-200 px-4 text-sm outline-none"
      />
      <ResultList
        items={rows}
        getKey={(row) => row.key}
        active={nav.active}
        setActive={nav.setActive}
        className="min-h-0 flex-1 overflow-y-auto p-1"
        empty={actionMode ? "No matching actions." : "No matching notes."}
        renderItem={(row) => (
          <button
            type="button"
            onClick={() => runRow(row)}
            className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm text-gray-800"
          >
            <span className="flex size-4 shrink-0 items-center justify-center">{row.icon}</span>
            <span className="min-w-0 flex-1 truncate">{row.text}</span>
            {row.hint && <span className="shrink-0 text-xs text-gray-400">{row.hint}</span>}
          </button>
        )}
      />
    </>
  );
}
