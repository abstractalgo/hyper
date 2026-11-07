import type { Viewport, XYPosition } from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { debouncedLocalStorage } from "./debouncedStorage";
import { isSavedBoard, toNotes, toTypes, type SavedBoard, type SavedNode } from "./toTypes";
import { activeWorkspace, boardKey, useWorkspaces, type SampleId } from "./workspaces";
import {
  customIconRef,
  type CustomIcon,
  type FieldValue,
  type NoteColor,
} from "../workspace/model";
import {
  BUILT_IN_TYPES,
  entriesOfTypes,
  mapDeclarations,
  TYPE_KEY,
  valueKind,
  withOption,
  withoutObjects,
  type Entry,
  type KeyId,
  type NamedType,
  type TypeId,
} from "../workspace/typeSystem";

export type EditorNodeData = {
  title: string;
  /**
   * Field values by key, including the built-in `type` (the note's types) and `icon` (its own
   * icon, e.g. a user's avatar; unset uses its type's icon).
   */
  fields: Record<KeyId, FieldValue>;
  /** Tints the note's title bar and its mentions; unset for the default look. */
  color?: NoteColor | null;
  /** Serialized Lexical editor state (JSON), or null for an empty editor. */
  content: string | null;
};

/** A note: an object in the workspace. Where it shows is up to each view (see `Placement`). */
export type Note = { id: string; data: EditorNodeData };

/** Where a canvas places a note: its top-left corner and width (its height follows its content). */
export type Placement = { x: number; y: number; width: number };

/** Placements by note ID: a canvas's layout. */
export type Layout = Record<string, Placement>;

/** Where notes show their fields: above their text (one per row, or inline), or right of it. */
export type PropertiesPosition = "top" | "top-inline" | "right";

/** What labels each field in the inline layout: its name, its icon, or both. */
export type InlineLabels = "name" | "icon" | "both";

export type SettingsTab = "types" | "icons" | "workspace";

/** Everything that makes up a board: what's saved, and what the sample provides. */
export type Board = {
  notes: Note[];
  /** The main canvas's layout: where each note is on it. */
  layout: Layout;
  /** Named types: what notes can be, their fields, and collections of notes. */
  types: NamedType[];
  customIcons: CustomIcon[];
};

type CanvasState = Board & {
  /** False until a board has been loaded (first visit, before the sample is seeded). */
  initialized: boolean;
  /** A workspace setting: where notes show their fields. */
  propertiesPosition: PropertiesPosition;
  setPropertiesPosition: (position: PropertiesPosition) => void;
  /** A workspace setting, for the inline layout: what labels each field. */
  inlineLabels: InlineLabels;
  setInlineLabels: (labels: InlineLabels) => void;
  /** Where the canvas was panned/zoomed to; null until the user first moves it. */
  viewport: Viewport | null;
  /**
   * Titles of deleted notes that other notes still mention (by note ID), so those mentions can
   * still say what they pointed to.
   */
  deletedTitles: Record<string, string>;
  /** Notes' heights on the main canvas as last measured (not saved), for placing new notes. */
  heights: Record<string, number>;
  setHeights: (heights: Record<string, number>) => void;
  /** Moves or resizes notes on the main canvas. */
  placeNotes: (placements: Layout) => void;
  /**
   * Deletes notes: from the workspace, from fields' options and values, and from the main
   * canvas. Mentions of them keep showing their titles.
   */
  deleteNotes: (ids: string[]) => void;
  /** Adds a note at `position` on the main canvas; returns its ID. */
  addNode: (position: XYPosition) => string;
  /** Whether the workspace settings dialog is open (not saved). */
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  /** The settings dialog's tab, kept while it's closed. */
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  /** Adds a note to the right of `sourceId`, below any notes already there. Returns its ID. */
  createNoteBeside: (sourceId: string, title: string) => string;
  /**
   * Creates a plain note as a new option of field `key`: placed below the field's other option
   * notes (or right of `nearNoteId` if it has none), and added to the options its declaration
   * lists. Returns its ID.
   */
  createOptionNote: (key: KeyId, title: string, nearNoteId?: string) => string;
  /** Takes a note off the options field `key` lists (the note stays). */
  removeOption: (key: KeyId, noteId: string) => void;
  updateNodeData: (id: string, data: Partial<EditorNodeData>) => void;
  setViewport: (viewport: Viewport) => void;

  loadBoard: (board: Board) => void;
  /** Sets a note's types; required fields it doesn't have a value for get their defaults. */
  setNoteTypes: (noteId: string, typeIds: TypeId[]) => void;
  setNoteField: (noteId: string, key: KeyId, value: FieldValue) => void;
  /** Adds or replaces a named type. */
  saveType: (type: NamedType) => void;
  /**
   * Deletes a named type: notes are no longer of it. Types referring to it (or picking fields it
   * declares) then match nothing there; notes keep their values.
   */
  deleteType: (typeId: TypeId) => void;
  /** Adds or replaces a custom icon. */
  saveCustomIcon: (icon: CustomIcon) => void;
  /** Deletes a custom icon; types, fields and values using it fall back to no icon. */
  deleteCustomIcon: (iconId: string) => void;
};

