import { describe, expect, test, vi } from "vitest";

const pagesCreate = vi.hoisted(() => vi.fn(async () => ({ id: "page-id" })));
const blocksAppend = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("@notionhq/client", () => ({
  APIResponseError: class APIResponseError extends Error {
    status?: number;
    code?: string;
  },
  Client: vi.fn(() => ({
    pages: {
      create: pagesCreate,
    },
    blocks: {
      children: {
        append: blocksAppend,
      },
    },
  })),
}));

import { uploadNotionBlocksToNotion } from "../src/core/notion.js";

describe("uploadNotionBlocksToNotion", () => {
  test("creates pages with empty properties by default", async () => {
    pagesCreate.mockClear();

    const result = await uploadNotionBlocksToNotion({
      blocks: [],
      notionToken: "token",
      databaseId: "database",
    });

    expect(result.ok).toBe(true);
    expect(pagesCreate).toHaveBeenCalledWith({
      parent: { database_id: "database" },
      properties: {},
    });
  });

  test("forwards author and topic multi-select properties when provided", async () => {
    pagesCreate.mockClear();

    const result = await uploadNotionBlocksToNotion({
      blocks: [],
      notionToken: "token",
      databaseId: "database",
      pageProperties: {
        Author: {
          multi_select: [{ name: "Canonical Author" }],
        },
        Topics: {
          multi_select: [{ name: "Thailand" }, { name: "Southeast Asia" }],
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(pagesCreate).toHaveBeenCalledWith({
      parent: { database_id: "database" },
      properties: {
        Author: {
          multi_select: [{ name: "Canonical Author" }],
        },
        Topics: {
          multi_select: [{ name: "Thailand" }, { name: "Southeast Asia" }],
        },
      },
    });
  });

  test("does not rewrite pageProperties into select payloads", async () => {
    pagesCreate.mockClear();

    await uploadNotionBlocksToNotion({
      blocks: [],
      notionToken: "token",
      databaseId: "database",
      pageProperties: {
        Author: {
          multi_select: [{ name: "Canonical Author" }],
        },
      },
    });

    const properties = pagesCreate.mock.calls[0]?.[0]?.properties as Record<string, unknown>;
    expect(JSON.stringify(properties)).not.toContain("\"select\"");
    expect(JSON.stringify(properties)).toContain("\"multi_select\"");
  });
});
