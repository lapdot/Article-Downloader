import { load } from "cheerio";
import TurndownService from "turndown";
import { detectSubstackContentType } from "../adapters/substack.js";
import { detectZhihuContentType, getSelectorsForZhihuType } from "../adapters/zhihu.js";
import type {
  MetadataInput,
  MetadataResult,
  ParseInput,
  ParseResult,
  ZhihuContentType,
} from "../types.js";

function createTurndownService(options: { useHtmlStyleForImage: boolean }): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  function extractZhihuMathTex(node: { getAttribute: (name: string) => string | null; querySelector?: (selector: string) => { textContent?: string | null } | null; innerHTML?: string }): string {
    const fromDataTex = (node.getAttribute("data-tex") ?? "").trim();
    if (fromDataTex) {
      return fromDataTex;
    }

    if (typeof node.querySelector === "function") {
      const scriptNode = node.querySelector('script[type*="math/tex"]');
      const scriptText = (scriptNode?.textContent ?? "").trim();
      if (scriptText) {
        return scriptText;
      }
    }

    const innerHtml = node.innerHTML ?? "";
    const scriptMatch = innerHtml.match(
      /<script[^>]*type=["']math\/tex(?:;mode=(?:display|inline))?["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    return (scriptMatch?.[1] ?? "").trim();
  }

  function isZhihuBlockMath(tex: string): boolean {
    return tex.endsWith("\\\\");
  }

  function isZhihuEmoji(node: { getAttribute: (name: string) => string | null }): boolean {
    const className = node.getAttribute("class") ?? "";
    const classList = className.split(/\s+/).filter(Boolean);
    const altRaw = (node.getAttribute("alt") ?? "").trim();
    const isAsciiBracketedAlt = /^\[[^\]]+\]$/.test(altRaw);
    return classList.includes("sticker") && isAsciiBracketedAlt;
  }

  turndownService.addRule("zhihuMathEquation", {
    filter: (node) => {
      const rawNode = node as unknown as {
        nodeName?: string;
        getAttribute?: (name: string) => string | null;
      };
      const nodeName = rawNode.nodeName?.toLowerCase();
      if (nodeName !== "span" || typeof rawNode.getAttribute !== "function") {
        return false;
      }
      const span = rawNode as { getAttribute: (name: string) => string | null };
      const className = span.getAttribute("class") ?? "";
      const isMathNode = className.split(/\s+/).includes("ztext-math");
      return isMathNode;
    },
    replacement: (_content, node) => {
      const span = node as unknown as {
        getAttribute: (name: string) => string | null;
        querySelector?: (selector: string) => { textContent?: string | null; getAttribute?: (name: string) => string | null } | null;
        innerHTML?: string;
      };
      const tex = extractZhihuMathTex(span);
      if (!tex) {
        return "";
      }
      const isBlockMath = isZhihuBlockMath(tex);
      if (isBlockMath) {
        return `\n\n$$\n${tex}\n$$\n\n`;
      }
      return `$${tex}$`;
    },
  });

  turndownService.addRule("zhihuImage", {
    filter: "img",
    replacement: (_content, node) => {
      const img = node as unknown as { getAttribute: (name: string) => string | null };
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:image")) {
        return "";
      }

      const rawHeight = img.getAttribute("data-rawheight");
      const rawWidth = img.getAttribute("data-rawwidth");
      const altRaw = (img.getAttribute("alt") ?? "").trim();
      if (isZhihuEmoji(img)) {
        const altCore = altRaw.replace(/^\[|\]$/g, "").trim();
        if (!altCore) {
          return "";
        }
        return `\\[${altCore}\\]`;
      }

      if (!options.useHtmlStyleForImage) {
        return `![](${src})`;
      }

      let style = "";
      if (rawHeight) {
        style += `height: ${rawHeight};`;
      }
      if (rawWidth) {
        style += `width: ${rawWidth};`;
      }
      return `<img src="${src}" style="${style}">`;
    },
  });

  return turndownService;
}

