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
import { activeWorkspace, boardKey, useWorkspaces, type SampleId } from "./workspaces";
import {
  BUILT_IN_SCHEMAS,
  conformValue,
  customIconRef,
  initialValue,
  type CustomIcon,
  type FieldAtom,
  type FieldDef,
  type FieldValue,
  type IconRef,
  type NoteColor,
  type Schema,
} from "../workspace/model";

export type EditorNodeData = {
  title: string;
  /** The note's schema (type), or null for a plain note without fields. */
  schemaId: string | null;
  /** Values of the schema's fields, by field ID. */
  fields: Record<string, FieldValue>;
  /** Tints the note's title bar and its mentions; unset for the default look. */
  color?: NoteColor | null;
  /** The note's own icon (an icon reference, e.g. a user's avatar); unset uses its type's icon. */
  icon?: IconRef | null;
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
export type MentionLink = { sourceId: string; handleId: string; targetId: string };

/** What a click has highlighted: one edge, or every edge coming into a note. */
export type Highlight = { kind: "link"; link: MentionLink } | { kind: "incoming"; noteId: string };

export type SettingsTab = "fields" | "schemas" | "icons" | "workspace";

/** Everything that makes up a board: what's saved, and what the sample provides. */
export type Board = {
  nodes: EditorNode[];
  fields: FieldDef[];
  schemas: Schema[];
  customIcons: CustomIcon[];
};

type CanvasState = Board & {
  /** False until a board has been loaded (first visit, before the sample is seeded). */
  initialized: boolean;
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
   * Creates a plain note as a new option of select field `fieldId`: placed below the field's other
   * option notes (or right of `nearNoteId` if it has none), and appended to its options if the
   * field is saved. `siblingIds` overrides the field's saved options (e.g. a settings draft).
   */
  createOptionNote: (
    fieldId: string,
    title: string,
    place?: { nearNoteId?: string; siblingIds?: string[] },
  ) => string;
  updateNodeData: (id: string, data: Partial<EditorNodeData>) => void;
  setMentionAnchors: (id: string, anchors: MentionAnchor[]) => void;
  setHoveredMention: (mention: MentionLink | null) => void;
  setHighlight: (highlight: Highlight | null) => void;
  setViewport: (viewport: Viewport) => void;

  loadBoard: (board: Board) => void;
  setNoteSchema: (noteId: string, schemaId: string | null) => void;
  setNoteField: (noteId: string, fieldId: string, value: FieldValue) => void;
  /** Adds or replaces a field definition; notes using it are brought in line with its rules. */
  saveField: (field: FieldDef) => void;
  /** Deletes a field from the workspace, every schema, and every note. */
  deleteField: (fieldId: string) => void;
  /** Adds or replaces a schema; notes get defaults for added fields and lose removed ones. */
  saveSchema: (schema: Schema) => void;
  /** Deletes a schema; its notes become plain notes (their field values are dropped). */
  deleteSchema: (schemaId: string) => void;
  /** Adds or replaces a custom icon. */
  saveCustomIcon: (icon: CustomIcon) => void;
  /** Deletes a custom icon; types, fields, notes and values using it fall back to no icon. */
  deleteCustomIcon: (iconId: string) => void;
};

/** Whether any note has a value for the field (its type can't be changed then). */
export const isFieldInUse = (nodes: EditorNode[], fieldId: string) =>
  nodes.some((n) => (n.data.fields[fieldId]?.length ?? 0) > 0);

/** Field values for a note of `schema`, keeping what `current` has for fields still present. */
function fieldsFor(
  schema: Schema | undefined,
  fields: FieldDef[],
  current: Record<string, FieldValue> = {},
): Record<string, FieldValue> {
  const out: Record<string, FieldValue> = {};
  for (const id of schema?.fieldIds ?? []) {
    const field = fields.find((f) => f.id === id);
    if (field) out[id] = id in current ? conformValue(field, current[id]) : initialValue(field);
  }
  return out;
}

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
  if (!h) return h;
  const exists = (id: string) => nodes.some((n) => n.id === id);
  if (h.kind === "incoming") return exists(h.noteId) ? h : null;
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
    { x: from.x + from.width + GAP_X, y: from.y, width, height: ESTIMATED_NOTE_HEIGHT },
    nodes,
  );
}