/**
 * `current` field values with defaults for the required fields of `typeIds` that have none, and
 * the types themselves in `type`.
 */
function fieldsFor(
  typeIds: TypeId[],
  types: readonly NamedType[],
  current: Record<KeyId, FieldValue> = {},
): Record<KeyId, FieldValue> {
  const out = { ...current, [TYPE_KEY]: typeIds };
  for (const entry of entriesOfTypes(typeIds, types)) {
    if (!entry.optional && entry.decl?.default && (out[entry.key]?.length ?? 0) === 0) {
      out[entry.key] = [...entry.decl.default];
    }
  }
  return out;
}

/** `types` with the declaration of field `key` edited. */
const editDeclaration = (types: NamedType[], key: KeyId, edit: (entry: Entry) => Entry) =>
  types.map((t) => ({ ...t, expr: mapDeclarations(t.expr, (e) => (e.key === key ? edit(e) : e)) }));

/** The declaration of field `key`, if any. */
const declarationOf = (types: readonly NamedType[], key: KeyId): Entry | undefined => {
  let found: Entry | undefined;
  for (const t of types) {
    mapDeclarations(t.expr, (e) => {
      if (e.key === key) {
        found ??= e;
      }
      return e;
    });
  }
  return found;
};

export const NOTE_WIDTH = 360;
/** Height assumed for notes that haven't been measured yet (e.g. just created). */
const ESTIMATED_NOTE_HEIGHT = 140;
const GAP_X = 120;
const GAP_Y = 40;

type Rect = { x: number; y: number; width: number; height: number };

/** The notes on the main canvas, as rectangles (heights as last measured, or estimated). */
const rectsOf = (s: Pick<CanvasState, "layout" | "heights">) =>
  new Map(
    Object.entries(s.layout).map(([id, p]): [string, Rect] => [
      id,
      { ...p, height: s.heights[id] ?? ESTIMATED_NOTE_HEIGHT },
    ]),
  );

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + GAP_Y &&
  b.x < a.x + a.width + GAP_Y &&
  a.y < b.y + b.height + GAP_Y &&
  b.y < a.y + a.height + GAP_Y;

/** Moves `slot` down until it doesn't overlap any note. */
function slideDown(slot: Rect, rects: Rect[]): XYPosition {
  for (let blocker = rects.find((r) => overlaps(slot, r)); blocker;) {
    slot.y = blocker.y + blocker.height + GAP_Y;
    blocker = rects.find((r) => overlaps(slot, r));
  }
  return { x: slot.x, y: slot.y };
}

/** First free slot right of `from`, sliding down past any notes in the way. */
function positionBeside(from: Rect, rects: Rect[], width = NOTE_WIDTH): XYPosition {
  const slot = { x: from.x + from.width + GAP_X, y: from.y, width, height: ESTIMATED_NOTE_HEIGHT };
  return slideDown(slot, rects);
}

/** First free slot below the lowest of `siblings` (same column), sliding past notes in the way. */
function positionBelow(siblings: Rect[], rects: Rect[], width: number): XYPosition {
  const lowest = siblings.reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
  const slot = {
    x: lowest.x,
    y: lowest.y + lowest.height + GAP_Y,
    width,
    height: ESTIMATED_NOTE_HEIGHT,
  };
  return slideDown(slot, rects);
}

/** Notes created as select options are small, like tags. */
export const OPTION_NOTE_WIDTH = 240;

