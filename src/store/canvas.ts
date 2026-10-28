import { applyNodeChanges, type Node, type NodeChange, type XYPosition } from "@xyflow/react";
import { create } from "zustand";

export type EditorNodeData = {
  title: string;
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

type CanvasState = {
  nodes: EditorNode[];
  /** Mention anchors per note ID. Edges are derived from these; there are no manual edges. */
  mentionAnchors: Record<string, MentionAnchor[]>;
  onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
  addNode: (position: XYPosition) => void;
  /** Adds a note to the right of `sourceId`, below any notes already there. Returns its ID. */
  createNoteBeside: (sourceId: string, title: string) => string;
  updateNodeData: (id: string, data: Partial<EditorNodeData>) => void;
  setMentionAnchors: (id: string, anchors: MentionAnchor[]) => void;
};

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

export const createNote = (
  title: string,
  position: XYPosition,
  content: string | null = null,
  id: string = newNoteId(),
): EditorNode => ({
  id,
  type: "editor",
  position,
  width: NOTE_WIDTH,
  data: { title, content },
});

export const useCanvasStore = create<CanvasState>()((set, get) => ({
  nodes: [],
  mentionAnchors: {},
  onNodesChange: (changes) =>
    set((s) => {
      const removed = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
      if (removed.length === 0) return { nodes: applyNodeChanges(changes, s.nodes) };
      const mentionAnchors = { ...s.mentionAnchors };
      for (const id of removed) delete mentionAnchors[id];
      return { nodes: applyNodeChanges(changes, s.nodes), mentionAnchors };
    }),
  addNode: (position) =>
    set((s) => ({ nodes: [...s.nodes, createNote(`Note ${s.nodes.length + 1}`, position)] })),
  createNoteBeside: (sourceId, title) => {
    const { nodes } = get();
    const source = nodes.find((n) => n.id === sourceId);
    const position = source ? positionBeside(source, nodes) : { x: 0, y: 0 };
    const note = createNote(title, position);
    set({ nodes: [...nodes, note] });
    return note.id;
  },
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),
  setMentionAnchors: (id, anchors) =>
    set((s) => ({ mentionAnchors: { ...s.mentionAnchors, [id]: anchors } })),
}));
