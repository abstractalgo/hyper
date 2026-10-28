import type { StateStorage } from "zustand/middleware";

/**
 * localStorage, but writes are batched: the store changes on every keystroke and every frame of
 * a drag, and each write serializes the whole board. Pending writes are flushed when the page is
 * hidden or closed, so nothing is lost.
 */
export function debouncedLocalStorage(delayMs = 500): StateStorage {
  const pending = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    for (const [key, value] of pending) localStorage.setItem(key, value);
    pending.clear();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    getItem: (key) => pending.get(key) ?? localStorage.getItem(key),
    setItem: (key, value) => {
      pending.set(key, value);
      clearTimeout(timer);
      timer = setTimeout(flush, delayMs);
    },
    removeItem: (key) => {
      pending.delete(key);
      localStorage.removeItem(key);
    },
  };
}