export const newId = () => crypto.randomUUID();

/** Title for a note created without one. */
export const nextNoteTitle = (notes: readonly Note[]) => `Note ${notes.length + 1}`;

/** `items` with `item` replacing the one with its ID, or appended if there's none. */
const upsertById = <T extends { id: string }>(items: readonly T[], item: T): T[] =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];

type NewNote = {
  title: string;
  fields?: Record<KeyId, FieldValue>;
  color?: NoteColor | null;
  content?: string | null;
  id?: string;
};

export const createNote = ({
  title,
  fields = {},
  color = null,
  content = null,
  id = newId(),
}: NewNote): Note => ({ id, data: { title, fields, color, content } });

/** A workspace's state before its board is loaded (what's left of the previous one is reset). */
const BLANK = {
  initialized: false,
  propertiesPosition: "top",
  inlineLabels: "both",
  deletedTitles: {},
  viewport: null,
  notes: [],
  layout: {},
  heights: {},
  types: [...BUILT_IN_TYPES],
  customIcons: [],
} satisfies Partial<CanvasState>;

/** The saved board's shape; 13 split notes (objects) from the main canvas's layout. */
const BOARD_VERSION = 13;

const jsonStorage = createJSONStorage<Partial<CanvasState>>(() => debouncedLocalStorage())!;

/**
 * Saves boards, but only loaded ones: a store that hasn't loaded its board (e.g. one the dev
 * server just reloaded in place) would otherwise save its blank state over the board.
 */
