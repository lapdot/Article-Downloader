import { markdownToBlocks } from "@tryfabric/martian";

export type NotionBlock = ReturnType<typeof markdownToBlocks>[number];

export interface MarkdownToNotionBlocksOptions {
  baseUrl?: string;
}

function normalizeEmptyInlineLinksForNotion(markdown: string): string {
  // Martian drops inline links with empty label text (`[](url)`), so we promote the
  // URL into the visible label before conversion. Keep image syntax untouched.
  return markdown.replace(/(^|[^!])\[\]\(([^)\s]+)\)/g, (_match, prefix: string, url: string) => {
    return `${prefix}[${url}](${url})`;
  });
}

function rewriteNotionLinkUrl(url: string, baseUrl?: string): string | undefined {
  try {
    return new URL(url).toString();
  } catch {
    if (!baseUrl) {
      return undefined;
    }
  }

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function normalizeRichTextLinksForNotion(value: unknown, baseUrl?: string): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      normalizeRichTextLinksForNotion(item, baseUrl);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const text = record.text;
  if (text && typeof text === "object") {
    const textRecord = text as Record<string, unknown>;
    const link = textRecord.link;
    if (link && typeof link === "object") {
      const linkRecord = link as Record<string, unknown>;
      const url = linkRecord.url;
      if (typeof url === "string") {
        const normalized = rewriteNotionLinkUrl(url, baseUrl);
        if (normalized) {
          linkRecord.url = normalized;
        } else {
          textRecord.link = null;
        }
      }
    }
  }

  for (const nested of Object.values(record)) {
    normalizeRichTextLinksForNotion(nested, baseUrl);
  }
}

export function markdownToNotionBlocksMartian(
  markdown: string,
  options: MarkdownToNotionBlocksOptions = {},
): NotionBlock[] {
  const blocks = markdownToBlocks(normalizeEmptyInlineLinksForNotion(markdown), {
    strictImageUrls: false,
    notionLimits: { truncate: false },
  });
  normalizeRichTextLinksForNotion(blocks, options.baseUrl);
  return blocks;
}

export function markdownToNotionBlocks(
  markdown: string,
  options: MarkdownToNotionBlocksOptions = {},
): NotionBlock[] {
  return markdownToNotionBlocksMartian(markdown, options);
}
