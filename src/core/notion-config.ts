import { readJsonFile } from "../utils/fs.js";
import type { NotionConfig } from "../types.js";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function readNotionConfig(filePath: string): Promise<NotionConfig> {
  const raw = await readJsonFile<unknown>(filePath);
  if (!raw || typeof raw !== "object") {
    throw new Error("invalid notion config: expected a JSON object");
  }

  const config = raw as Record<string, unknown>;
  if (!isNonEmptyString(config.notionToken)) {
    throw new Error("invalid notion config: notionToken is required");
  }
  if (!isNonEmptyString(config.databaseId)) {
    throw new Error("invalid notion config: databaseId is required");
  }

  return {
    notionToken: config.notionToken,
    databaseId: config.databaseId,
  };
}
