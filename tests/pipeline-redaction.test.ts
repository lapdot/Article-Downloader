import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test, vi } from "vitest";

vi.mock("../src/adapters/zhihu.js", () => ({
  verifyZhihuCookies: vi.fn(async () => ({ ok: true, statusCode: 200 })),
}));

vi.mock("../src/core/fetcher.js", () => ({
  downloadHtml: vi.fn(async ({ url }: { url: string }) => ({
    ok: true,
    url,
    finalUrl: url,
    statusCode: 200,
    html: "<html><body><h1>Title</h1></body></html>",
    fetchedAt: "2026-02-16T00:00:00.000Z",
  })),
}));

vi.mock("../src/core/parser.js", () => ({
  parseHtmlToMetadata: vi.fn(async ({ sourceUrl }: { sourceUrl: string }) => ({
    ok: true,
    metadata: {
      articleUrl: sourceUrl,
    },
  })),
  parseHtmlToMarkdown: vi.fn(async () => ({
    ok: true,
    title: "Title",
    markdown: "# Title",
  })),
}));

vi.mock("../src/core/notion.js", () => ({
  markdownToNotionBlocks: vi.fn(() => []),
  uploadNotionBlocksToNotion: vi.fn(async () => ({
    ok: true,
    pageId: "mock-page-id",
    blocksAppended: 0,
  })),
}));

import { runPipeline } from "../src/core/pipeline.js";

describe("pipeline redaction", () => {
  test("meta.json redacts secret values and secret paths while keeping upload diagnostics", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-redaction-test-"));
    const secretValue = "secret-z-c0";
    const secretPath = "/tmp/private/notion.secrets.local.json";
    const secretToken = "ntn_abcd1234abcd1234";

    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: {
        cookies: [{ name: "z_c0", value: secretValue, domain: ".zhihu.com", path: "/" }],
        pipeline: {
          outDir,
          useHtmlStyleForImage: false,
        },
        notion: {
          notionToken: secretToken,
          databaseId: "database_x",
        },
      },
      notionSetupError: `E_FILE_NOT_FOUND: notion secrets: ${secretPath}; token=${secretToken}`,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("notion upload failed");
    expect(result.metaPath).toBeDefined();

    const metaRaw = await readFile(result.metaPath!, "utf8");
    expect(metaRaw).not.toContain(secretValue);
    expect(metaRaw).not.toContain(secretToken);
    expect(metaRaw).not.toContain(secretPath);
    expect(metaRaw).not.toContain("cookies.secrets.local.json");
    expect(metaRaw).not.toContain("notion.secrets.local.json");
    expect(metaRaw).toContain("\"notionUploadAttempted\": true");
    expect(metaRaw).toContain("\"cookieCount\": 1");
    expect(metaRaw).toContain("\"upload\": {");
    expect(metaRaw).toContain("\"errorCode\": \"E_NOTION_API\"");
    expect(metaRaw).toContain("\"reason\": \"notion upload failed\"");
  });
});
