import { autoLinkEmailMatcher, autoLinkUrlMatcher } from "@lexical/link";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** Rejects `javascript:` and other unsafe schemes so pasted/typed links can't run code. */
export function isSafeUrl(url: string): boolean {
  try {
    return SAFE_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export const AUTO_LINK_MATCHERS = [autoLinkUrlMatcher, autoLinkEmailMatcher];