const boardStorage: typeof jsonStorage = {
  ...jsonStorage,
  setItem: (name, value) =>
    value.state.initialized ? jsonStorage.setItem(name, value) : undefined,
};

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      ...BLANK,
      placeNotes: (placements) => set((s) => ({ layout: { ...s.layout, ...placements } })),
      setHeights: (heights) => set((s) => ({ heights: { ...s.heights, ...heights } })),
      deleteNotes: (ids) =>
        set((s) => {
          const gone = new Set(ids);
          // Deleted notes disappear from fields: from the options types list, and from values.
          const types = s.types.map((t) => ({ ...t, expr: withoutObjects(t.expr, gone) }));
          const notes = s.notes.flatMap((n) => {
            if (gone.has(n.id)) {
              return [];
            }
            const touched = Object.entries(n.data.fields).filter(([, v]) =>
              v.some((x) => gone.has(String(x))),
            );
            if (touched.length === 0) {
              return [n];
            }
            const values = { ...n.data.fields };
            for (const [key, v] of touched) {
              values[key] = v.filter((x) => !gone.has(String(x)));
            }
            return [{ ...n, data: { ...n.data, fields: values } }];
          });
          // Mentions of a deleted note keep showing its title.
          const deletedTitles = { ...s.deletedTitles };
          for (const id of ids) {
            const title = s.notes.find((n) => n.id === id)?.data.title;
            if (title !== undefined && notes.some((n) => n.data.content?.includes(id))) {
              deletedTitles[id] = title;
            }
          }
          const without = <T>(record: Record<string, T>) =>
            Object.fromEntries(Object.entries(record).filter(([id]) => !gone.has(id)));
          return {
            notes,
            layout: without(s.layout),
            heights: without(s.heights),
            types,
            deletedTitles,
          };
        }),
      addNode: (position) => {
        const note = createNote({ title: nextNoteTitle(get().notes) });
        set((s) => ({
          notes: [...s.notes, note],
          layout: { ...s.layout, [note.id]: { ...position, width: NOTE_WIDTH } },
        }));
        return note.id;
      },
      settingsOpen: false,
      setSettingsOpen: (open) =>
        set((s) => ({
          settingsOpen: typeof open === "function" ? open(s.settingsOpen) : open,
        })),
      settingsTab: "types",
      setSettingsTab: (settingsTab) => set({ settingsTab }),
      createNoteBeside: (sourceId, title) => {
        const s = get();
        const rects = rectsOf(s);
        const source = rects.get(sourceId);
        const position = source ? positionBeside(source, [...rects.values()]) : { x: 0, y: 0 };
        const note = createNote({ title });
        set({
          notes: [...s.notes, note],
          layout: { ...s.layout, [note.id]: { ...position, width: NOTE_WIDTH } },
        });
        return note.id;
      },
      createOptionNote: (key, title, nearNoteId) => {
        const s = get();
        const declaration = declarationOf(s.types, key);
        const kind = declaration ? valueKind(declaration.type) : null;
        const rects = rectsOf(s);
        const siblings = (kind?.kind === "note" ? kind.options : []).flatMap(
          (id) => rects.get(id) ?? [],
        );
        const near = nearNoteId ? rects.get(nearNoteId) : undefined;
        const all = [...rects.values()];
        const position =
          siblings.length > 0
            ? positionBelow(siblings, all, OPTION_NOTE_WIDTH)
            : near
              ? positionBeside(near, all, OPTION_NOTE_WIDTH)
              : { x: 0, y: 0 };
        const note = createNote({ title });
        set({
          notes: [...s.notes, note],
          layout: { ...s.layout, [note.id]: { ...position, width: OPTION_NOTE_WIDTH } },
          types: editDeclaration(s.types, key, (e) => ({
            ...e,
            type: withOption(e.type, note.id),
          })),
        });
        return note.id;
      },
      removeOption: (key, noteId) =>
        set((s) => ({
          types: editDeclaration(s.types, key, (e) => ({
            ...e,
            type: withoutObjects(e.type, new Set([noteId])),
          })),
        })),
      updateNodeData: (id, data) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
        })),
      setViewport: (viewport) => set({ viewport }),
      setPropertiesPosition: (propertiesPosition) => set({ propertiesPosition }),
      setInlineLabels: (inlineLabels) => set({ inlineLabels }),

      loadBoard: ({ notes, layout, types, customIcons }) =>
        set({
          initialized: true,
          notes,
          layout,
          heights: {},
          types,
          customIcons,
        }),
      setNoteTypes: (noteId, typeIds) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === noteId
              ? { ...n, data: { ...n.data, fields: fieldsFor(typeIds, s.types, n.data.fields) } }
              : n,
          ),
        })),
      setNoteField: (noteId, key, value) =>
        set((s) => ({
          notes: s.notes.map((n) =>
            n.id === noteId
              ? { ...n, data: { ...n.data, fields: { ...n.data.fields, [key]: value } } }
              : n,
          ),
        })),
      saveType: (type) => set((s) => ({ types: upsertById(s.types, type) })),
      deleteType: (typeId) =>
        set((s) => ({
          types: s.types.filter((t) => t.id !== typeId || t.builtIn),
          notes: s.notes.map((n) =>
            n.data.fields[TYPE_KEY]?.includes(typeId)
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    fields: {
                      ...n.data.fields,
                      [TYPE_KEY]: n.data.fields[TYPE_KEY].filter((id) => id !== typeId),
                    },
                  },
                }
              : n,
          ),
        })),
      saveCustomIcon: (icon) => set((s) => ({ customIcons: upsertById(s.customIcons, icon) })),
      deleteCustomIcon: (iconId) =>
        set((s) => {
          const ref = customIconRef(iconId);
          const unset = (e: Entry): Entry =>
            e.decl?.icon === ref ? { ...e, decl: { ...e.decl, icon: undefined } } : e;
          return {
            customIcons: s.customIcons.filter((i) => i.id !== iconId),
            types: s.types.map((t) => ({
              ...t,
              icon: t.icon === ref ? "file-text" : t.icon,
              expr: mapDeclarations(withoutObjects(t.expr, new Set([ref])), unset),
            })),
            notes: s.notes.map((n) => {
              if (!Object.values(n.data.fields).some((v) => v.includes(ref))) {
                return n;
              }
              const fields = Object.fromEntries(
                Object.entries(n.data.fields).map(([key, v]) => [key, v.filter((x) => x !== ref)]),
              );
              return { ...n, data: { ...n.data, fields } };
            }),
          };
        }),
    }),
    {
      // The active workspace's board; switching workspaces points this at another one.
      name: boardKey(activeWorkspace().id),
      version: BOARD_VERSION,
      // openWorkspace loads saved boards (and brings older ones up to date), not the middleware.
      skipHydration: true,
      storage: boardStorage,
      partialize: (s) => ({
        initialized: s.initialized,
        viewport: s.viewport,
        notes: s.notes,
        layout: s.layout,
        types: s.types,
        customIcons: s.customIcons,
        deletedTitles: s.deletedTitles,
        propertiesPosition: s.propertiesPosition,
        inlineLabels: s.inlineLabels,
      }),
    },
  ),
);

