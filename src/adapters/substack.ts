import type { SubstackContentType } from "../types.js";

export function isSubstackHost(hostname: string): boolean {
  return hostname === "substack.com" || hostname.endsWith(".substack.com");
}

export function detectSubstackContentType(url: URL): SubstackContentType | null {
  if (!isSubstackHost(url.hostname)) {
    return null;
  }

  if (url.hostname === "substack.com") {
    return /^\/@[^/]+\/p-\d+\/?$/.test(url.pathname) ? "post" : null;
  }

  return /^\/p\/[^/]+\/?$/.test(url.pathname) ? "post" : null;
}
