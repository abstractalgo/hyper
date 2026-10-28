import { useStore } from "@xyflow/react";
import { createContext, useContext } from "react";

/**
 * Where pickers and menus portal to. Inside notes this is React Flow's viewport layer, so popups
 * pan and zoom with the canvas; elsewhere (the settings dialog) it's `document.body`.
 */
export const PopupContainerContext = createContext<HTMLElement | null | undefined>(undefined);

export const usePopupContainer = () => useContext(PopupContainerContext);

/** React Flow's in-viewport portal layer (null until the canvas has mounted). */
export const useViewportPortal = () =>
  useStore((s) => s.domNode?.querySelector<HTMLElement>(".react-flow__viewport-portal") ?? null);

/**
 * For Positioner elements. The viewport disables pointer events; the z-index clears selected
 * notes (1000) and the settings dialog; the `no*` classes keep the canvas from panning/zooming.
 */
export const POSITIONER_CLASS = "nopan nowheel nodrag pointer-events-auto z-[2000]";

export const POPUP_CLASS =
  "rounded-md border border-gray-200 bg-white text-sm text-gray-800 shadow-lg outline-none";
