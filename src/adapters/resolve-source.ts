import { substackSourceAdapter } from "./substack.js";
import { zhihuSourceAdapter } from "./zhihu.js";
import type { SourceAdapter } from "./contracts.js";
import type { SourceIdentity } from "../types.js";

export type ResolvedSource =
  | {
    adapter: SourceAdapter<SourceIdentity>;
    source: SourceIdentity;
  }
  | null;

export function parseSourceUrl(sourceUrl: string): URL | null {
  try {
    return new URL(sourceUrl);
  } catch {
    return null;
  }
}

export function resolveSource(url: URL): ResolvedSource {
  const zhihuSource = zhihuSourceAdapter.detect(url);
  if (zhihuSource) {
    return {
      adapter: zhihuSourceAdapter as SourceAdapter<SourceIdentity>,
      source: zhihuSource,
    };
  }

  const substackSource = substackSourceAdapter.detect(url);
  if (substackSource) {
    return {
      adapter: substackSourceAdapter as SourceAdapter<SourceIdentity>,
      source: substackSource,
    };
  }

  return null;
}
