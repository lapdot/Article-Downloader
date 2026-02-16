import { Client, APIResponseError } from "@notionhq/client";
import type { UploadResult } from "../types.js";
import type { NotionBlock } from "./notion-transform.js";

const MAX_APPEND_BLOCKS = 90;

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 3;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      const isRateLimited =
        error instanceof APIResponseError &&
        (error.status === 429 || error.code === "rate_limited");
      if (!isRateLimited || attempt >= maxRetries) {
        throw error;
      }
      await sleep(250 * 2 ** attempt);
    }
  }
}

interface UploadBlocksInput {
  blocks: NotionBlock[];
  title: string;
  sourceUrl: string;
  fetchedAt: string;
  notionToken: string;
  databaseId: string;
}

export async function uploadNotionBlocksToNotion(input: UploadBlocksInput): Promise<UploadResult> {
  try {
    const client = new Client({ auth: input.notionToken });
    const blocks = input.blocks;

    const page = await withRateLimitRetry(() =>
      client.pages.create({
        parent: { database_id: input.databaseId },
        properties: {},
      }),
    );

    let appended = 0;
    for (const blockChunk of chunk(blocks, MAX_APPEND_BLOCKS)) {
      await withRateLimitRetry(() =>
        client.blocks.children.append({
          block_id: page.id,
          children: blockChunk as never,
        }),
      );
      appended += blockChunk.length;
    }

    return {
      ok: true,
      pageId: page.id,
      blocksAppended: appended,
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown notion upload error",
      errorCode: "E_NOTION_API",
    };
  }
}
