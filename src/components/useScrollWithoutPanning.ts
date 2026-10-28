import { useEffect, type RefObject } from "react";

/** Mark an element inside a note with this attribute to have it scroll instead of the canvas. */
export const LOCAL_SCROLL_ATTR = "data-local-scroll";

/**
 * Keeps plain wheel/trackpad scrolling inside `[data-local-scroll]` areas of `rootRef` from
 * reaching React Flow, so it scrolls that area instead of panning/zooming the canvas, while
 * letting pinch-zoom through.
 *
 * React Flow's `nowheel` class would block pinch too: browsers report a trackpad pinch as a
 * wheel event with `ctrlKey` set. A native listener is needed because React's own handlers run
 * at the root, after React Flow's listener on the pane has already seen the event.
 */
export function useScrollWithoutPanning(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && e.target instanceof Element && e.target.closest(`[${LOCAL_SCROLL_ATTR}]`)) {
        e.stopPropagation();
      }
    };
    root.addEventListener("wheel", onWheel, { passive: true });
    return () => root.removeEventListener("wheel", onWheel);
  }, [rootRef]);
}
