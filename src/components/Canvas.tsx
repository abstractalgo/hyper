import { Background, BackgroundVariant, Controls, useReactFlow } from "@xyflow/react";
import { useState, type MouseEvent } from "react";
import { useShallow } from "zustand/react/shallow";

import { NOTE_WIDTH, useCanvasStore } from "../store/canvas";
import { CommandPalette } from "./CommandPalette";
import { NoteCanvas } from "./NoteCanvas";

/** Approximate rendered height of a note's title bar, used to center new notes on the cursor. */
const TITLE_BAR_HEIGHT = 34;

/** The main canvas: every note in the workspace, where the workspace's layout places it. */
export function Canvas() {
  const noteIds = useCanvasStore(useShallow((s) => s.notes.map((n) => n.id)));
  const { layout, placeNotes, deleteNotes, setHeights, addNode, setViewport } = useCanvasStore(
    useShallow((s) => ({
      layout: s.layout,
      placeNotes: s.placeNotes,
      deleteNotes: s.deleteNotes,
      setHeights: s.setHeights,
      addNode: s.addNode,
      setViewport: s.setViewport,
    })),
  );
  const { screenToFlowPosition } = useReactFlow();
  // Only the viewport saved at load matters; React Flow owns it from then on.
  const [savedViewport] = useState(() => useCanvasStore.getState().viewport);

  // Double-clicking empty canvas (the pane itself, not a note or control) adds a note there,
  // with its title bar centered under the cursor.
  const handleDoubleClick = (e: MouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.classList.contains("react-flow__pane")) {
      return;
    }
    const { x, y } = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addNode({ x: x - NOTE_WIDTH / 2, y: y - TITLE_BAR_HEIGHT / 2 });
  };

  return (
    <NoteCanvas
      noteIds={noteIds}
      layout={layout}
      onPlace={placeNotes}
      onDeleteNotes={deleteNotes}
      onMeasure={setHeights}
      // Restore the saved pan/zoom; save it again whenever a pan or zoom ends (a natural
      // debounce: once per gesture, not per frame). Without a saved one, fit all notes.
      defaultViewport={savedViewport ?? undefined}
      onMoveEnd={(_, viewport) => setViewport(viewport)}
      onDoubleClick={handleDoubleClick}
      fitView={!savedViewport}
      fitViewOptions={{ maxZoom: 1 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} />
      <Controls showInteractive={false} showZoom={false} />
      <CommandPalette />
    </NoteCanvas>
  );
}
