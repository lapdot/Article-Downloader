import { parseSourceUrl, resolveSource } from "../adapters/resolve-source.js";
import { enrichMetadataWithAuthor } from "./author.js";
import type {
  MetadataInput,
  MetadataResult,
  ParseInput,
  ParseResult,
} from "../types.js";

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

  const result = await resolved.adapter.markdown.parseMarkdown({
    ...input,
    source: resolved.source,
  });
  return result.source ? result : { ...result, source: resolved.source };
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

  const result = await resolved.adapter.metadata.parseMetadata({
    ...input,
    source: resolved.source,
  });
  const resultWithSource = result.source ? result : { ...result, source: resolved.source };
  if (!input.authorWhitelist || !resultWithSource.ok || !resultWithSource.metadata) {
    return resultWithSource;
  }
  return {
    ...resultWithSource,
    metadata: enrichMetadataWithAuthor({
      metadata: resultWithSource.metadata,
      sourceUrl: input.sourceUrl,
      source: resultWithSource.source,
      whitelist: input.authorWhitelist,
    }),
  };
}
