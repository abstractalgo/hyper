import { createContext, useContext } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import type { Layout } from "../store/canvas";

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
export type MentionLink = {
  sourceId: string;
  handleId: string;
  targetId: string;
};

/** What a click has highlighted: one link, or every link coming into a note. */
type Highlight = { kind: "link"; link: MentionLink } | { kind: "incoming"; noteId: string };

/**
 * React Flow's class names for "don't drag, pan or zoom the canvas from here". React Flow looks
 * for them on every ancestor of what's under the pointer, past its own canvas, so a canvas inside
 * a note gets names of its own: the canvas it's in then doesn't switch off its dragging, panning
 * and zooming (and its own markers don't switch off the outer canvas's).
 */
export type FlowClasses = { noDrag: string; noPan: string; noWheel: string };

/** React Flow's own names, for the main canvas. */
export const DEFAULT_FLOW_CLASSES: FlowClasses = {
  noDrag: "nodrag",
  noPan: "nopan",
  noWheel: "nowheel",
};

/**
 * One canvas's own state: where its notes are, the `@mention` links between them, and which of
 * those are highlighted. Every canvas has its own (the main one, and each canvas view in a note),
 * so nothing here leaks into another canvas, even when they show the same notes.
 */
export type CanvasViewState = {
  /** This canvas's class names for "don't drag, pan or zoom from here". */
  classes: FlowClasses;
  /** Placements as shown, including notes being dragged or resized. */
  layout: Layout;
  /** Where each note's mentions are, by note ID. Links are derived from these. */
  anchors: Record<string, MentionAnchor[]>;
  /** The mention under the pointer: highlights its link and the note it mentions. */
  hoveredMention: MentionLink | null;
  /** Set by clicking a link or a note's incoming handle; cleared by clicking elsewhere. */
  highlight: Highlight | null;
  setLayout: (layout: Layout) => void;
  setAnchors: (noteId: string, anchors: MentionAnchor[]) => void;
  setHoveredMention: (mention: MentionLink | null) => void;
  setHighlight: (highlight: Highlight | null) => void;
};

/** Whether `link` is a link of this canvas: both notes are on it, and the mention is still there. */
const isLink = (s: Pick<CanvasViewState, "layout" | "anchors">, link: MentionLink) =>
  link.sourceId in s.layout &&
  link.targetId in s.layout &&
  (s.anchors[link.sourceId]?.some(
    (a) => a.handleId === link.handleId && a.targetId === link.targetId,
  ) ??
    false);

/** A highlight, unless it points at notes or mentions no longer on the canvas. */
function pruned(s: Pick<CanvasViewState, "layout" | "anchors" | "highlight">): Highlight | null {
  const h = s.highlight;
  if (h?.kind === "incoming") {
    return h.noteId in s.layout ? h : null;
  }
  return h && isLink(s, h.link) ? h : null;
}

export function createCanvasView(
  classes: FlowClasses = DEFAULT_FLOW_CLASSES,
): StoreApi<CanvasViewState> {
  return createStore<CanvasViewState>((set) => ({
    classes,
    layout: {},
    anchors: {},
    hoveredMention: null,
    highlight: null,
    // Notes that left the canvas take their mentions and highlights with them.
    setLayout: (layout) =>
      set((s) => {
        const anchors = Object.fromEntries(
          Object.entries(s.anchors).filter(([noteId]) => noteId in layout),
        );
        return { layout, anchors, highlight: pruned({ ...s, layout, anchors }) };
      }),
    // A clicked link goes away when its mention is deleted or retyped to another note.
    setAnchors: (noteId, noteAnchors) =>
      set((s) => {
        const anchors = { ...s.anchors, [noteId]: noteAnchors };
        return { anchors, highlight: pruned({ ...s, anchors }) };
      }),
    setHoveredMention: (hoveredMention) => set({ hoveredMention }),
    setHighlight: (highlight) => set({ highlight }),
  }));
}

/** Whether the link is highlighted: its mention is hovered, it was clicked, or its target was. */
export function isLinkHighlighted(
  s: Pick<CanvasViewState, "hoveredMention" | "highlight">,
  link: MentionLink,
): boolean {
  const same = (other: MentionLink | null | undefined) =>
    other?.sourceId === link.sourceId && other.handleId === link.handleId;
  const h = s.highlight;
  return (
    same(s.hoveredMention) ||
    (h?.kind === "link" && same(h.link)) ||
    (h?.kind === "incoming" && h.noteId === link.targetId)
  );
}

/**
 * Whether a note is highlighted: the target of the hovered mention, either end of a clicked link,
 * or the source of a link into the note whose incoming handle was clicked.
 */
export function isNoteHighlighted(s: CanvasViewState, noteId: string): boolean {
  const h = s.highlight;
  return (
    s.hoveredMention?.targetId === noteId ||
    (h?.kind === "link" && (h.link.sourceId === noteId || h.link.targetId === noteId)) ||
    (h?.kind === "incoming" &&
      h.noteId !== noteId &&
      (s.anchors[noteId]?.some((a) => a.targetId === h.noteId) ?? false))
  );
}

export const CanvasViewContext = createContext<StoreApi<CanvasViewState> | null>(null);

/** Outside any canvas (e.g. headless), a canvas of its own, with nothing on it. */
const NO_CANVAS = createCanvasView();

/** Part of the state of the canvas a component is in. Re-renders only when that part changes. */
export function useCanvasView<T>(selector: (s: CanvasViewState) => T): T {
  return useStore(useContext(CanvasViewContext) ?? NO_CANVAS, selector);
}

/** The class names of the canvas a component is in (see FlowClasses). */
export const useFlowClasses = () => useCanvasView((s) => s.classes);

/**
 * The notes whose text the current view is in, outermost first. A canvas view leaves them out,
 * so a note never shows inside itself (and views can't nest forever).
 */
export const AncestorsContext = createContext<readonly string[]>([]);
