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

const initialNodes: EditorNode[] = [
  {
    id: "1",
    type: "editor",
    position: { x: 0, y: 0 },
    data: { title: "Note 1", content: null },
  },
  {
    id: "2",
    type: "editor",
    position: { x: 420, y: 120 },
    data: { title: "Note 2", content: null },
  },
];

let nextId = initialNodes.length + 1;

export const useCanvasStore = create<CanvasState>()((set) => ({
  nodes: initialNodes,
  edges: [{ id: "e1-2", source: "1", target: "2" }],
  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  onConnect: (connection) => set((s) => ({ edges: addEdge(connection, s.edges) })),
  addNode: (position) => {
    const id = String(nextId++);
    set((s) => ({
      nodes: [
        ...s.nodes,
        { id, type: "editor", position, data: { title: `Note ${id}`, content: null } },
      ],
    }));
  },
  updateNodeData: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)),
    })),
}));
