import { useStoreApi } from "@xyflow/react";
import { useLayoutEffect, useState, type RefObject } from "react";

import type { MentionAnchor } from "../store/canvas";

/** Attribute set on each rendered mention whose target note exists (see NoteMention). */
const MENTION_TARGET_ATTR = "data-mention-target";

/** Handle ID for the `index`-th mention in a note, in document order. */
const mentionHandleId = (index: number) => `mention-${index}`;

/** The note containing a rendered mention element, and the ID of that mention's handle. */
export function locateMention(el: Element): { sourceId: string; handleId: string } | null {
  const node = el.closest<HTMLElement>(".react-flow__node");
  const sourceId = node?.dataset.id;
  if (!node || !sourceId) return null;
  const index = Array.from(node.querySelectorAll(`[${MENTION_TARGET_ATTR}]`)).indexOf(el);
  return index < 0 ? null : { sourceId, handleId: mentionHandleId(index) };
}

const sameAnchors = (a: MentionAnchor[], b: MentionAnchor[]) =>
  a.length === b.length &&
  a.every(
    (x, i) => x.targetId === b[i]!.targetId && x.handleId === b[i]!.handleId && x.y === b[i]!.y,
  );

/**
 * Tracks the vertical position of every `@mention` inside a note.
 *
 * Re-measures whenever the editor DOM changes (typing, mentions moving, a mentioned note
 * being renamed) or the note is resized (text re-wraps).
 */
export function useMentionAnchors(
  rootRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
): MentionAnchor[] {
  const [anchors, setAnchors] = useState<MentionAnchor[]>([]);
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
      const rootTop = root.getBoundingClientRect().top + root.clientTop * zoom;
      const next = Array.from(
        content.querySelectorAll<HTMLElement>(`[${MENTION_TARGET_ATTR}]`),
        (el, i): MentionAnchor => {
          const rect = el.getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          return {
            handleId: mentionHandleId(i),
            targetId: el.getAttribute(MENTION_TARGET_ATTR)!,
            y: Math.round((mid - rootTop) / zoom),
          };
        },
      );
      setAnchors((prev) => (sameAnchors(prev, next) ? prev : next));
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
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
    };
  }, [rootRef, contentRef, store]);

  return anchors;
}