/** First free slot below the lowest of `siblings` (same column), sliding past notes in the way. */
function positionBelow(siblings: EditorNode[], nodes: EditorNode[], width: number): XYPosition {
  const lowest = siblings.map(rectOf).reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
  return slideDown(
    { x: lowest.x, y: lowest.y + lowest.height + GAP_Y, width, height: ESTIMATED_NOTE_HEIGHT },
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
  schemaId?: string | null;
  fields?: Record<string, FieldValue>;
  color?: NoteColor | null;
  icon?: IconRef | null;
  content?: string | null;
  id?: string;
  width?: number;
};

export const createNote = ({
  title,
  position,
  schemaId = null,
  fields = {},
  color = null,
  icon = null,
  content = null,
  id = newId(),
  width = NOTE_WIDTH,
}: NewNote): EditorNode => ({
  id,
  type: "editor",
  position,
  width,
  data: { title, schemaId, fields, color, icon, content },
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
  deletedTitles: {},
  viewport: null,
  nodes: [],
  fields: [],
  customIcons: [],
  schemas: BUILT_IN_SCHEMAS,
  mentionAnchors: {},
  hoveredMention: null,
  highlight: null,
} satisfies Partial<CanvasState>;

const boardStorage = createJSONStorage<Partial<CanvasState>>(() => debouncedLocalStorage());

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      ...BLANK,
      onNodesChange: (changes) =>
        set((s) => {
          const removed = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
          if (removed.length === 0)
            return { nodes: withoutHeight(applyNodeChanges(changes, s.nodes)) };
          const mentionAnchors = { ...s.mentionAnchors };
          for (const id of removed) delete mentionAnchors[id];
          const gone = new Set<FieldAtom>(removed);
          // Deleted notes disappear from select fields: their options, defaults and values.
          const fields = s.fields.map((f) =>
            f.type === "select" && [...f.optionIds, ...f.defaultValue].some((id) => gone.has(id))
              ? {
                  ...f,
                  optionIds: f.optionIds.filter((id) => !gone.has(id)),
                  defaultValue: f.defaultValue.filter((id) => !gone.has(id)),
                }
              : f,
          );
          const selectIds = new Set(fields.filter((f) => f.type === "select").map((f) => f.id));
          const nodes = withoutHeight(applyNodeChanges(changes, s.nodes)).map((n) => {
            const touched = Object.keys(n.data.fields).filter(
              (id) => selectIds.has(id) && n.data.fields[id]!.some((v) => gone.has(v)),
            );
            if (touched.length === 0) return n;
            const values = { ...n.data.fields };
            for (const id of touched) {
              const field = fields.find((f) => f.id === id)!;
              values[id] = conformValue(
                field,
                values[id]!.filter((v) => !gone.has(v)),
              );
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
            fields,
            deletedTitles,
            mentionAnchors,
            highlight: pruneHighlight(s.highlight, nodes, mentionAnchors),
          };
        }),
      addNode: (position) => {
        const note = createNote({ title: nextNoteTitle(get().nodes), position });
        set((s) => ({ nodes: [...s.nodes, note] }));
        return note.id;
      },
      settingsOpen: false,
      setSettingsOpen: (open) =>
        set((s) => ({ settingsOpen: typeof open === "function" ? open(s.settingsOpen) : open })),
      settingsTab: "fields",
      setSettingsTab: (settingsTab) => set({ settingsTab }),
      createNoteBeside: (sourceId, title) => {
        const { nodes } = get();
        const source = nodes.find((n) => n.id === sourceId);
        const position = source ? positionBeside(source, nodes) : { x: 0, y: 0 };
        const note = createNote({ title, position });
        set({ nodes: [...nodes, note] });
        return note.id;
      },
      createOptionNote: (fieldId, title, place = {}) => {
        const { nodes, fields } = get();
        const field = fields.find((f) => f.id === fieldId);
        const siblingIds = place.siblingIds ?? (field?.type === "select" ? field.optionIds : []);
        const siblings = nodes.filter((n) => siblingIds.includes(n.id));
        const near = nodes.find((n) => n.id === place.nearNoteId);
        const position =
          siblings.length > 0
            ? positionBelow(siblings, nodes, OPTION_NOTE_WIDTH)
            : near
              ? positionBeside(near, nodes, OPTION_NOTE_WIDTH)
              : { x: 0, y: 0 };
        const note = createNote({ title, position, width: OPTION_NOTE_WIDTH });
        set({
          nodes: [...nodes, note],
          fields: fields.map((f) =>
            f.id === fieldId && f.type === "select"
              ? { ...f, optionIds: [...f.optionIds, note.id] }
              : f,
          ),
        });
        return note.id;
      },
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

      loadBoard: ({ nodes, fields, schemas, customIcons }) =>
        set({
          initialized: true,
          nodes,
          fields,
          schemas,
          customIcons,
          mentionAnchors: {},
          hoveredMention: null,
          highlight: null,
        }),
      setNoteSchema: (noteId, schemaId) =>
        set((s) => {
          const schema = s.schemas.find((sc) => sc.id === schemaId);
          return {
            nodes: s.nodes.map((n) =>
              n.id === noteId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      schemaId: schema ? schema.id : null,
                      fields: fieldsFor(schema, s.fields, n.data.fields),
                    },
                  }
                : n,
            ),
          };
        }),
      setNoteField: (noteId, fieldId, value) =>
        set((s) => {
          const field = s.fields.find((f) => f.id === fieldId);
          if (!field) return {};
          return {
            nodes: s.nodes.map((n) =>
              n.id === noteId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      fields: { ...n.data.fields, [fieldId]: conformValue(field, value) },
                    },
                  }
                : n,
            ),
          };
        }),
      saveField: (field) =>
        set((s) => {
          return {
            fields: upsertById(s.fields, field),
            nodes: s.nodes.map((n) =>
              field.id in n.data.fields
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      fields: {
                        ...n.data.fields,
                        [field.id]: conformValue(field, n.data.fields[field.id]),
                      },
                    },
                  }
                : n,
            ),
          };
        }),
      deleteField: (fieldId) =>
        set((s) => ({
          fields: s.fields.filter((f) => f.id !== fieldId),
          schemas: s.schemas.map((sc) =>
            sc.fieldIds.includes(fieldId)
              ? { ...sc, fieldIds: sc.fieldIds.filter((id) => id !== fieldId) }
              : sc,
          ),
          nodes: s.nodes.map((n) => {
            if (!(fieldId in n.data.fields)) return n;
            const { [fieldId]: _removed, ...fields } = n.data.fields;
            return { ...n, data: { ...n.data, fields } };
          }),
        })),
      saveSchema: (schema) =>
        set((s) => {
          return {
            schemas: upsertById(s.schemas, schema),
            nodes: s.nodes.map((n) =>
              n.data.schemaId === schema.id
                ? { ...n, data: { ...n.data, fields: fieldsFor(schema, s.fields, n.data.fields) } }
                : n,
            ),
          };
        }),
      deleteSchema: (schemaId) =>
        set((s) => ({
          schemas: s.schemas.filter((sc) => sc.id !== schemaId || sc.builtIn),
          nodes: s.nodes.map((n) =>
            n.data.schemaId === schemaId && !s.schemas.find((sc) => sc.id === schemaId)?.builtIn
              ? { ...n, data: { ...n.data, schemaId: null, fields: {} } }
              : n,
          ),
        })),
      saveCustomIcon: (icon) => set((s) => ({ customIcons: upsertById(s.customIcons, icon) })),
      deleteCustomIcon: (iconId) =>
        set((s) => {
          const ref = customIconRef(iconId);
          const iconFieldIds = new Set(s.fields.filter((f) => f.type === "icon").map((f) => f.id));
          return {
            customIcons: s.customIcons.filter((i) => i.id !== iconId),
            schemas: s.schemas.map((sc) => (sc.icon === ref ? { ...sc, icon: "file-text" } : sc)),
            fields: s.fields.map((f): FieldDef => {
              const field = f.icon === ref ? { ...f, icon: undefined } : f;
              return field.type === "icon" && field.defaultValue.includes(ref)
                ? { ...field, defaultValue: field.defaultValue.filter((v) => v !== ref) }
                : field;
            }),
            nodes: s.nodes.map((n) => {
              const usesIt = Object.entries(n.data.fields).some(
                ([id, v]) => iconFieldIds.has(id) && v.includes(ref),
              );
              if (n.data.icon !== ref && !usesIt) return n;
              const fields = Object.fromEntries(
                Object.entries(n.data.fields).map(([id, v]) => [
                  id,
                  iconFieldIds.has(id) ? v.filter((x) => x !== ref) : v,
                ]),
              );
              return {
                ...n,
                data: { ...n.data, icon: n.data.icon === ref ? null : n.data.icon, fields },
              };
            }),
          };
        }),
    }),
    {
      // The active workspace's board; switching workspaces points this at another one.
      name: boardKey(activeWorkspace().id),
      version: 10,
      storage: boardStorage,
      partialize: (s) => ({
        initialized: s.initialized,
        viewport: s.viewport,
        nodes: s.nodes.map(persistedNode),
        fields: s.fields,
        schemas: s.schemas,
        customIcons: s.customIcons,
        deletedTitles: s.deletedTitles,
      }),
    },
  ),
);

