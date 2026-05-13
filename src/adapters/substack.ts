import { load } from "cheerio";
import { buildMarkdownLink, buildMarkdownResult, createTurndownService } from "./parser-support.js";
import type { FetchNormalizationContext, SourceAdapter } from "./contracts.js";
import type {
  DownloadResult,
  MetadataInput,
  MetadataResult,
  ParseInput,
  ParseResult,
  SubstackContentType,
  SubstackSourceIdentity,
} from "../types.js";

interface StructuredDataAuthor {
  name?: string;
  url?: string;
}

interface StructuredDataArticle {
  "@type"?: string | string[];
  url?: string;
  mainEntityOfPage?: string;
  headline?: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  author?: StructuredDataAuthor | StructuredDataAuthor[];
}

interface SubstackPreloadByline {
  name?: string;
  handle?: string;
}

interface SubstackPreloadPost {
  canonical_url?: string;
  post_date?: string;
  updated_at?: string;
  subtitle?: string;
  title?: string;
  body_html?: string;
}

interface SubstackPreloadData {
  post?: SubstackPreloadPost;
  canonicalUrl?: string;
  ogUrl?: string;
  publishedBylines?: SubstackPreloadByline[];
}

interface SubstackShellPreloadData {
  id?: number;
  publication_id?: number;
  subdomain?: string;
  hostname?: string;
  base_url?: string;
  canonicalUrl?: string;
  ogUrl?: string;
  feedData?: {
    initialPost?: {
      post?: SubstackPostsLookupEntry;
    };
  };
  [key: string]: unknown;
}

interface SubstackPostsLookupEntry {
  id?: number;
  canonical_url?: string;
  title?: string;
  subtitle?: string;
  body_html?: string;
  post_date?: string;
  updated_at?: string;
  publishedBylines?: SubstackPreloadByline[];
}

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

export function detectSubstackSource(url: URL): SubstackSourceIdentity | null {
  const contentType = detectSubstackContentType(url);
  if (!contentType) {
    return null;
  }
  return {
    sourceId: "substack",
    contentType,
  };
}

