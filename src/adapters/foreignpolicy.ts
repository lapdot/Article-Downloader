import type { ForeignPolicyContentType, ForeignPolicySourceIdentity } from "../types.js";
import type { SourceAdapter } from "./contracts.js";

export function isForeignPolicyHost(hostname: string): boolean {
  return hostname === "foreignpolicy.com" || hostname === "www.foreignpolicy.com";
}

export function detectForeignPolicyContentType(url: URL): ForeignPolicyContentType | null {
  if (!isForeignPolicyHost(url.hostname)) {
    return null;
  }
  if (url.pathname === "/" || url.pathname.toLowerCase().endsWith(".pdf")) {
    return null;
  }

  return "post";
}

export function detectForeignPolicySource(url: URL): ForeignPolicySourceIdentity | null {
  const contentType = detectForeignPolicyContentType(url);
  if (!contentType) {
    return null;
  }
  return {
    sourceId: "foreignpolicy",
    contentType,
  };
}

export function getForeignPolicyPdfUrl(articleUrl: string): string {
  const url = new URL(articleUrl);
  if (!isForeignPolicyHost(url.hostname)) {
    throw new Error(`invalid foreignpolicy article url: ${articleUrl}`);
  }
  url.hash = "";
  url.search = "";
  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }
  url.searchParams.set("download_pdf", "true");
  return url.toString();
}

export function getForeignPolicyPdfFilename(articleUrl: string): string {
  const url = new URL(articleUrl);
  if (!isForeignPolicyHost(url.hostname)) {
    throw new Error(`invalid foreignpolicy article url: ${articleUrl}`);
  }

  const slug = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "");
  const filename = `${slug}.pdf`;
  if (!slug || filename.includes("/") || filename.includes("\\") || slug === "." || slug === "..") {
    throw new Error(`invalid foreignpolicy pdf filename for url: ${articleUrl}`);
  }
  return filename;
}

export const foreignPolicySourceAdapter: SourceAdapter<ForeignPolicySourceIdentity> = {
  sourceId: "foreignpolicy",
  detect: detectForeignPolicySource,
};
