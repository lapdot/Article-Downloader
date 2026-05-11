import { load } from "cheerio";
import TurndownService from "turndown";
import { buildMarkdownResult, createTurndownService, normalizeProtocolRelativeHrefs } from "./parser-support.js";
import type { SourceAdapter } from "./contracts.js";
import type {
  MetadataInput,
  MetadataResult,
  ParseInput,
  ParseResult,
  SelectorSet,
  ZhihuContentType,
  ZhihuSourceIdentity,
} from "../types.js";

const ZHIHU_BASE_REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "div.Modal-wrapper",
  "div.Card.AppBanner",
  "div.ContentItem-actions",
  "div.Comments-container",
  "div.Recommendations-Main",
];

export const ZHIHU_SELECTORS_BY_TYPE: Record<ZhihuContentType, SelectorSet> = {
  answer: {
    title: "h1.QuestionHeader-title, h1.ContentItem-title, h1.ztext-title",
    content: "div.AnswerItem span.RichText, div.AnswerItem div.RichText, span.RichText",
    remove: [...ZHIHU_BASE_REMOVE_SELECTORS],
    authorMetaContainer: "div.AnswerItem-authorInfo",
    timeContainer: "div.AnswerItem div.ContentItem-time",
    timeLink: "a",
  },
  pin: {
    title: "h1.ContentItem-title, h1.ztext-title",
    content: "div.PinItem span.RichText, div.PinItem div.RichText, div.PinItem div.RichContent",
    remove: [...ZHIHU_BASE_REMOVE_SELECTORS],
    authorMetaContainer: "div.PinItem-authorInfo",
    timeContainer: "div.PinItem div.ContentItem-time",
    timeLink: "a",
  },
  post: {
    title: "h1.Post-Title, h1.ContentItem-title",
    content: "div.Post-RichTextContainer, article.Post-RichTextContainer, article",
    remove: [...ZHIHU_BASE_REMOVE_SELECTORS, "div.AuthorInfo", "div.Post-topicsAndReviewer"],
    authorMetaContainer: "div.Post-Author",
    timeContainer: "div.Post-Header div.ContentItem-time, div.ContentItem-time",
    timeLink: "a",
  },
};

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

export function isZhihuHost(hostname: string): boolean {
  return hostname === "zhihu.com" || hostname.endsWith(".zhihu.com") || hostname === "zhuanlan.zhihu.com";
}

export function getSelectorsForHost(hostname: string): SelectorSet | null {
  if (isZhihuHost(hostname)) {
    return ZHIHU_SELECTORS_BY_TYPE.answer;
  }
  return null;
}

export function detectZhihuContentType(url: URL): ZhihuContentType | null {
  const hostname = url.hostname;
  const pathname = url.pathname;

  if (hostname === "zhuanlan.zhihu.com" && /^\/p\/\d+/.test(pathname)) {
    return "post";
  }

  if (!isZhihuHost(hostname)) {
    return null;
  }

  if (/^\/question\/\d+\/answer\/\d+/.test(pathname)) {
    return "answer";
  }

  if (hostname === "www.zhihu.com" && /^\/pin\/\d+/.test(pathname)) {
    return "pin";
  }

  return null;
}

export function detectZhihuSource(url: URL): ZhihuSourceIdentity | null {
  const contentType = detectZhihuContentType(url);
  if (!contentType) {
    return null;
  }
  return {
    sourceId: "zhihu",
    contentType,
  };
}

export function getSelectorsForZhihuType(type: ZhihuContentType): SelectorSet {
  return ZHIHU_SELECTORS_BY_TYPE[type];
}

function cleanTitleByType(value: string | undefined, type: ZhihuContentType): string | undefined {
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
  const title = cleanTitleByType(
    $("h1.QuestionHeader-title, h1.ContentItem-title, h1.ztext-title").first().text(),
    "answer",
  );
  if (!title) {
    throw new Error("title selector returned no text for zhihu type: answer");
  }
  return title;
}