const SAMPLE_BOARDS: Record<SampleId, () => Promise<Board>> = {
  ledgerly: () => import("../sample/ledgerly").then((m) => m.createLedgerlyBoard()),
  research: () => import("../sample/research").then((m) => m.createResearchBoard()),
  "group-theory": () => import("../sample/groupTheory").then((m) => m.createGroupTheoryBoard()),
};

/**
 * Makes `workspaceId` the active workspace: loads its saved board, or (the first time it's
 * opened) its sample or an empty board. Samples, with Lexical's headless editor, are only loaded
 * when they're needed.
 */
export async function openWorkspace(workspaceId: string) {
  const workspace = useWorkspaces.getState().workspaces.find((w) => w.id === workspaceId);
  if (!workspace) return;
  const name = boardKey(workspaceId);
  const saved = (await boardStorage!.getItem(name))?.state;
  const board = saved?.initialized
    ? null
    : workspace.sample
      ? await SAMPLE_BOARDS[workspace.sample]()
      : { nodes: [], fields: [], schemas: BUILT_IN_SCHEMAS, customIcons: [] };
  // From here on, synchronously: the store is saved to the new key from the first change.
  useCanvasStore.persist.setOptions({ name });
  useCanvasStore.setState({ ...BLANK, ...saved });
  if (board) useCanvasStore.getState().loadBoard(board);
  useWorkspaces.getState().setActive(workspaceId);
}

/** Deletes a workspace and its saved board (not the active one). */
export function deleteWorkspace(workspaceId: string) {
  if (workspaceId === useWorkspaces.getState().activeId) return;
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
