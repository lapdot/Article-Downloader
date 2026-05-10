import { markdownToBlocks } from "@tryfabric/martian";

export type NotionBlock = ReturnType<typeof markdownToBlocks>[number];

function normalizeEmptyInlineLinksForNotion(markdown: string): string {
  // Martian drops inline links with empty label text (`[](url)`), so we promote the
  // URL into the visible label before conversion. Keep image syntax untouched.
  return markdown.replace(/(^|[^!])\[\]\(([^)\s]+)\)/g, (_match, prefix: string, url: string) => {
    return `${prefix}[${url}](${url})`;
  });
}

export function markdownToNotionBlocksMartian(markdown: string): NotionBlock[] {
  return markdownToBlocks(normalizeEmptyInlineLinksForNotion(markdown), {
    strictImageUrls: false,
    notionLimits: { truncate: false },
  });
}

export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  return markdownToNotionBlocksMartian(markdown);
}
