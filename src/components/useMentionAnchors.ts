import { useStoreApi } from "@xyflow/react";
import { useLayoutEffect, useState, type RefObject } from "react";

import type { MentionAnchor } from "../store/canvas.ts";

/** Attribute set on each rendered mention whose target note exists (see NoteMention). */
export const MENTION_TARGET_ATTR = "data-mention-target";

/** Handle ID for the `index`-th mention in a note, in document order. */
export const mentionHandleId = (index: number) => `mention-${index}`;

/** The note containing a rendered mention element, and the ID of that mention's handle. */
export function locateMention(el: Element): { sourceId: string; handleId: string } | null {
  const node = el.closest<HTMLElement>(".react-flow__node");
  const sourceId = node?.dataset.id;
  if (!node || !sourceId) return null;
  const index = Array.from(node.querySelectorAll(`[${MENTION_TARGET_ATTR}]`)).indexOf(el);
  return index < 0 ? null : { sourceId, handleId: mentionHandleId(index) };
}

/** Smallest height a note can be resized to, mentions or not. */
export const MIN_NOTE_HEIGHT = 120;

/** Space kept below the lowest mention: the editor's bottom padding plus the note's border. */
const BOTTOM_CLEARANCE = 12;

const sameAnchors = (a: MentionAnchor[], b: MentionAnchor[]) =>
  a.length === b.length &&
  a.every(
    (x, i) => x.targetId === b[i]!.targetId && x.handleId === b[i]!.handleId && x.y === b[i]!.y,
  );

/**
 * Tracks the vertical position of every `@mention` inside a note.
 *
 * Re-measures whenever the editor DOM changes (typing, mentions moving, a mentioned note
 * being renamed), the note is resized, or its content is scrolled. Mentions scrolled out
 * of view are pinned to the top/bottom of the visible content area.
 *
 * Also returns the minimum height that keeps the lowest mention (and so its handle)
 * inside the note without scrolling.
 */
export function useMentionAnchors(
  rootRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
): { anchors: MentionAnchor[]; minHeight: number } {
  const [anchors, setAnchors] = useState<MentionAnchor[]>([]);
  const [minHeight, setMinHeight] = useState(MIN_NOTE_HEIGHT);
  const store = useStoreApi();

  useLayoutEffect(() => {
    const root = rootRef.current;
    const content = contentRef.current;
    if (!root || !content) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      // Client rects are scaled by the viewport zoom; handles are positioned in flow pixels.
      const zoom = store.getState().transform[2];
      // Absolutely positioned handles are offset from the padding box, inside the border.
      const rootRect = root.getBoundingClientRect();
      const rootTop = rootRect.top + root.clientTop * zoom;
      const view = content.getBoundingClientRect();
      let lowestBottom = 0;
      const next = Array.from(
        content.querySelectorAll<HTMLElement>(`[${MENTION_TARGET_ATTR}]`),
        (el, i): MentionAnchor => {
          const rect = el.getBoundingClientRect();
          // Unscrolled position, measured from the note's outer edge (node height includes the border).
          lowestBottom = Math.max(
            lowestBottom,
            (rect.bottom - rootRect.top) / zoom + content.scrollTop,
          );
          const mid = Math.min(Math.max(rect.top + rect.height / 2, view.top), view.bottom);
          return {
            handleId: mentionHandleId(i),
            targetId: el.getAttribute(MENTION_TARGET_ATTR)!,
            y: Math.round((mid - rootTop) / zoom),
          };
        },
      );
      setAnchors((prev) => (sameAnchors(prev, next) ? prev : next));
      setMinHeight(Math.max(MIN_NOTE_HEIGHT, Math.ceil(lowestBottom + BOTTOM_CLEARANCE)));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const mutations = new MutationObserver(schedule);
    mutations.observe(content, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    const resizes = new ResizeObserver(schedule);
    resizes.observe(root);
    content.addEventListener("scroll", schedule, { passive: true });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
      content.removeEventListener("scroll", schedule);
    };
  }, [rootRef, contentRef, store]);

  return { anchors, minHeight };
}
