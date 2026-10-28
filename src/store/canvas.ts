import { applyNodeChanges, type Node, type NodeChange, type XYPosition } from "@xyflow/react";
import { create } from "zustand";

export type NoteKind = "task" | "bug" | "spike" | "epic";

export type EditorNodeData = {
  title: string;
  kind: NoteKind;
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

type CanvasState = {
  nodes: EditorNode[];
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

export const newNoteId = () => crypto.randomUUID();

type NewNote = {
  title: string;
  position: XYPosition;
  kind?: NoteKind;
  content?: string | null;
  id?: string;
};

export const createNote = ({
  title,
  position,
  kind = "task",
  content = null,
  id = newNoteId(),
}: NewNote): EditorNode => ({
  id,
  type: "editor",
  position,
  width: NOTE_WIDTH,
  data: { title, kind, content },
});

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  nodes: [],
  mentionAnchors: {},
  hoveredMention: null,
  highlight: null,
  onNodesChange: (changes) =>
    set((s) => {
      const removed = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
      if (removed.length === 0) return { nodes: applyNodeChanges(changes, s.nodes) };
      const mentionAnchors = { ...s.mentionAnchors };
      for (const id of removed) delete mentionAnchors[id];
      const nodes = applyNodeChanges(changes, s.nodes);
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
      return { mentionAnchors, highlight: pruneHighlight(s.highlight, s.nodes, mentionAnchors) };
    }),
  setHoveredMention: (hoveredMention) => set({ hoveredMention }),
  setHighlight: (highlight) => set({ highlight }),
}));
