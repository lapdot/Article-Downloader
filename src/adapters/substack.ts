import { load } from "cheerio";
import { buildMarkdownResult, createTurndownService } from "./parser-support.js";
import type { SourceAdapter } from "./contracts.js";
import type {
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
    authorBlock: authorName && authorHomepage ? `[${authorName}](${authorHomepage})` : "",
    contentTimeBlock,
  }, turndownService);
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
      reason: "author selector matched nodes but found no author name or homepage for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  if (!isAbsoluteUrl(authorHomepage)) {
    return {
      ok: false,
      reason: "author homepage is not an absolute url for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const publishTime = structuredArticle?.datePublished?.trim()
    || preload?.post?.post_date?.trim();
  if (!publishTime) {
    return {
      ok: false,
      reason: "time selector matched nodes but found no publish time for substack type: post",
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const editTimeRaw = structuredArticle?.dateModified?.trim()
    || preload?.post?.updated_at?.trim();
  const editTime = editTimeRaw && editTimeRaw !== publishTime ? editTimeRaw : undefined;

  return {
    ok: true,
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
  markdown: {
    parseMarkdown: parseSubstackMarkdown,
  },
  metadata: {
    parseMetadata: parseSubstackMetadata,
  },
};
