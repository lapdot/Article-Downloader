import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fetch } from "undici";
import { toCookieHeaderForUrl } from "./cookies.js";
import { toIsoNow } from "../utils/time.js";
import type { DownloadInput, DownloadMethod, DownloadResult } from "../types.js";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const DEFAULT_COOKIEPROXY_PATH = "/Users/lapdot/Documents/projects/runnable/cookieproxy";
const execFileAsync = promisify(execFile);

interface SubstackShellPreloadData {
  id?: number;
  publication_id?: number;
  subdomain?: string;
  base_url?: string;
  canonicalUrl?: string;
  ogUrl?: string;
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
  publishedBylines?: Array<{
    name?: string;
    handle?: string;
  }>;
}

function getDownloadMethod(input: DownloadInput): DownloadMethod {
  return input.downloadMethod ?? "cookieproxy";
}

function getCookieproxyPath(input: DownloadInput): string {
  return input.cookieproxyPath ?? process.env.ARTICLE_DOWNLOADER_COOKIEPROXY_PATH ?? DEFAULT_COOKIEPROXY_PATH;
}

async function downloadViaHttp(
  input: DownloadInput,
  fetchedAt: string,
): Promise<DownloadResult> {
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
        downloadMethod: "http",
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
      downloadMethod: "http",
      finalUrl: response.url,
      statusCode: response.status,
      html,
      fetchedAt,
    };
  } catch (error) {
    return {
      ok: false,
      url: input.url,
      downloadMethod: "http",
      fetchedAt,
      reason: error instanceof Error ? error.message : "unknown fetch error",
      errorCode: "E_FETCH_HTTP",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadViaCookieproxy(
  input: DownloadInput,
  fetchedAt: string,
): Promise<DownloadResult> {
  const timeoutMs = input.timeoutMs ?? 15000;
  const cookieproxyPath = getCookieproxyPath(input);
  const tempDir = await mkdtemp(path.join(tmpdir(), "article-downloader-cookieproxy-"));
  const outputPath = path.join(tempDir, "page.html");

  try {
    const { stderr } = await execFileAsync(
      cookieproxyPath,
      ["--url", input.url, "--output", outputPath],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      },
    );

    const html = await readFile(outputPath, "utf8");
    return {
      ok: true,
      url: input.url,
      downloadMethod: "cookieproxy",
      finalUrl: input.url,
      html,
      fetchedAt,
      diagnostics: stderr.trim() ? { stderr: stderr.trim() } : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown cookieproxy error";
    const diagnostics: Record<string, string | number | boolean> = {
      cookieproxyPath,
    };
    if (error && typeof error === "object") {
      const stderr = Reflect.get(error, "stderr");
      const stdout = Reflect.get(error, "stdout");
      const code = Reflect.get(error, "code");
      const killed = Reflect.get(error, "killed");
      const signal = Reflect.get(error, "signal");
      if (typeof stderr === "string" && stderr.trim()) {
        diagnostics.stderr = stderr.trim();
      }
      if (typeof stdout === "string" && stdout.trim()) {
        diagnostics.stdout = stdout.trim();
      }
      if (typeof code === "number" || typeof code === "string") {
        diagnostics.exitCode = String(code);
      }
      if (typeof killed === "boolean") {
        diagnostics.killed = killed;
      }
      if (typeof signal === "string" && signal) {
        diagnostics.signal = signal;
      }
    }
    return {
      ok: false,
      url: input.url,
      downloadMethod: "cookieproxy",
      finalUrl: input.url,
      fetchedAt,
      reason: message,
      errorCode: "E_FETCH_EXEC",
      diagnostics,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function downloadOnce(input: DownloadInput, fetchedAt: string): Promise<DownloadResult> {
  const method = getDownloadMethod(input);
  return method === "cookieproxy"
    ? downloadViaCookieproxy(input, fetchedAt)
    : downloadViaHttp(input, fetchedAt);
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

function parseSubstackPreloadData(html: string): SubstackShellPreloadData | null {
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
  const preload = parseSubstackPreloadData(html);
  if (!preload) {
    return null;
  }

  const visited = new Set<unknown>();

  function resolveFromNode(node: unknown): { publicationId?: number; baseUrl?: string } {
    if (!node || typeof node !== "object") {
      return {};
    }
    if (visited.has(node)) {
      return {};
    }
    visited.add(node);

    if (Array.isArray(node)) {
      let baseUrl: string | undefined;
      let publicationId: number | undefined;
      for (const entry of node) {
        const resolved = resolveFromNode(entry);
        baseUrl ??= resolved.baseUrl;
        publicationId ??= resolved.publicationId;
        if (baseUrl && publicationId) {
          return { baseUrl, publicationId };
        }
      }
      return { baseUrl, publicationId };
    }

    const record = node as Record<string, unknown>;
    const baseUrl =
      typeof record.base_url === "string"
      && record.base_url.startsWith("https://")
      && record.base_url.endsWith(".substack.com")
        ? record.base_url
        : undefined;
    const publicationId =
      typeof record.publication_id === "number"
        ? record.publication_id
        : typeof record.id === "number" && typeof record.subdomain === "string"
          ? record.id
          : undefined;
    if (baseUrl && publicationId) {
      return { baseUrl, publicationId };
    }

    let nestedBaseUrl = baseUrl;
    let nestedPublicationId = publicationId;
    for (const value of Object.values(record)) {
      const resolved = resolveFromNode(value);
      nestedBaseUrl ??= resolved.baseUrl;
      nestedPublicationId ??= resolved.publicationId;
      if (nestedBaseUrl && nestedPublicationId) {
        return {
          baseUrl: nestedBaseUrl,
          publicationId: nestedPublicationId,
        };
      }
    }

    return {
      baseUrl: nestedBaseUrl,
      publicationId: nestedPublicationId,
    };
  }

  const resolved = resolveFromNode(preload);
  if (!resolved.baseUrl || !resolved.publicationId || !Number.isFinite(resolved.publicationId)) {
    return null;
  }

  return {
    publicationId: resolved.publicationId,
    baseUrl: resolved.baseUrl,
  };
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

    return parsed.find((candidate) => String(candidate?.id ?? "") === expectedPostId) ?? null;
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

    const url = new URL(canonicalUrl);
    return url.toString();
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

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
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

async function maybeNormalizeSubstackAggregatorDownload(
  input: DownloadInput,
  fetchedAt: string,
  initial: DownloadResult,
): Promise<DownloadResult> {
  const postId = getSubstackAggregatorPostId(input.url);
  if (!postId || !initial.ok || !initial.html) {
    return initial;
  }

  const lookupContext = getSubstackLookupContext(initial.html);
  if (!lookupContext) {
    return initial;
  }

  const lookupUrl = `${lookupContext.baseUrl}/api/v1/posts?publication_id=${lookupContext.publicationId}&post_ids=${postId}`;
  const lookupResult = await downloadOnce(
    {
      ...input,
      url: lookupUrl,
    },
    fetchedAt,
  );
  if (!lookupResult.ok || !lookupResult.html) {
    return initial;
  }

  const lookupEntry = parseSubstackPostsLookupEntry(lookupResult.html, postId);
  const canonicalUrl = getCanonicalUrlFromSubstackPostsLookupEntry(lookupEntry);
  if (!canonicalUrl || canonicalUrl === input.url) {
    return initial;
  }

  const normalizedResult = await downloadOnce(
    {
      ...input,
      url: canonicalUrl,
    },
    fetchedAt,
  );
  if (!normalizedResult.ok || !normalizedResult.html) {
    const syntheticHtml = lookupEntry ? buildSyntheticSubstackHtml(lookupEntry, canonicalUrl) : null;
    if (syntheticHtml) {
      return {
        ok: true,
        url: input.url,
        downloadMethod: normalizedResult.downloadMethod,
        finalUrl: canonicalUrl,
        html: syntheticHtml,
        fetchedAt,
        diagnostics: {
          ...(initial.diagnostics ?? {}),
          normalizedFromUrl: input.url,
          substackLookupUrl: lookupUrl,
          substackSyntheticFallback: true,
        },
      };
    }
    return initial;
  }

  return {
    ...normalizedResult,
    url: input.url,
    finalUrl: canonicalUrl,
    diagnostics: {
      ...(normalizedResult.diagnostics ?? {}),
      normalizedFromUrl: input.url,
      substackLookupUrl: lookupUrl,
    },
  };
}

export async function downloadHtml(input: DownloadInput): Promise<DownloadResult> {
  const fetchedAt = toIsoNow();
  const initial = await downloadOnce(input, fetchedAt);
  return maybeNormalizeSubstackAggregatorDownload(input, fetchedAt, initial);
}
