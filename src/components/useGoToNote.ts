import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useCallback } from "react";

import { useCanvasStore } from "../store/canvas";

/**
 * Returns a function that pans the canvas so a note is centered (keeping the zoom level) and
 * selects it, as clicking a mention or picking a note in the command palette does.
 */
export function useGoToNote() {
  const { getInternalNode, getZoom, setCenter } = useReactFlow();
  const flowStore = useStoreApi();
  const setHighlight = useCanvasStore((s) => s.setHighlight);

  return useCallback(
    (noteId: string) => {
      const node = getInternalNode(noteId);
      if (!node) {
        return;
      }
      const { x, y } = node.internals.positionAbsolute;
      const { width = 0, height = 0 } = node.measured;
      void setCenter(x + width / 2, y + height / 2, { zoom: getZoom(), duration: 300 });
      flowStore.getState().addSelectedNodes([noteId]);
      // Selecting by clicking a note clears link highlights; do the same here.
      setHighlight(null);
    },
    [getInternalNode, getZoom, setCenter, flowStore, setHighlight],
  );
}
