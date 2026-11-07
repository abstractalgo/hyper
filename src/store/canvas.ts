import {
  applyNodeChanges,
  type Node,
  type NodeChange,
  type Viewport,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { debouncedLocalStorage } from "./debouncedStorage";
import { isSavedBoard, toTypes } from "./toTypes";
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

export type EditorNode = Node<EditorNodeData, "editor">;

/** Where an `@mention` sits inside its note, measured from the rendered DOM. */
export type MentionAnchor = {
  /** Source handle id, unique within the note. */
  handleId: string;
  /** ID of the mentioned note. */
  targetId: string;
  /** Vertical offset from the top of the note, in flow (unzoomed) pixels. */
  y: number;
};

/** One `@mention` link: the mentioning note, that mention's handle, and the mentioned note. */
export type MentionLink = {
  sourceId: string;
  handleId: string;
  targetId: string;
};

/** What a click has highlighted: one edge, or every edge coming into a note. */
export type Highlight = { kind: "link"; link: MentionLink } | { kind: "incoming"; noteId: string };

/** Where notes show their fields: above their text (one per row, or inline), or right of it. */
export type PropertiesPosition = "top" | "top-inline" | "right";

/** What labels each field in the inline layout: its name, its icon, or both. */
export type InlineLabels = "name" | "icon" | "both";

export type SettingsTab = "types" | "icons" | "workspace";

/** Everything that makes up a board: what's saved, and what the sample provides. */
export type Board = {
  nodes: EditorNode[];
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
  /** Mention anchors per note ID. Edges are derived from these; there are no manual edges. */
  mentionAnchors: Record<string, MentionAnchor[]>;
  /** The `@mention` under the pointer: highlights its target note and its edge. */
  hoveredMention: MentionLink | null;
  /** Set by clicking an edge or a note's incoming handle; cleared by clicking elsewhere. */
  highlight: Highlight | null;
  onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
  /** Adds a note at `position`; returns its ID. */
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
  setMentionAnchors: (id: string, anchors: MentionAnchor[]) => void;
  setHoveredMention: (mention: MentionLink | null) => void;
  setHighlight: (highlight: Highlight | null) => void;
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

/** Whether the edge for `link` is highlighted (hovered mention, clicked edge, or incoming). */
export function isLinkHighlighted(
  s: Pick<CanvasState, "hoveredMention" | "highlight">,
  link: MentionLink,
): boolean {
  const matches = (other: MentionLink | null | undefined) =>
    other?.sourceId === link.sourceId && other.handleId === link.handleId;
  const h = s.highlight;
  return (
    matches(s.hoveredMention) ||
    (h?.kind === "link" && matches(h.link)) ||
    (h?.kind === "incoming" && h.noteId === link.targetId)
  );
}

/**
 * Whether a note is highlighted: the target of the hovered mention, either end of a clicked
 * edge, or the source of an edge into the note whose incoming handle was clicked.
 */
export function isNoteHighlighted(s: CanvasState, id: string): boolean {
  const h = s.highlight;
  return (
    s.hoveredMention?.targetId === id ||
    (h?.kind === "link" && (h.link.sourceId === id || h.link.targetId === id)) ||
    (h?.kind === "incoming" &&
      h.noteId !== id &&
      (s.mentionAnchors[id]?.some((a) => a.targetId === h.noteId) ?? false))
  );
}

/** Drops a highlight that points at notes or mentions that no longer exist. */
function pruneHighlight(
  h: Highlight | null,
  nodes: EditorNode[],
  mentionAnchors: CanvasState["mentionAnchors"],
): Highlight | null {
  if (!h) {
    return h;
  }
  const exists = (id: string) => nodes.some((n) => n.id === id);
  if (h.kind === "incoming") {
    return exists(h.noteId) ? h : null;
  }
  const { sourceId, handleId, targetId } = h.link;
  const stillMentioned = mentionAnchors[sourceId]?.some(
    (a) => a.handleId === handleId && a.targetId === targetId,
  );
  return exists(sourceId) && exists(targetId) && stillMentioned ? h : null;
}

export const NOTE_WIDTH = 360;
/** Height assumed for notes that haven't been measured yet (e.g. just created). */
const ESTIMATED_NOTE_HEIGHT = 140;
const GAP_X = 120;
const GAP_Y = 40;

type Rect = { x: number; y: number; width: number; height: number };

const rectOf = (n: EditorNode): Rect => ({
  ...n.position,
  width: n.measured?.width ?? n.width ?? NOTE_WIDTH,
  height: n.measured?.height ?? n.height ?? ESTIMATED_NOTE_HEIGHT,
});

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width + GAP_Y &&
  b.x < a.x + a.width + GAP_Y &&
  a.y < b.y + b.height + GAP_Y &&
  b.y < a.y + a.height + GAP_Y;

/** Moves `slot` down until it doesn't overlap any note. */
function slideDown(slot: Rect, nodes: EditorNode[]): XYPosition {
  for (let blocker = nodes.find((n) => overlaps(slot, rectOf(n))); blocker;) {
    const r = rectOf(blocker);
    slot.y = r.y + r.height + GAP_Y;
    blocker = nodes.find((n) => overlaps(slot, rectOf(n)));
  }
  return { x: slot.x, y: slot.y };
}

/** First free slot right of `source`, sliding down past any notes in the way. */
function positionBeside(source: EditorNode, nodes: EditorNode[], width = NOTE_WIDTH): XYPosition {
  const from = rectOf(source);
  return slideDown(
    {
      x: from.x + from.width + GAP_X,
      y: from.y,
      width,
      height: ESTIMATED_NOTE_HEIGHT,
    },
    nodes,
  );
}

/** First free slot below the lowest of `siblings` (same column), sliding past notes in the way. */
function positionBelow(siblings: EditorNode[], nodes: EditorNode[], width: number): XYPosition {
  const lowest = siblings.map(rectOf).reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
  return slideDown(
    {
      x: lowest.x,
      y: lowest.y + lowest.height + GAP_Y,
      width,
      height: ESTIMATED_NOTE_HEIGHT,
    },
    nodes,
  );
}

/** Notes created as select options are small, like tags. */
export const OPTION_NOTE_WIDTH = 240;

export const newId = () => crypto.randomUUID();

/** Title for a note created without one. */
export const nextNoteTitle = (nodes: readonly EditorNode[]) => `Note ${nodes.length + 1}`;

/** `items` with `item` replacing the one with its ID, or appended if there's none. */
const upsertById = <T extends { id: string }>(items: readonly T[], item: T): T[] =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];

type NewNote = {
  title: string;
  position: XYPosition;
  fields?: Record<KeyId, FieldValue>;
  color?: NoteColor | null;
  content?: string | null;
  id?: string;
  width?: number;
};

export const createNote = ({
  title,
  position,
  fields = {},
  color = null,
  content = null,
  id = newId(),
  width = NOTE_WIDTH,
}: NewNote): EditorNode => ({
  id,
  type: "editor",
  position,
  width,
  data: { title, fields, color, content },
});

/** Only what's worth saving: drops React Flow's runtime state (measured size, selection…). */
const persistedNode = ({ id, type, position, width, data }: EditorNode): EditorNode => ({
  id,
  type,
  position,
  width,
  data,
});

/** Notes never have a fixed height (it always follows their content); resizing sets one. */
const withoutHeight = (nodes: EditorNode[]) =>
  nodes.map((n) => (n.height === undefined ? n : { ...n, height: undefined }));

/** A workspace's state before its board is loaded (what's left of the previous one is reset). */
const BLANK = {
  initialized: false,
  propertiesPosition: "top",
  inlineLabels: "both",
  deletedTitles: {},
  viewport: null,
  nodes: [],
  types: [...BUILT_IN_TYPES],
  customIcons: [],
  mentionAnchors: {},
  hoveredMention: null,
  highlight: null,
} satisfies Partial<CanvasState>;

/** The saved board's shape; 11 replaced fields and schemas with types. */
const BOARD_VERSION = 11;

const boardStorage = createJSONStorage<Partial<CanvasState>>(() => debouncedLocalStorage());

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      ...BLANK,
      onNodesChange: (changes) =>
        set((s) => {
          const removed = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
          if (removed.length === 0) {
            return { nodes: withoutHeight(applyNodeChanges(changes, s.nodes)) };
          }
          const mentionAnchors = { ...s.mentionAnchors };
          for (const id of removed) {
            delete mentionAnchors[id];
          }
          // Deleted notes disappear from fields: from the options types list, and from values.
          const gone = new Set<string>(removed);
          const types = s.types.map((t) => ({ ...t, expr: withoutObjects(t.expr, gone) }));
          const nodes = withoutHeight(applyNodeChanges(changes, s.nodes)).map((n) => {
            const touched = Object.entries(n.data.fields).filter(([, v]) =>
              v.some((x) => gone.has(String(x))),
            );
            if (touched.length === 0) {
              return n;
            }
            const values = { ...n.data.fields };
            for (const [key, v] of touched) {
              values[key] = v.filter((x) => !gone.has(String(x)));
            }
            return { ...n, data: { ...n.data, fields: values } };
          });
          // Mentions of a deleted note keep showing its title.
          const deletedTitles = { ...s.deletedTitles };
          for (const id of removed) {
            const title = s.nodes.find((n) => n.id === id)?.data.title;
            if (title !== undefined && nodes.some((n) => n.data.content?.includes(id))) {
              deletedTitles[id] = title;
            }
          }
          return {
            nodes,
            types,
            deletedTitles,
            mentionAnchors,
            highlight: pruneHighlight(s.highlight, nodes, mentionAnchors),
          };
        }),
      addNode: (position) => {
        const note = createNote({
          title: nextNoteTitle(get().nodes),
          position,
        });
        set((s) => ({ nodes: [...s.nodes, note] }));
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
        const { nodes } = get();
        const source = nodes.find((n) => n.id === sourceId);
        const position = source ? positionBeside(source, nodes) : { x: 0, y: 0 };
        const note = createNote({ title, position });
        set({ nodes: [...nodes, note] });
        return note.id;
      },
      createOptionNote: (key, title, nearNoteId) => {
        const { nodes, types } = get();
        const declaration = declarationOf(types, key);
        const kind = declaration ? valueKind(declaration.type) : null;
        const siblingIds = kind?.kind === "note" ? kind.options : [];
        const siblings = nodes.filter((n) => siblingIds.includes(n.id));
        const near = nodes.find((n) => n.id === nearNoteId);
        const position =
          siblings.length > 0
            ? positionBelow(siblings, nodes, OPTION_NOTE_WIDTH)
            : near
              ? positionBeside(near, nodes, OPTION_NOTE_WIDTH)
              : { x: 0, y: 0 };
        const note = createNote({ title, position, width: OPTION_NOTE_WIDTH });
        set({
          nodes: [...nodes, note],
          types: editDeclaration(types, key, (e) => ({ ...e, type: withOption(e.type, note.id) })),
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
          nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
        })),
      setMentionAnchors: (id, anchors) =>
        set((s) => {
          const mentionAnchors = { ...s.mentionAnchors, [id]: anchors };
          // A clicked edge goes away when its mention is deleted or retyped to another note.
          return {
            mentionAnchors,
            highlight: pruneHighlight(s.highlight, s.nodes, mentionAnchors),
          };
        }),
      setHoveredMention: (hoveredMention) => set({ hoveredMention }),
      setHighlight: (highlight) => set({ highlight }),
      setViewport: (viewport) => set({ viewport }),
      setPropertiesPosition: (propertiesPosition) => set({ propertiesPosition }),
      setInlineLabels: (inlineLabels) => set({ inlineLabels }),

      loadBoard: ({ nodes, types, customIcons }) =>
        set({
          initialized: true,
          nodes,
          types,
          customIcons,
          mentionAnchors: {},
          hoveredMention: null,
          highlight: null,
        }),
      setNoteTypes: (noteId, typeIds) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === noteId
              ? { ...n, data: { ...n.data, fields: fieldsFor(typeIds, s.types, n.data.fields) } }
              : n,
          ),
        })),
      setNoteField: (noteId, key, value) =>
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === noteId
              ? { ...n, data: { ...n.data, fields: { ...n.data.fields, [key]: value } } }
              : n,
          ),
        })),
      saveType: (type) => set((s) => ({ types: upsertById(s.types, type) })),
      deleteType: (typeId) =>
        set((s) => ({
          types: s.types.filter((t) => t.id !== typeId || t.builtIn),
          nodes: s.nodes.map((n) =>
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
            nodes: s.nodes.map((n) => {
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
        nodes: s.nodes.map(persistedNode),
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
  let saved = (await boardStorage!.getItem(name))?.state;
  const board = saved?.initialized
    ? null
    : workspace.sample
      ? (await SAMPLES[workspace.sample]()).createBoard()
      : { nodes: [], types: [...BUILT_IN_TYPES], customIcons: [] };
  // Boards saved with fields and schemas are converted to types. A sample's board without
  // collections also gets the sample's, matched to its types, fields and notes by name (those
  // that no longer resolve are left out).
  if (saved?.initialized && isSavedBoard(saved)) {
    const { fields: _fields, schemas: _schemas, collections, ...rest } = saved;
    const converted = toTypes(saved);
    const sampleCollections =
      !collections?.length && workspace.sample
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
  boardStorage!.removeItem(boardKey(workspaceId));
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
  return useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data[key]);
}

/** A note's value for field `key`: undefined if the note doesn't exist or never had one. */
export function useNoteField(noteId: string, key: KeyId): FieldValue | undefined {
  return useCanvasStore((s) => s.nodes.find((n) => n.id === noteId)?.data.fields[key]);
}

/** A side of a note: where a link leaves the mentioning note, or enters the mentioned one. */
export type LinkSide = "left" | "right";

const centerX = (n: EditorNode) => n.position.x + (n.measured?.width ?? n.width ?? NOTE_WIDTH) / 2;

/**
 * Which side of the mentioning note a link leaves from: towards the mentioned note, by comparing
 * the notes' horizontal centers. It enters the mentioned note on the opposite side.
 */
export function linkSide(
  nodes: readonly EditorNode[],
  sourceId: string,
  targetId: string,
): LinkSide {
  const source = nodes.find((n) => n.id === sourceId);
  const target = nodes.find((n) => n.id === targetId);
  return source && target && centerX(target) < centerX(source) ? "left" : "right";
}

export const oppositeSide = (side: LinkSide): LinkSide => (side === "left" ? "right" : "left");
