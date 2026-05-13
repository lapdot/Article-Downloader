import { load } from "cheerio";
import type {
  ForeignAffairsContentType,
  ForeignAffairsSourceIdentity,
} from "../types.js";
import type { SourceAdapter } from "./contracts.js";

const PDF_PATH_PATTERN = /^\/system\/files\/pdf\/[^?#]+\.pdf$/iu;
const PDF_TEXT_PATTERN =
  /(?:https?:\\?\/\\?\/(?:www\.)?foreignaffairs\.com)?\\?\/system\\?\/files\\?\/pdf\\?\/[^"'<>\s)]+?\.pdf/giu;

export function isForeignAffairsHost(hostname: string): boolean {
  return hostname === "foreignaffairs.com" || hostname === "www.foreignaffairs.com";
}

export function detectForeignAffairsContentType(url: URL): ForeignAffairsContentType | null {
  if (!isForeignAffairsHost(url.hostname)) {
    return null;
  }
  if (url.pathname.startsWith("/system/files/")) {
    return null;
  }
  if (url.pathname === "/" || url.pathname.endsWith(".pdf")) {
    return null;
  }

  return url.pathname.startsWith("/podcasts/") ? "podcast" : "post";
}

export function detectForeignAffairsSource(url: URL): ForeignAffairsSourceIdentity | null {
  const contentType = detectForeignAffairsContentType(url);
  if (!contentType) {
    return null;
  }
  return {
    sourceId: "foreignaffairs",
    contentType,
  };
}

function unescapeCandidate(value: string): string {
  return value
    .replace(/\\\//gu, "/")
    .replace(/&amp;/gu, "&")
    .replace(/\\u0026/giu, "&");
}

function normalizeForeignAffairsPdfUrl(value: string): string | null {
  const normalizedCandidate = unescapeCandidate(value.trim());
  try {
    const url = new URL(normalizedCandidate, "https://www.foreignaffairs.com");
    if (!isForeignAffairsHost(url.hostname) || !PDF_PATH_PATTERN.test(url.pathname)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function getForeignAffairsPdfFilename(pdfUrl: string): string {
  const url = new URL(pdfUrl);
  const filename = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  if (!filename || !filename.toLowerCase().endsWith(".pdf") || filename.includes("/")) {
    throw new Error(`invalid foreignaffairs pdf filename for url: ${pdfUrl}`);
  }
  return filename;
}

export function extractForeignAffairsPdfUrl(html: string): string | null {
  const $ = load(html);
  const candidates: string[] = [];

  $("a[href]")
    .toArray()
    .forEach((element) => {
      const href = $(element).attr("href")?.trim();
      if (href) {
        candidates.push(href);
      }
    });

  const textMatches = html.matchAll(PDF_TEXT_PATTERN);
  for (const match of textMatches) {
    candidates.push(match[0]);
  }

  for (const candidate of candidates) {
    const pdfUrl = normalizeForeignAffairsPdfUrl(candidate);
    if (pdfUrl) {
      return pdfUrl;
    }
  }

  return null;
}

export const foreignAffairsSourceAdapter: SourceAdapter<ForeignAffairsSourceIdentity> = {
  sourceId: "foreignaffairs",
  detect: detectForeignAffairsSource,
};
