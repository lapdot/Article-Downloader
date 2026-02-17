import { fetch } from "undici";
import { toCookieHeaderForUrl } from "../core/cookies.js";
import { toIsoNow } from "../utils/time.js";
import type { Cookie, SelectorSet, VerifyResult, ZhihuContentType } from "../types.js";

const ZHIHU_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

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
  zhuanlan_article: {
    title: "h1.Post-Title, h1.ContentItem-title",
    content: "div.Post-RichTextContainer, article.Post-RichTextContainer, article",
    remove: [...ZHIHU_BASE_REMOVE_SELECTORS, "div.AuthorInfo", "div.Post-topicsAndReviewer"],
    authorMetaContainer: "div.Post-Author",
    timeContainer: "div.Post-Header div.ContentItem-time, div.ContentItem-time",
    timeLink: "a",
  },
};

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
    return "zhuanlan_article";
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

export function getSelectorsForZhihuType(type: ZhihuContentType): SelectorSet {
  return ZHIHU_SELECTORS_BY_TYPE[type];
}

export async function verifyZhihuCookies(cookies: Cookie[], userAgent?: string): Promise<VerifyResult> {
  const fetchedAt = toIsoNow();
  const verifyUrl = "https://www.zhihu.com/settings/account";
  try {
    const response = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        cookie: toCookieHeaderForUrl(cookies, verifyUrl),
        "user-agent": userAgent ?? ZHIHU_USER_AGENT,
      },
      redirect: "manual",
    });

    if (response.status === 200) {
      return {
        ok: true,
        statusCode: response.status,
        reason: "zhihu account settings returned 200",
        diagnostics: {
          fetchedAt,
          verifyUrl,
          verificationType: "verified",
        },
      };
    }

    if (response.status === 301 || response.status === 302) {
      return {
        ok: false,
        statusCode: response.status,
        reason: "zhihu account settings redirected (301/302), cookies are invalid or expired",
        errorCode: "E_COOKIE_INVALID",
        diagnostics: {
          fetchedAt,
          verifyUrl,
          verificationType: "invalid_or_expired_cookies",
        },
      };
    }

    return {
      ok: false,
      statusCode: response.status,
      reason: `zhihu account settings returned ${response.status}, likely network or other issue`,
      errorCode: "E_FETCH_HTTP",
      diagnostics: {
        fetchedAt,
        verifyUrl,
        verificationType: "network_or_other_issue",
      },
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown verify error",
      errorCode: "E_FETCH_HTTP",
      diagnostics: {
        fetchedAt,
        verifyUrl,
        verificationType: "network_or_other_issue",
      },
    };
  }
}