function normalizeProtocolRelativeHrefs(
  node: { find: (selector: string) => { each: (cb: (_index: number, el: { attribs: Record<string, string> }) => void) => void } },
): void {
  node.find("a[href]").each((_index, element) => {
    const href = element.attribs.href;
    if (typeof href === "string" && href.startsWith("//")) {
      element.attribs.href = `https:${href}`;
    }
  });
}

interface MarkdownContext {
  title: string;
  contentHtml: string;
  authorBlock: string;
  contentTimeBlock: string;
  includeTitleInMarkdown?: boolean;
}

interface ExtractSuccess {
  ok: true;
  context: MarkdownContext;
}

interface ExtractFailure {
  ok: false;
  reason: string;
  selectedNodes: number;
}

type ExtractResult = ExtractSuccess | ExtractFailure;

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

function cleanTitleByType(value: string | undefined, type: "answer" | "pin" | "zhuanlan_article"): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const raw = value.trim();
  if (raw.length === 0) {
    return undefined;
  }

  let cleaned = raw;
  if (type === "pin") {
    cleaned = cleaned.replace(/^[^\n:：]{1,40}\s*的想法[:：]\s*/u, "");
  }
  cleaned = cleaned.replace(/\s*-\s*知乎\s*$/u, "");
  const trimmed = cleaned.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getAnswerTitle($: ReturnType<typeof load>): string {
  const title = cleanTitleByType($("h1.QuestionHeader-title").first().text(), "answer");
  if (!title) {
    throw new Error("title selector returned no text for zhihu type: answer");
  }
  return title;
}

function getAnswerContentNode($: ReturnType<typeof load>): ReturnType<ReturnType<typeof load>> {
  return $("div.AnswerItem span.RichText").first();
}

function getPinTitle($: ReturnType<typeof load>): string {
  const title = cleanTitleByType($('meta[property="og:title"]').attr("content"), "pin");
  if (!title) {
    throw new Error("title selector returned no text for zhihu type: pin");
  }
  return title;
}

function getPinContentNode($: ReturnType<typeof load>): ReturnType<ReturnType<typeof load>> {
  return $("div.PinItem span.RichText.ztext").first();
}

function getZhuanlanTitle($: ReturnType<typeof load>): string {
  const title = cleanTitleByType($("h1.Post-Title").first().text(), "zhuanlan_article");
  if (!title) {
    throw new Error("title selector returned no text for zhihu type: zhuanlan_article");
  }
  return title;
}

function getZhuanlanContentNode($: ReturnType<typeof load>): ReturnType<ReturnType<typeof load>> {
  return $("div.Post-content div.RichText.ztext").first();
}

function getZhuanlanTimeNode($: ReturnType<typeof load>): ReturnType<ReturnType<typeof load>> {
  return $("div.Post-Header div.ContentItem-time, article.Post-Main > div.ContentItem-time").first();
}

function buildAuthorBlock(
  $: ReturnType<typeof load>,
  authorMetaContainer: ReturnType<ReturnType<typeof load>>,
): string {
  if (authorMetaContainer.length === 0) {
    return "";
  }
  const authorMeta = authorMetaContainer.find("meta[itemprop][content]");
  const authorName = authorMeta
    .toArray()
    .find((el) => $(el).attr("itemprop") === "name")
    ?.attribs.content;
  const authorUrl = authorMeta
    .toArray()
    .find((el) => $(el).attr("itemprop") === "url")
    ?.attribs.content;
  if (authorName && authorUrl) {
    return `[${authorName}](${authorUrl})`;
  }
  return "";
}

function buildTimeBlock(
  $: ReturnType<typeof load>,
  turndownService: TurndownService,
  timeNode: ReturnType<ReturnType<typeof load>>,
): string {
  if (timeNode.length === 0) {
    return "";
  }
  normalizeProtocolRelativeHrefs(timeNode);
  return turndownService.turndown($.html(timeNode)).trim();
}

