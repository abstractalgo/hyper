import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { create } from "zustand";

export type EditorNodeData = {
  title: string;
  /** Serialized Lexical editor state (JSON), or null for an empty editor. */
  content: string | null;
};

export type EditorNode = Node<EditorNodeData, "editor">;

type CanvasState = {
  nodes: EditorNode[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange<EditorNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (position: XYPosition) => void;
  updateNodeData: (id: string, data: Partial<EditorNodeData>) => void;
};

const newNoteId = () => crypto.randomUUID();

const firstId = newNoteId();
const secondId = newNoteId();

const initialNodes: EditorNode[] = [
  {
    id: firstId,
    type: "editor",
    position: { x: 0, y: 0 },
    data: { title: "Note 1", content: null },
  },
  {
    id: secondId,
    type: "editor",
    position: { x: 420, y: 120 },
    data: { title: "Note 2", content: null },
  },
];

// Only used to suggest a default title; IDs are random and never reused.
let noteCounter = initialNodes.length;

export const useCanvasStore = create<CanvasState>()((set) => ({
  nodes: initialNodes,
  edges: [{ id: `e-${firstId}-${secondId}`, source: firstId, target: secondId }],
  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (connection) => set((s) => ({ edges: addEdge(connection, s.edges) })),
  addNode: (position) => {
    const id = newNoteId();
    const title = `Note ${++noteCounter}`;
    set((s) => ({
      nodes: [...s.nodes, { id, type: "editor", position, data: { title, content: null } }],
    }));
  },
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),
}));
