import { applyNodeChanges, type Node, type NodeChange, type XYPosition } from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { debouncedLocalStorage } from "./debouncedStorage.ts";
import { textFieldsToSelects, ticketPrefixToSuffix } from "./migrations.ts";
import {
  BUILT_IN_FIELDS,
  BUILT_IN_SCHEMAS,
  conformValue,
  initialValue,
  type FieldDef,
  type FieldValue,
  type OptionColor,
  type Schema,
} from "../workspace/model.ts";

export type EditorNodeData = {
  title: string;
  /** The note's schema (type), or null for a plain note without fields. */
  schemaId: string | null;
  /** Values of the schema's fields, by field ID. */
  fields: Record<string, FieldValue>;
  /** Tints the note's title bar and its mentions; unset for the default look. */
  color?: OptionColor | null;
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

/** Everything that makes up a board: what's saved, and what the sample provides. */
export type Board = { nodes: EditorNode[]; fields: FieldDef[]; schemas: Schema[] };

type CanvasState = Board & {
  /** False until a board has been loaded (first visit, before the sample is seeded). */
  initialized: boolean;
  /** Mention anchors per note ID. Edges are derived from these; there are no manual edges. */
  mentionAnchors: Record<string, MentionAnchor[]>;
  /** The `@mention` under the pointer: highlights its target note and its edge. */
  hoveredMention: MentionLink | null;
  /** Set by clicking an edge or a note's incoming handle; cleared by clicking elsewhere. */
  highlight: Highlight | null;
  onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
  addNode: (position: XYPosition) => void;
  /** Adds a note to the right of `sourceId`, below any notes already there. Returns its ID. */
  createNoteBeside: (sourceId: string, title: string) => string;
  updateNodeData: (id: string, data: Partial<EditorNodeData>) => void;
  setMentionAnchors: (id: string, anchors: MentionAnchor[]) => void;
  setHoveredMention: (mention: MentionLink | null) => void;
  setHighlight: (highlight: Highlight | null) => void;

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

/** First free slot right of `source`, sliding down past any notes in the way. */
function positionBeside(source: EditorNode, nodes: EditorNode[]): XYPosition {
  const from = rectOf(source);
  const slot: Rect = {
    x: from.x + from.width + GAP_X,
    y: from.y,
    width: NOTE_WIDTH,
    height: ESTIMATED_NOTE_HEIGHT,
  };
  for (let blocker = nodes.find((n) => overlaps(slot, rectOf(n))); blocker;) {
    const r = rectOf(blocker);
    slot.y = r.y + r.height + GAP_Y;
    blocker = nodes.find((n) => overlaps(slot, rectOf(n)));
  }
  return { x: slot.x, y: slot.y };
}

export const newId = () => crypto.randomUUID();
export const newNoteId = newId;

type NewNote = {
  title: string;
  position: XYPosition;
  schemaId?: string | null;
  fields?: Record<string, FieldValue>;
  color?: OptionColor | null;
  content?: string | null;
  id?: string;
};

export const createNote = ({
  title,
  position,
  schemaId = null,
  fields = {},
  color = null,
  content = null,
  id = newNoteId(),
}: NewNote): EditorNode => ({
  id,
  type: "editor",
  position,
  width: NOTE_WIDTH,
  data: { title, schemaId, fields, color, content },
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

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      initialized: false,
      nodes: [],
      fields: BUILT_IN_FIELDS,
      schemas: BUILT_IN_SCHEMAS,
      mentionAnchors: {},
      hoveredMention: null,
      highlight: null,
      onNodesChange: (changes) =>
        set((s) => {
          const removed = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
          if (removed.length === 0)
            return { nodes: withoutHeight(applyNodeChanges(changes, s.nodes)) };
          const mentionAnchors = { ...s.mentionAnchors };
          for (const id of removed) delete mentionAnchors[id];
          const nodes = withoutHeight(applyNodeChanges(changes, s.nodes));
          return {
            nodes,
            mentionAnchors,
            highlight: pruneHighlight(s.highlight, nodes, mentionAnchors),
          };
        }),
      addNode: (position) =>
        set((s) => ({
          nodes: [...s.nodes, createNote({ title: `Note ${s.nodes.length + 1}`, position })],
        })),
      createNoteBeside: (sourceId, title) => {
        const { nodes } = get();
        const source = nodes.find((n) => n.id === sourceId);
        const position = source ? positionBeside(source, nodes) : { x: 0, y: 0 };
        const note = createNote({ title, position });
        set({ nodes: [...nodes, note] });
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

      loadBoard: ({ nodes, fields, schemas }) =>
        set({
          initialized: true,
          nodes,
          fields,
          schemas,
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
          const exists = s.fields.some((f) => f.id === field.id);
          return {
            fields: exists
              ? s.fields.map((f) => (f.id === field.id ? field : f))
              : [...s.fields, field],
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
          fields: s.fields.filter((f) => f.id !== fieldId || f.builtIn),
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
          const exists = s.schemas.some((sc) => sc.id === schema.id);
          return {
            schemas: exists
              ? s.schemas.map((sc) => (sc.id === schema.id ? schema : sc))
              : [...s.schemas, schema],
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
    }),
    {
      name: "hyper-board",
      version: 5,
      migrate: (persisted, version) => {
        let state = persisted as Board & { initialized: boolean };
        // v2 added select/multi-select fields, which need `options` on every field.
        if (version < 2) {
          state.fields = state.fields.map((f) => ({ ...f, options: f.options ?? [] }));
        }
        // v3: the sample's Status/Severity/Labels text fields become selects.
        if (version < 3) {
          state = { ...state, ...textFieldsToSelects(state) };
        }
        // v4: ticket keys moved from title prefix to suffix.
        if (version < 4) {
          state = { ...state, ...ticketPrefixToSuffix(state) };
        }
        // v5: notes no longer have a fixed height (no scrolling inside notes).
        if (version < 5) {
          state = { ...state, nodes: withoutHeight(state.nodes) };
        }
        return state as CanvasState;
      },
      storage: createJSONStorage(() => debouncedLocalStorage()),
      partialize: (s) => ({
        initialized: s.initialized,
        nodes: s.nodes.map(persistedNode),
        fields: s.fields,
        schemas: s.schemas,
      }),
    },
  ),
);