function extractAnswerMarkdownContext(
  $: ReturnType<typeof load>,
  turndownService: TurndownService,
): ExtractResult {
  const answerNode = $("div.AnswerItem").first();
  let title: string;
  try {
    title = getAnswerTitle($);
  } catch {
    return {
      ok: false,
      reason: "title selector returned no text for zhihu type: answer",
      selectedNodes: 0,
    };
  }

  const contentNode = getAnswerContentNode($);
  if (contentNode.length === 0) {
    return {
      ok: false,
      reason: "content selector returned no nodes for zhihu type: answer",
      selectedNodes: 0,
    };
  }
  const contentHtml = contentNode.html() ?? "";
  if (!contentHtml.trim()) {
    return {
      ok: false,
      reason: "content selector matched empty html for zhihu type: answer",
      selectedNodes: 1,
    };
  }

  const authorBlock = buildAuthorBlock($, answerNode.find("div.AnswerItem-authorInfo").first());
  const contentTimeBlock = buildTimeBlock(
    $,
    turndownService,
    answerNode.find("div.ContentItem-time").first(),
  );

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock,
      contentTimeBlock,
    },
  };
}

function extractPinMarkdownContext(
  $: ReturnType<typeof load>,
  turndownService: TurndownService,
): ExtractResult {
  const pinNode = $("div.PinItem").first();
  let title: string;
  try {
    title = getPinTitle($);
  } catch {
    return {
      ok: false,
      reason: "title selector returned no text for zhihu type: pin",
      selectedNodes: 0,
    };
  }

  const contentNode = getPinContentNode($);
  if (contentNode.length === 0) {
    return {
      ok: false,
      reason: "content selector returned no nodes for zhihu type: pin",
      selectedNodes: 0,
    };
  }
  const contentHtml = contentNode.html() ?? "";
  if (!contentHtml.trim()) {
    return {
      ok: false,
      reason: "content selector matched empty html for zhihu type: pin",
      selectedNodes: 1,
    };
  }

  const authorBlock = buildAuthorBlock($, pinNode.find("div.PinItem-authorInfo").first());
  const contentTimeBlock = buildTimeBlock($, turndownService, pinNode.find("div.ContentItem-time").first());

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock,
      contentTimeBlock,
      includeTitleInMarkdown: false,
    },
  };
}

function extractZhuanlanMarkdownContext(
  $: ReturnType<typeof load>,
  turndownService: TurndownService,
): ExtractResult {
  let title: string;
  try {
    title = getZhuanlanTitle($);
  } catch {
    return {
      ok: false,
      reason: "title selector returned no text for zhihu type: zhuanlan_article",
      selectedNodes: 0,
    };
  }

  const contentNode = getZhuanlanContentNode($);
  if (contentNode.length === 0) {
    return {
      ok: false,
      reason: "content selector returned no nodes for zhihu type: zhuanlan_article",
      selectedNodes: 0,
    };
  }
  const contentHtml = contentNode.html() ?? "";
  if (!contentHtml.trim()) {
    return {
      ok: false,
      reason: "content selector matched empty html for zhihu type: zhuanlan_article",
      selectedNodes: 1,
    };
  }

  const authorBlock = buildAuthorBlock($, $("div.Post-Author").first());
  const zhuanlanTimeNode = getZhuanlanTimeNode($);
  if (zhuanlanTimeNode.length === 0) {
    return {
      ok: false,
      reason: "time selector returned no nodes for zhihu type: zhuanlan_article",
      selectedNodes: 0,
    };
  }
  const contentTimeBlock = buildTimeBlock($, turndownService, zhuanlanTimeNode);

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock,
      contentTimeBlock,
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

function extractSubstackMarkdownContext(
  $: ReturnType<typeof load>,
): ExtractResult {
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
        selectedNodes: 0,
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
      selectedNodes: contentNode.length === 0 ? 0 : 1,
    };
  }
  const contentHtml = cleanSubstackContentHtml(rawContentHtml, subtitle);

  const authorName = $("div.byline-wrapper a[href*='substack.com/@']").first().text().trim()
    || $('meta[name="author"]').attr("content")?.trim()
    || preload?.publishedBylines?.[0]?.name?.trim()
    || "";
  const preloadHandle = preload?.publishedBylines?.[0]?.handle?.trim();
  const authorHomepage =
    $("div.byline-wrapper a[href*='substack.com/@']").first().attr("href")?.trim()
    || (preloadHandle ? `https://substack.com/@${preloadHandle}` : "");
  const authorBlock = authorName && authorHomepage ? `[${authorName}](${authorHomepage})` : "";

  const contentTimeBlock = $("div.byline-wrapper .meta-EgzBVA, div.byline-wrapper [class*='meta']")
    .toArray()
    .map((element) => $(element).text().trim())
    .find((value) => /[A-Za-z]{3,}\s+\d{2},\s+\d{4}/u.test(value)) ?? "";

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock,
      contentTimeBlock,
    },
  };
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