function getSubstackAggregatorPostId(urlString: string): string | null {
  try {
    const url = new URL(urlString);
    if (url.hostname !== "substack.com") {
      return null;
    }
    const match = url.pathname.match(/^\/@[^/]+\/p-(\d+)\/?$/u);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function parseSubstackShellPreloadData(html: string): SubstackShellPreloadData | null {
  const match = html.match(/window\._preloads\s*=\s*JSON\.parse\("([\s\S]*?)"\)/u);
  if (!match) {
    return null;
  }

  try {
    const jsonString = JSON.parse(`"${match[1]}"`) as string;
    return JSON.parse(jsonString) as SubstackShellPreloadData;
  } catch {
    return null;
  }
}

function getSubstackLookupContext(html: string): { publicationId: number; baseUrl: string } | null {
  const preload = parseSubstackShellPreloadData(html);
  if (!preload) {
    return null;
  }

  const visited = new Set<unknown>();

  function resolveFromNode(node: unknown): { publicationId: number; baseUrl: string } | null {
    if (!node || typeof node !== "object") {
      return null;
    }
    if (visited.has(node)) {
      return null;
    }
    visited.add(node);

    if (Array.isArray(node)) {
      for (const entry of node) {
        const resolved = resolveFromNode(entry);
        if (resolved) {
          return resolved;
        }
      }
      return null;
    }

    const record = node as Record<string, unknown>;
    const baseUrlFromRecord =
      typeof record.base_url === "string" && record.base_url.startsWith("https://")
        ? record.base_url
        : undefined;
    const hostname =
      typeof record.hostname === "string" && record.hostname.endsWith(".substack.com")
        ? record.hostname
        : undefined;
    const subdomain =
      typeof record.subdomain === "string" && record.subdomain.trim()
        ? record.subdomain.trim()
        : undefined;
    const baseUrlFromHostname = hostname ? `https://${hostname}` : undefined;
    const baseUrlFromSubdomain = subdomain ? `https://${subdomain}.substack.com` : undefined;
    const baseUrl = [baseUrlFromRecord, baseUrlFromHostname, baseUrlFromSubdomain]
      .find((value) => typeof value === "string" && value.endsWith(".substack.com"));
    const publicationId =
      typeof record.publication_id === "number"
        ? record.publication_id
        : typeof record.id === "number" && (typeof record.subdomain === "string" || typeof record.hostname === "string")
          ? record.id
          : undefined;
    if (baseUrl && publicationId) {
      return { baseUrl, publicationId };
    }

    for (const value of Object.values(record)) {
      const resolved = resolveFromNode(value);
      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  const resolved = resolveFromNode(preload);
  if (!resolved?.baseUrl || !resolved.publicationId || !Number.isFinite(resolved.publicationId)) {
    return null;
  }

  return {
    publicationId: resolved.publicationId,
    baseUrl: resolved.baseUrl,
  };
}

function getSubstackInitialPostEntry(html: string): SubstackPostsLookupEntry | null {
  const preload = parseSubstackShellPreloadData(html);
  const post = preload?.feedData?.initialPost?.post;
  if (!post || typeof post !== "object") {
    return null;
  }

  return post;
}

function parseSubstackPostsLookupEntry(
  payload: string,
  expectedPostId: string,
): SubstackPostsLookupEntry | null {
  try {
    const parsed = JSON.parse(payload) as SubstackPostsLookupEntry[];
    if (!Array.isArray(parsed)) {
      return null;
    }

    const exactMatch = parsed.find((candidate) => String(candidate?.id ?? "") === expectedPostId);
    if (exactMatch) {
      return exactMatch;
    }

    // Some newer Substack aggregator urls resolve to a single canonical post entry
    // whose API id differs from the numeric suffix in the shell url.
    if (parsed.length === 1 && parsed[0]?.canonical_url?.trim()) {
      return parsed[0];
    }

    return null;
  } catch {
    return null;
  }
}

function getCanonicalUrlFromSubstackPostsLookupEntry(
  entry: SubstackPostsLookupEntry | null,
): string | null {
  try {
    const canonicalUrl = entry?.canonical_url?.trim();
    if (!canonicalUrl) {
      return null;
    }

    return new URL(canonicalUrl).toString();
  } catch {
    return null;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function buildSyntheticSubstackHtml(
  entry: SubstackPostsLookupEntry,
  canonicalUrl: string,
): string | null {
  const title = entry.title?.trim();
  const bodyHtml = entry.body_html?.trim();
  const publishTime = entry.post_date?.trim();
  const primaryByline = entry.publishedBylines?.[0];
  const authorName = primaryByline?.name?.trim();
  const authorHandle = primaryByline?.handle?.trim();

  if (!title || !bodyHtml || !publishTime || !authorName || !authorHandle) {
    return null;
  }

  const subtitle = entry.subtitle?.trim() ?? "";
  const authorHomepage = `https://substack.com/@${authorHandle}`;
  const preload = {
    post: {
      canonical_url: canonicalUrl,
      post_date: publishTime,
      updated_at: entry.updated_at?.trim() || publishTime,
      subtitle,
      title,
      body_html: bodyHtml,
    },
    canonicalUrl,
    ogUrl: canonicalUrl,
    publishedBylines: [
      {
        name: authorName,
        handle: authorHandle,
      },
    ],
  };
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    headline: title,
    description: subtitle || undefined,
    datePublished: publishTime,
    dateModified: entry.updated_at?.trim() || publishTime,
    author: {
      name: authorName,
      url: authorHomepage,
    },
  };
  const preloadLiteral = JSON.stringify(JSON.stringify(preload));

  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtmlText(title)} - by ${escapeHtmlText(authorName)}</title>
    <link rel="canonical" href="${escapeHtmlAttribute(canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtmlAttribute(title)}" />
    <meta property="og:url" content="${escapeHtmlAttribute(canonicalUrl)}" />
    <meta name="author" content="${escapeHtmlAttribute(authorName)}" />
    <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
    <script>window._preloads = JSON.parse(${preloadLiteral});</script>
  </head>
  <body>
    <article>
      <h1 class="post-title">${escapeHtmlText(title)}</h1>
      ${subtitle ? `<h3 class="subtitle">${escapeHtmlText(subtitle)}</h3>` : ""}
      <div class="byline-wrapper">
        <a href="${escapeHtmlAttribute(authorHomepage)}">${escapeHtmlText(authorName)}</a>
      </div>
      <div class="available-content">
        <div class="body markup">${bodyHtml}</div>
      </div>
    </article>
  </body>
</html>`;
}

export async function normalizeSubstackDownload(
  context: FetchNormalizationContext<SubstackSourceIdentity>,
): Promise<DownloadResult> {
  const postId = getSubstackAggregatorPostId(context.input.url);
  if (!postId || !context.initial.ok || !context.initial.html) {
    return context.initial;
  }

  const initialPostEntry = getSubstackInitialPostEntry(context.initial.html);
  const preloadedCanonicalUrl = getCanonicalUrlFromSubstackPostsLookupEntry(initialPostEntry);
  if (preloadedCanonicalUrl && preloadedCanonicalUrl !== context.input.url) {
    const normalizedResult = await context.runTransport({
      ...context.input,
      url: preloadedCanonicalUrl,
    });
    if (!normalizedResult.ok || !normalizedResult.html) {
      const syntheticHtml = initialPostEntry
        ? buildSyntheticSubstackHtml(initialPostEntry, preloadedCanonicalUrl)
        : null;
      if (syntheticHtml) {
        return {
          ok: true,
          url: context.input.url,
          downloadMethod: normalizedResult.downloadMethod,
          finalUrl: preloadedCanonicalUrl,
          html: syntheticHtml,
          fetchedAt: context.fetchedAt,
          diagnostics: {
            ...(context.initial.diagnostics ?? {}),
            normalizedFromUrl: context.input.url,
            substackSyntheticFallback: true,
            substackNormalizationSource: "preloaded-canonical",
          },
        };
      }
      return context.initial;
    }

    return {
      ...normalizedResult,
      url: context.input.url,
      finalUrl: preloadedCanonicalUrl,
      diagnostics: {
        ...(normalizedResult.diagnostics ?? {}),
        normalizedFromUrl: context.input.url,
        substackNormalizationSource: "preloaded-canonical",
      },
    };
  }

  const lookupContext = getSubstackLookupContext(context.initial.html);
  if (!lookupContext) {
    return context.initial;
  }

  const lookupUrl = `${lookupContext.baseUrl}/api/v1/posts?publication_id=${lookupContext.publicationId}&post_ids=${postId}`;
  const lookupResult = await context.runTransport({
    ...context.input,
    url: lookupUrl,
  });
  if (!lookupResult.ok || !lookupResult.html) {
    return context.initial;
  }

  const lookupEntry = parseSubstackPostsLookupEntry(lookupResult.html, postId);
  const canonicalUrl = getCanonicalUrlFromSubstackPostsLookupEntry(lookupEntry);
  if (!canonicalUrl || canonicalUrl === context.input.url) {
    return context.initial;
  }

  const normalizedResult = await context.runTransport({
    ...context.input,
    url: canonicalUrl,
  });
  if (!normalizedResult.ok || !normalizedResult.html) {
    const syntheticHtml = lookupEntry ? buildSyntheticSubstackHtml(lookupEntry, canonicalUrl) : null;
    if (syntheticHtml) {
      return {
        ok: true,
        url: context.input.url,
        downloadMethod: normalizedResult.downloadMethod,
        finalUrl: canonicalUrl,
        html: syntheticHtml,
        fetchedAt: context.fetchedAt,
        diagnostics: {
          ...(context.initial.diagnostics ?? {}),
          normalizedFromUrl: context.input.url,
          substackLookupUrl: lookupUrl,
          substackSyntheticFallback: true,
          substackNormalizationSource: "posts-lookup",
        },
      };
    }
    return context.initial;
  }

  return {
    ...normalizedResult,
    url: context.input.url,
    finalUrl: canonicalUrl,
    diagnostics: {
      ...(normalizedResult.diagnostics ?? {}),
      normalizedFromUrl: context.input.url,
      substackLookupUrl: lookupUrl,
      substackNormalizationSource: "posts-lookup",
    },
  };
}

function getSubstackTitle($: ReturnType<typeof load>): string {
  const title = $("h1.post-title, h1[data-testid='post-title']").first().text().trim()
    || $('meta[property="og:title"]').attr("content")?.trim()
    || $("title").first().text().trim().replace(/\s*-\s*by\s+.+$/u, "");
  if (!title) {
    throw new Error("title selector returned no text for substack type: post");
  }
  return title;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;");
}

function cleanSubstackContentHtml(contentHtml: string, subtitle: string): string {
  const fragment = load(`<div data-substack-root="true">${contentHtml}</div>`);
  const root = fragment("[data-substack-root='true']").first();

  root.find(".paywall-jump, [data-component-name='PaywallToDOM']").remove();
  root.find(".image-link-expand, button").remove();

  root.find("img[data-attrs]").each((_index, element) => {
    const img = fragment(element);
    const dataAttrs = img.attr("data-attrs")?.trim();
    if (!dataAttrs) {
      return;
    }

    try {
      const parsed = JSON.parse(dataAttrs) as { src?: string };
      if (parsed.src?.trim()) {
        img.attr("src", parsed.src.trim());
      }
    } catch {
      return;
    }
  });

  root.find("a").each((_index, element) => {
    const anchor = fragment(element);
    const clone = anchor.clone();
    clone.find(".image-link-expand, button").remove();
    const textOnly = clone.text().trim();
    const hasImage = clone.find("img").length > 0;
    if (hasImage && textOnly.length === 0) {
      anchor.replaceWith(anchor.html() ?? "");
    }
  });

  const cleanedHtml = root.html() ?? "";
  if (!subtitle) {
    return cleanedHtml;
  }

  return `<p>${escapeHtmlText(subtitle)}</p>${cleanedHtml}`;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function parseStructuredArticle(
  $: ReturnType<typeof load>,
): StructuredDataArticle | null {
  const candidates = $('script[type="application/ld+json"]')
    .toArray()
    .map((element) => $(element).html()?.trim() ?? "")
    .filter((value) => value.length > 0);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as StructuredDataArticle | StructuredDataArticle[];
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      const article = entries.find((entry) => {
        const type = entry["@type"];
        return Array.isArray(type) ? type.includes("NewsArticle") : type === "NewsArticle";
      });
      if (article) {
        return article;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseSubstackPreloadData(
  $: ReturnType<typeof load>,
): SubstackPreloadData | null {
  const scripts = $("script")
    .toArray()
    .map((element) => $(element).html() ?? "")
    .filter((value) => value.includes("window._preloads = JSON.parse("));

  for (const script of scripts) {
    const match = script.match(/window\._preloads\s*=\s*JSON\.parse\("([\s\S]*?)"\)/u);
    if (!match) {
      continue;
    }

    try {
      const jsonString = JSON.parse(`"${match[1]}"`) as string;
      return JSON.parse(jsonString) as SubstackPreloadData;
    } catch {
      continue;
    }
  }

  return null;
}

export async function parseSubstackMarkdown(
  input: ParseInput & { source: SubstackSourceIdentity },
): Promise<ParseResult> {
  const $ = load(input.html);
  const preload = parseSubstackPreloadData($);
  let title: string;
  try {
    title = getSubstackTitle($);
  } catch {
    title = preload?.post?.title?.trim() ?? "";
    if (!title) {
      return {
        ok: false,
        source: input.source,
        reason: "title selector returned no text for substack type: post",
        errorCode: "E_PARSE_SELECTOR",
        stats: {
          removedNodes: 0,
          selectedNodes: 0,
        },
      };
    }
  }

  const subtitle =
    $("h3.subtitle, [data-testid='subtitle']").first().text().trim()
    || preload?.post?.subtitle?.trim()
    || "";
  const contentNode = $("div.available-content div.body.markup, div.body.markup").first();
  const rawContentHtml = contentNode.html() ?? preload?.post?.body_html ?? "";
  if (!rawContentHtml.trim()) {
    return {
      ok: false,
      source: input.source,
      reason: contentNode.length === 0
        ? "content selector returned no nodes for substack type: post"
        : "content selector matched empty html for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
      stats: {
        removedNodes: 0,
        selectedNodes: contentNode.length === 0 ? 0 : 1,
      },
    };
  }

  const authorName = $("div.byline-wrapper a[href*='substack.com/@']").first().text().trim()
    || $('meta[name="author"]').attr("content")?.trim()
    || preload?.publishedBylines?.[0]?.name?.trim()
    || "";
  const preloadHandle = preload?.publishedBylines?.[0]?.handle?.trim();
  const authorHomepage =
    $("div.byline-wrapper a[href*='substack.com/@']").first().attr("href")?.trim()
    || (preloadHandle ? `https://substack.com/@${preloadHandle}` : "");
  const contentTimeBlock = $("div.byline-wrapper .meta-EgzBVA, div.byline-wrapper [class*='meta']")
    .toArray()
    .map((element) => $(element).text().trim())
    .find((value) => /[A-Za-z]{3,}\s+\d{2},\s+\d{4}/u.test(value)) ?? "";

  const turndownService = createTurndownService({
    useHtmlStyleForImage: input.useHtmlStyleForImage ?? false,
  });
  return buildMarkdownResult({
    title,
    contentHtml: cleanSubstackContentHtml(rawContentHtml, subtitle),
    authorBlock: authorName && authorHomepage ? buildMarkdownLink(authorName, authorHomepage) : "",
    contentTimeBlock,
  }, turndownService, input.source);
}

export async function parseSubstackMetadata(
  input: MetadataInput & { source: SubstackSourceIdentity },
): Promise<MetadataResult> {
  const $ = load(input.html);
  const structuredArticle = parseStructuredArticle($);
  const preload = parseSubstackPreloadData($);
  const articleUrl =
    $('link[rel="canonical"]').attr("href")?.trim()
    || $('meta[property="og:url"]').attr("content")?.trim()
    || structuredArticle?.url?.trim()
    || structuredArticle?.mainEntityOfPage?.trim()
    || preload?.post?.canonical_url?.trim()
    || preload?.canonicalUrl?.trim()
    || preload?.ogUrl?.trim()
    || input.sourceUrl;
  if (!isAbsoluteUrl(articleUrl)) {
    return {
      ok: false,
      source: input.source,
      reason: "canonical article url is not an absolute url for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const structuredAuthor = Array.isArray(structuredArticle?.author)
    ? structuredArticle.author[0]
    : structuredArticle?.author;
  const preloadByline = preload?.publishedBylines?.[0];
  const authorId =
    structuredAuthor?.name?.trim()
    || $('meta[name="author"]').attr("content")?.trim()
    || preloadByline?.name?.trim()
    || $("div.byline-wrapper a[href*='substack.com/@']").first().text().trim();
  const authorHomepage =
    structuredAuthor?.url?.trim()
    || (preloadByline?.handle?.trim() ? `https://substack.com/@${preloadByline.handle.trim()}` : undefined)
    || $("div.byline-wrapper a[href*='substack.com/@']").first().attr("href")?.trim();
  if (!authorId || !authorHomepage) {
    return {
      ok: false,
      source: input.source,
      reason: "author selector matched nodes but found no author name or homepage for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  if (!isAbsoluteUrl(authorHomepage)) {
    return {
      ok: false,
      source: input.source,
      reason: "author homepage is not an absolute url for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const publishTime = structuredArticle?.datePublished?.trim()
    || preload?.post?.post_date?.trim();
  if (!publishTime) {
    return {
      ok: false,
      source: input.source,
      reason: "time selector matched nodes but found no publish time for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const editTimeRaw = structuredArticle?.dateModified?.trim()
    || preload?.post?.updated_at?.trim();
  const editTime = editTimeRaw && editTimeRaw !== publishTime ? editTimeRaw : undefined;

  return {
    ok: true,
    source: input.source,
    metadata: {
      articleUrl,
      authorId,
      authorHomepage,
      publishTime,
      editTime,
    },
  };
}

export const substackSourceAdapter: SourceAdapter<SubstackSourceIdentity> = {
  sourceId: "substack",
  detect: detectSubstackSource,
  fetch: {
    normalizeDownload: normalizeSubstackDownload,
  },
  markdown: {
    parseMarkdown: parseSubstackMarkdown,
  },
  metadata: {
    parseMetadata: parseSubstackMetadata,
  },
};
