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
  updateNodeData: (id: string, data: Partial<EditorNodeData>) => void;
  setMentionAnchors: (id: string, anchors: MentionAnchor[]) => void;
};

export const NOTE_WIDTH = 360;

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

export const useCanvasStore = create<CanvasState>()((set) => ({
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
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),
  setMentionAnchors: (id, anchors) =>
    set((s) => ({ mentionAnchors: { ...s.mentionAnchors, [id]: anchors } })),
}));
