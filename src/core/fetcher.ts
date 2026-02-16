import { fetch } from "undici";
import { toCookieHeaderForUrl } from "./cookies.js";
import { toIsoNow } from "../utils/time.js";
import type { DownloadInput, DownloadResult } from "../types.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export async function downloadHtml(input: DownloadInput): Promise<DownloadResult> {
  const fetchedAt = toIsoNow();
  const timeoutMs = input.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input.url, {
      method: "GET",
      headers: {
        cookie: toCookieHeaderForUrl(input.cookies, input.url),
        "user-agent": input.userAgent ?? DEFAULT_USER_AGENT,
      },
      signal: controller.signal,
      redirect: "follow",
    });

    const html = await response.text();
    if (response.status !== 200) {
      return {
        ok: false,
        url: input.url,
        finalUrl: response.url,
        statusCode: response.status,
        html,
        fetchedAt,
        reason: `unexpected status ${response.status}`,
        errorCode: "E_FETCH_HTTP",
      };
    }

    return {
      ok: true,
      url: input.url,
      finalUrl: response.url,
      statusCode: response.status,
      html,
      fetchedAt,
    };
  } catch (error) {
    return {
      ok: false,
      url: input.url,
      fetchedAt,
      reason: error instanceof Error ? error.message : "unknown fetch error",
      errorCode: "E_FETCH_HTTP",
    };
  } finally {
    clearTimeout(timeout);
  }
}
