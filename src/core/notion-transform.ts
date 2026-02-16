import { markdownToBlocks } from "@tryfabric/martian";

export type NotionBlock = ReturnType<typeof markdownToBlocks>[number];

export function markdownToNotionBlocksMartian(markdown: string): NotionBlock[] {
  return markdownToBlocks(markdown, {
    strictImageUrls: false,
    notionLimits: { truncate: false },
  });
}

export function markdownToNotionBlocks(markdown: string): NotionBlock[] {
  return markdownToNotionBlocksMartian(markdown);
}