/** Each sample's module: its board, and its collections as found on a board made from it. */
type SampleModule = {
  createBoard: () => Board;
  collectionsFor: (board: Board) => NamedType[];
};

const SAMPLES: Record<SampleId, () => Promise<SampleModule>> = {
  ledgerly: () => import("../sample/ledgerly"),
  research: () => import("../sample/research"),
  "group-theory": () => import("../sample/groupTheory"),
};

/**
 * Makes `workspaceId` the active workspace: loads its saved board, or (the first time it's
 * opened) its sample or an empty board. Samples, with Lexical's headless editor, are only loaded
 * when they're needed.
 */
export async function openWorkspace(workspaceId: string) {
  const workspace = useWorkspaces.getState().workspaces.find((w) => w.id === workspaceId);
  if (!workspace) {
    return;
  }
  const name = boardKey(workspaceId);
  let saved = (await boardStorage.getItem(name))?.state;
  const board = saved?.initialized
    ? null
    : workspace.sample
      ? (await SAMPLES[workspace.sample]()).createBoard()
      : { notes: [], layout: {}, types: [...BUILT_IN_TYPES], customIcons: [] };
  // Boards saved as React Flow nodes: notes become objects, their positions the main canvas's
  // layout. Those saved with fields and schemas are converted to types first, and a sample's
  // board without collections gets the sample's, matched by name (those that no longer resolve
  // are left out).
  if (saved?.initialized && "nodes" in saved) {
    const old = saved as Partial<CanvasState> & { nodes: SavedNode[] } & Partial<SavedBoard>;
    const { nodes: _nodes, fields: _fields, schemas: _schemas, collections, ...rest } = old;
    const typed = isSavedBoard(old) ? toTypes(old) : { nodes: old.nodes, types: rest.types ?? [] };
    const converted = {
      ...toNotes(typed.nodes),
      types: typed.types,
      customIcons: rest.customIcons ?? [],
    };
    const sampleCollections =
      isSavedBoard(old) && !collections?.length && workspace.sample
        ? (await SAMPLES[workspace.sample]()).collectionsFor(converted)
        : [];
    saved = { ...rest, ...converted, types: [...converted.types, ...sampleCollections] };
  }
  // From here on, synchronously: the store is saved to the new key from the first change.
  useCanvasStore.persist.setOptions({ name });
  useCanvasStore.setState({ ...BLANK, ...saved });
  if (board) {
    useCanvasStore.getState().loadBoard(board);
  }
  useWorkspaces.getState().setActive(workspaceId);
}

/** Deletes a workspace and its saved board (not the active one). */
export function deleteWorkspace(workspaceId: string) {
  if (workspaceId === useWorkspaces.getState().activeId) {
    return;
  }
  boardStorage.removeItem(boardKey(workspaceId));
  useWorkspaces.getState().remove(workspaceId);
}

/**
 * One property of a note's data, by note ID (undefined if the note doesn't exist). Re-renders only
 * when that property changes.
 */
export function useNoteData<K extends keyof EditorNodeData>(
  noteId: string,
  key: K,
): EditorNodeData[K] | undefined {
  return useCanvasStore((s) => s.notes.find((n) => n.id === noteId)?.data[key]);
}

/** A note's value for field `key`: undefined if the note doesn't exist or never had one. */
export function useNoteField(noteId: string, key: KeyId): FieldValue | undefined {
  return useCanvasStore((s) => s.notes.find((n) => n.id === noteId)?.data.fields[key]);
}

/** A side of a note: where a link leaves the mentioning note, or enters the mentioned one. */
export type LinkSide = "left" | "right";

const centerX = (p: Placement) => p.x + p.width / 2;

/**
 * Which side of the mentioning note a link leaves from: towards the mentioned note, by comparing
 * the notes' horizontal centers in a canvas's `layout`. It enters the mentioned note on the
 * opposite side.
 */
export function linkSide(layout: Layout, sourceId: string, targetId: string): LinkSide {
  const source = layout[sourceId];
  const target = layout[targetId];
  return source && target && centerX(target) < centerX(source) ? "left" : "right";
}

export const oppositeSide = (side: LinkSide): LinkSide => (side === "left" ? "right" : "left");
