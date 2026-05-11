import { substackSourceAdapter } from "../adapters/substack.js";
import { zhihuSourceAdapter } from "../adapters/zhihu.js";
import type {
  MetadataInput,
  MetadataResult,
  ParseInput,
  ParseResult,
  SourceIdentity,
} from "../types.js";
import type { SourceAdapter } from "../adapters/contracts.js";

type ResolvedSource =
  | {
    adapter: SourceAdapter<SourceIdentity>;
    source: SourceIdentity;
  }
  | null;

function parseSourceUrl(sourceUrl: string): URL | null {
  try {
    return new URL(sourceUrl);
  } catch {
    return null;
  }
}

function resolveSource(url: URL): ResolvedSource {
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

function buildUnsupportedSiteResult(url: URL): Pick<ParseResult, "ok" | "reason" | "errorCode"> {
  return {
    ok: false,
    reason: `unsupported site for url: ${url.hostname}${url.pathname}`,
    errorCode: "E_PARSE_UNSUPPORTED_SITE",
  };
}

export async function parseHtmlToMarkdown(input: ParseInput): Promise<ParseResult> {
  const url = parseSourceUrl(input.sourceUrl);
  if (!url) {
    return {
      ok: false,
      reason: "invalid sourceUrl",
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const resolved = resolveSource(url);
  if (!resolved?.adapter.markdown) {
    return buildUnsupportedSiteResult(url);
  }

  return resolved.adapter.markdown.parseMarkdown({
    ...input,
    source: resolved.source,
  });
}

export async function parseHtmlToMetadata(input: MetadataInput): Promise<MetadataResult> {
  const url = parseSourceUrl(input.sourceUrl);
  if (!url) {
    return {
      ok: false,
      reason: "invalid sourceUrl",
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const resolved = resolveSource(url);
  if (!resolved?.adapter.metadata) {
    return buildUnsupportedSiteResult(url);
  }

  return resolved.adapter.metadata.parseMetadata({
    ...input,
    source: resolved.source,
  });
}