function getAnswerContentNode($: ReturnType<typeof load>): ReturnType<ReturnType<typeof load>> {
  return $("div.AnswerItem span.RichText, div.AnswerItem div.RichText, span.RichText").first();
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
  const title = cleanTitleByType($("h1.Post-Title").first().text(), "post");
  if (!title) {
    throw new Error("title selector returned no text for zhihu type: post");
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

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock: buildAuthorBlock($, answerNode.find("div.AnswerItem-authorInfo").first()),
      contentTimeBlock: buildTimeBlock(
        $,
        turndownService,
        answerNode.find("div.ContentItem-time").first(),
      ),
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

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock: buildAuthorBlock($, pinNode.find("div.PinItem-authorInfo").first()),
      contentTimeBlock: buildTimeBlock($, turndownService, pinNode.find("div.ContentItem-time").first()),
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
      reason: "title selector returned no text for zhihu type: post",
      selectedNodes: 0,
    };
  }

  const contentNode = getZhuanlanContentNode($);
  if (contentNode.length === 0) {
    return {
      ok: false,
      reason: "content selector returned no nodes for zhihu type: post",
      selectedNodes: 0,
    };
  }
  const contentHtml = contentNode.html() ?? "";
  if (!contentHtml.trim()) {
    return {
      ok: false,
      reason: "content selector matched empty html for zhihu type: post",
      selectedNodes: 1,
    };
  }

  const zhuanlanTimeNode = getZhuanlanTimeNode($);
  if (zhuanlanTimeNode.length === 0) {
    return {
      ok: false,
      reason: "time selector returned no nodes for zhihu type: post",
      selectedNodes: 0,
    };
  }

  return {
    ok: true,
    context: {
      title,
      contentHtml,
      authorBlock: buildAuthorBlock($, $("div.Post-Author").first()),
      contentTimeBlock: buildTimeBlock($, turndownService, zhuanlanTimeNode),
    },
  };
}

export async function parseZhihuMarkdown(
  input: ParseInput & { source: ZhihuSourceIdentity },
): Promise<ParseResult> {
  const turndownService = createTurndownService({
    useHtmlStyleForImage: input.useHtmlStyleForImage ?? false,
  });
  const $ = load(input.html);

  let extractResult: ExtractResult;
  if (input.source.contentType === "answer") {
    extractResult = extractAnswerMarkdownContext($, turndownService);
  } else if (input.source.contentType === "pin") {
    extractResult = extractPinMarkdownContext($, turndownService);
  } else {
    extractResult = extractZhuanlanMarkdownContext($, turndownService);
  }

  if (!extractResult.ok) {
    return {
      ok: false,
      source: input.source,
      reason: extractResult.reason,
      errorCode: "E_PARSE_SELECTOR",
      stats: {
        removedNodes: 0,
        selectedNodes: extractResult.selectedNodes,
      },
    };
  }

  return buildMarkdownResult(extractResult.context, turndownService, input.source);
}

function getPublishTimeByType(
  contentType: ZhihuContentType,
  contentTimeNode: ReturnType<ReturnType<typeof load>>,
  contentTimeLink: ReturnType<ReturnType<typeof load>>,
): string {
  if (contentType === "post") {
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
  if (contentType === "post") {
    const text = contentTimeNode.text().trim();
    return text.length > 0 ? text : undefined;
  }
  const linkText = contentTimeLink.text().trim();
  return linkText.length > 0 ? linkText : undefined;
}

export async function parseZhihuMetadata(
  input: MetadataInput & { source: ZhihuSourceIdentity },
): Promise<MetadataResult> {
  const $ = load(input.html);
  const selectors = getSelectorsForZhihuType(input.source.contentType);

  const authorMetaContainer = $(selectors.authorMetaContainer).first();
  if (authorMetaContainer.length === 0) {
    return {
      ok: false,
      source: input.source,
      reason: `author selector returned no nodes for zhihu type: ${input.source.contentType}`,
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
      source: input.source,
      reason: `author selector matched nodes but found no author name or homepage for zhihu type: ${input.source.contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  try {
    new URL(authorHomepageRaw);
  } catch {
    return {
      ok: false,
      source: input.source,
      reason: `author homepage is not an absolute url for zhihu type: ${input.source.contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const contentTimeNode = $(selectors.timeContainer).first();
  if (contentTimeNode.length === 0) {
    return {
      ok: false,
      source: input.source,
      reason: `time selector returned no nodes for zhihu type: ${input.source.contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const contentTimeLink = contentTimeNode.find(selectors.timeLink).first();
  let publishTime: string;
  try {
    publishTime = getPublishTimeByType(input.source.contentType, contentTimeNode, contentTimeLink);
  } catch {
    return {
      ok: false,
      source: input.source,
      reason: `time selector matched nodes but found no publish time for zhihu type: ${input.source.contentType}`,
      errorCode: "E_PARSE_SELECTOR",
    };
  }

  const editTimeRaw = getEditTimeByType(input.source.contentType, contentTimeNode, contentTimeLink);
  const editTime = editTimeRaw && editTimeRaw === publishTime ? undefined : editTimeRaw;

  return {
    ok: true,
    source: input.source,
    metadata: {
      articleUrl: input.sourceUrl,
      authorId: authorIdFromMeta,
      authorHomepage: authorHomepageRaw,
      publishTime,
      editTime,
    },
  };
}

export const zhihuSourceAdapter: SourceAdapter<ZhihuSourceIdentity> = {
  sourceId: "zhihu",
  detect: detectZhihuSource,
  markdown: {
    parseMarkdown: parseZhihuMarkdown,
  },
  metadata: {
    parseMetadata: parseZhihuMetadata,
  },
};
