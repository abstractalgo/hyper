import { autoLinkEmailMatcher, autoLinkUrlMatcher, formatUrl } from "@lexical/link";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Rejects `javascript:` and other unsafe schemes so pasted/typed links can't run code. */
export function isSafeUrl(url: string): boolean {
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** Normalizes user input (e.g. `example.com` → `https://example.com`), or returns null if unusable. */
export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const url = formatUrl(trimmed);
  return isSafeUrl(url) ? url : null;
}

export const AUTO_LINK_MATCHERS = [autoLinkUrlMatcher, autoLinkEmailMatcher];
