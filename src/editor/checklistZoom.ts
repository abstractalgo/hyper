/**
 * Lexical's CheckListPlugin toggles an item when a press lands within its `::before` box, comparing
 * the press's screen x with the box's unscaled CSS width. Notes sit inside React Flow's scaled
 * viewport, so on screen the box is wider or narrower than that: zoomed in, half the box misses;
 * zoomed out, the start of the text toggles too.
 *
 * Listening on an ancestor in the capture phase (ahead of Lexical's listeners on the editor root),
 * this rewrites the x of presses on check list items into unscaled distance from the item's left
 * edge, which is what Lexical's comparison assumes.
 */
const EVENTS = ["pointerdown", "mousedown", "pointerup", "click"] as const;

function unscale(event: MouseEvent) {
  const item = event.target;
  if (!(item instanceof HTMLLIElement) || !item.hasAttribute("aria-checked")) {
    return;
  }
  const rect = item.getBoundingClientRect();
  const scale = item.offsetWidth ? rect.width / item.offsetWidth : 1;
  if (scale === 1) return;
  Object.defineProperty(event, "clientX", {
    value: rect.left + (event.clientX - rect.left) / scale,
  });
}

export function fixChecklistZoom(container: HTMLElement) {
  for (const type of EVENTS) container.addEventListener(type, unscale, { capture: true });
  return () => {
    for (const type of EVENTS) container.removeEventListener(type, unscale, { capture: true });
  };
}