function parseSubstackMetadata(
  input: MetadataInput,
  $: ReturnType<typeof load>,
): MetadataResult {
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

export async function parseHtmlToMarkdown(input: ParseInput): Promise<ParseResult> {
  const turndownService = createTurndownService({
    useHtmlStyleForImage: input.useHtmlStyleForImage ?? false,
  });

  let url: URL;
  try {
    url = new URL(input.sourceUrl);
  } catch {
    return {
      ok: false,
      reason: "invalid sourceUrl",
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const zhihuContentType = detectZhihuContentType(url);
  const substackContentType = detectSubstackContentType(url);
  if (!zhihuContentType && !substackContentType) {
    return {
      ok: false,
      reason: `unsupported site for url: ${url.hostname}${url.pathname}`,
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const $ = load(input.html);
  let extractResult: ExtractResult;
  if (zhihuContentType === "answer") {
    extractResult = extractAnswerMarkdownContext($, turndownService);
  } else if (zhihuContentType === "pin") {
    extractResult = extractPinMarkdownContext($, turndownService);
  } else if (zhihuContentType === "zhuanlan_article") {
    extractResult = extractZhuanlanMarkdownContext($, turndownService);
  } else {
    extractResult = extractSubstackMarkdownContext($);
  }

  if (!extractResult.ok) {
    return {
      ok: false,
      reason: extractResult.reason,
      errorCode: "E_PARSE_SELECTOR",
      stats: {
        removedNodes: 0,
        selectedNodes: extractResult.selectedNodes,
      },
    };
  }

  const markdownBody = turndownService.turndown(extractResult.context.contentHtml).trim();
  const includeTitleInMarkdown = extractResult.context.includeTitleInMarkdown ?? true;
  const markdownSegments = [
    includeTitleInMarkdown && extractResult.context.title ? `# ${extractResult.context.title}` : "",
    extractResult.context.authorBlock,
    markdownBody,
    extractResult.context.contentTimeBlock,
  ].filter((segment) => segment.trim().length > 0);
  const markdown = markdownSegments.join("\n\n");

  return {
    ok: true,
    title: extractResult.context.title,
    markdown,
    stats: {
      removedNodes: 0,
      selectedNodes: 1,
    },
  };
}

function getPublishTimeByType(
  contentType: ZhihuContentType,
  contentTimeNode: ReturnType<ReturnType<typeof load>>,
  contentTimeLink: ReturnType<ReturnType<typeof load>>,
): string {
  if (contentType === "zhuanlan_article") {
    const text = contentTimeNode.text().trim();
    if (text.length === 0) {
      throw new Error(`time selector matched nodes but found no publish time for zhihu type: ${contentType}`);
    }
    return text;
  }
  const tooltip = contentTimeLink.attr("data-tooltip");
  if (tooltip === undefined) {
    throw new Error(`time selector matched nodes but found no publish time for zhihu type: ${contentType}`);
  }
  const trimmed = tooltip.trim();
  if (trimmed.length === 0) {
    throw new Error(`time selector matched nodes but found no publish time for zhihu type: ${contentType}`);
  }
  return trimmed;
}

function getEditTimeByType(
  contentType: ZhihuContentType,
  contentTimeNode: ReturnType<ReturnType<typeof load>>,
  contentTimeLink: ReturnType<ReturnType<typeof load>>,
): string | undefined {
  if (contentType === "zhuanlan_article") {
    const text = contentTimeNode.text().trim();
    return text.length > 0 ? text : undefined;
  }
  const linkText = contentTimeLink.text().trim();
  return linkText.length > 0 ? linkText : undefined;
}

export async function parseHtmlToMetadata(input: MetadataInput): Promise<MetadataResult> {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(input.sourceUrl);
  } catch {
    return {
      ok: false,
      reason: "invalid sourceUrl",
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const zhihuContentType = detectZhihuContentType(sourceUrl);
  const substackContentType = detectSubstackContentType(sourceUrl);
  if (!zhihuContentType && !substackContentType) {
    return {
      ok: false,
      reason: `unsupported site for url: ${sourceUrl.hostname}${sourceUrl.pathname}`,
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }
  const $ = load(input.html);
  if (substackContentType === "post") {
    return parseSubstackMetadata(input, $);
  }

  if (!zhihuContentType) {
    return {
      ok: false,
      reason: `unsupported site for url: ${sourceUrl.hostname}${sourceUrl.pathname}`,
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const selectors = getSelectorsForZhihuType(zhihuContentType);

  const authorMetaContainer = $(selectors.authorMetaContainer).first();
  if (authorMetaContainer.length === 0) {
    return {
      ok: false,
      reason: `author selector returned no nodes for zhihu type: ${zhihuContentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  const authorMeta = authorMetaContainer.find("meta[itemprop][content]");
  const authorIdFromMeta = authorMeta
    .toArray()
    .find((el) => $(el).attr("itemprop") === "name")
    ?.attribs.content
    ?.trim();
  const authorHomepageRaw = authorMeta
    .toArray()
    .find((el) => $(el).attr("itemprop") === "url")
    ?.attribs.content
    ?.trim();
  if (!authorIdFromMeta || !authorHomepageRaw) {
    return {
      ok: false,
      reason: `author selector matched nodes but found no author name or homepage for zhihu type: ${zhihuContentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  const authorHomepage = authorHomepageRaw;
  try {
    // Require absolute homepage URL; do not silently resolve relative values.
    new URL(authorHomepage);
  } catch {
    return {
      ok: false,
      reason: `author homepage is not an absolute url for zhihu type: ${zhihuContentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const contentTimeNode = $(selectors.timeContainer).first();
  if (contentTimeNode.length === 0) {
    return {
      ok: false,
      reason: `time selector returned no nodes for zhihu type: ${zhihuContentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  const contentTimeLink = contentTimeNode.find(selectors.timeLink).first();
  let publishTime: string;
  try {
    publishTime = getPublishTimeByType(zhihuContentType, contentTimeNode, contentTimeLink);
  } catch {
    return {
      ok: false,
      reason: `time selector matched nodes but found no publish time for zhihu type: ${zhihuContentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  const editTimeRaw = getEditTimeByType(zhihuContentType, contentTimeNode, contentTimeLink);
  const editTime = editTimeRaw && publishTime && editTimeRaw === publishTime ? undefined : editTimeRaw;

  const metadata = {
    articleUrl: sourceUrl.href,
    authorId: authorIdFromMeta,
    authorHomepage,
    publishTime,
    editTime,
  };

  return {
    ok: true,
    metadata,
  };
}
