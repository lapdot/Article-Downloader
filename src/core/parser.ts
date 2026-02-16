import { load } from "cheerio";
import TurndownService from "turndown";
import { detectZhihuContentType, getSelectorsForZhihuType } from "../adapters/zhihu.js";
import type { MetadataInput, MetadataResult, ParseInput, ParseResult, ZhihuContentType } from "../types.js";

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

  const contentType = detectZhihuContentType(url);
  if (!contentType) {
    return {
      ok: false,
      reason: `unsupported zhihu content type for url path: ${url.pathname}`,
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }

  const $ = load(input.html);
  let extractResult: ExtractResult;
  if (contentType === "answer") {
    extractResult = extractAnswerMarkdownContext($, turndownService);
  } else if (contentType === "pin") {
    extractResult = extractPinMarkdownContext($, turndownService);
  } else {
    extractResult = extractZhuanlanMarkdownContext($, turndownService);
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

  const contentType = detectZhihuContentType(sourceUrl);
  if (!contentType) {
    return {
      ok: false,
      reason: `unsupported zhihu content type for url path: ${sourceUrl.pathname}`,
      errorCode: "E_PARSE_UNSUPPORTED_SITE",
    };
  }
  const selectors = getSelectorsForZhihuType(contentType);

  const $ = load(input.html);
  const authorMetaContainer = $(selectors.authorMetaContainer).first();
  if (authorMetaContainer.length === 0) {
    return {
      ok: false,
      reason: `author selector returned no nodes for zhihu type: ${contentType}`,
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
      reason: `author selector matched nodes but found no author name or homepage for zhihu type: ${contentType}`,
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
      reason: `author homepage is not an absolute url for zhihu type: ${contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const contentTimeNode = $(selectors.timeContainer).first();
  if (contentTimeNode.length === 0) {
    return {
      ok: false,
      reason: `time selector returned no nodes for zhihu type: ${contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  const contentTimeLink = contentTimeNode.find(selectors.timeLink).first();
  let publishTime: string;
  try {
    publishTime = getPublishTimeByType(contentType, contentTimeNode, contentTimeLink);
  } catch {
    return {
      ok: false,
      reason: `time selector matched nodes but found no publish time for zhihu type: ${contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }
  const editTimeRaw = getEditTimeByType(contentType, contentTimeNode, contentTimeLink);
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
