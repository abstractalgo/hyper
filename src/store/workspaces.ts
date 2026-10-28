import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Samples a new workspace can start from (built the first time it's opened). */
export type SampleId = "ledgerly" | "research" | "group-theory";

type Workspace = {
  id: string;
  name: string;
  /** Fills the board the first time it's opened; without one, it starts empty. */
  sample?: SampleId;
};

/** Each workspace's board (notes, fields, types, icons, viewport) is saved under its own key. */
export const boardKey = (workspaceId: string) => `hyper-board:${workspaceId}`;

const INDEX_KEY = "hyper-workspaces";
const INDEX_VERSION = 1;

const groupTheoryWorkspace = (): Workspace => ({
  id: crypto.randomUUID(),
  name: "Group theory",
  sample: "group-theory",
});

/**
 * The workspaces on a first visit (with no saved index yet), saved right away. Before there were
 * workspaces, the one board was saved as `hyper-board`; that board becomes the first workspace
 * instead of the Ledgerly sample.
 */
function firstVisit(): Pick<WorkspacesState, "workspaces" | "activeId"> {
  // Hydration replaces this with the saved index.
  if (localStorage.getItem(INDEX_KEY) !== null) return { workspaces: [], activeId: "" };
  const savedBoard = localStorage.getItem("hyper-board");
  const workspaces: Workspace[] = [
    { id: crypto.randomUUID(), name: "Ledgerly", ...(!savedBoard && { sample: "ledgerly" }) },
    { id: crypto.randomUUID(), name: "Thesis research", sample: "research" },
    groupTheoryWorkspace(),
    { id: crypto.randomUUID(), name: "Empty workspace" },
  ];
  const index = { workspaces, activeId: workspaces[0]!.id };
  // The index is saved before the old board is removed, so neither can be lost.
  localStorage.setItem(INDEX_KEY, JSON.stringify({ state: index, version: INDEX_VERSION }));
  if (savedBoard) {
    localStorage.setItem(boardKey(index.activeId), savedBoard);
    localStorage.removeItem("hyper-board");
  }
  return index;
}

type WorkspacesState = {
  workspaces: Workspace[];
  activeId: string;
  /** Adds an empty workspace (not opened); returns its ID. */
  create: (name: string) => string;
  rename: (id: string, name: string) => void;
  /** Removes a workspace from the list (see `deleteWorkspace`, which also deletes its board). */
  remove: (id: string) => void;
  setActive: (id: string) => void;
};

export const useWorkspaces = create<WorkspacesState>()(
  persist(
    (set) => ({
      ...firstVisit(),
      create: (name) => {
        const id = crypto.randomUUID();
        set((s) => ({ workspaces: [...s.workspaces, { id, name }] }));
        return id;
      },
      rename: (id, name) =>
        set((s) => ({ workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)) })),
      remove: (id) => set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),
      setActive: (activeId) => set({ activeId }),
    }),
    {
      name: INDEX_KEY,
      version: INDEX_VERSION,
      // Indexes saved before the group theory sample get it added, once.
      migrate: (saved) => {
        const index = saved as Pick<WorkspacesState, "workspaces" | "activeId">;
        return { ...index, workspaces: [...index.workspaces, groupTheoryWorkspace()] };
      },
      partialize: ({ workspaces, activeId }) => ({ workspaces, activeId }),
    },
  ),
);

export const activeWorkspace = () => {
  const { workspaces, activeId } = useWorkspaces.getState();
  return workspaces.find((w) => w.id === activeId) ?? workspaces[0]!;
};
