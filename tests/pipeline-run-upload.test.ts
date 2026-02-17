import path from "node:path";
import { mkdtemp } from "node:fs/promises";
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
    fetchedAt: "2026-02-17T00:00:00.000Z",
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
    pageId: "page-id",
    blocksAppended: 0,
  })),
}));

import { runPipeline } from "../src/core/pipeline.js";
import { uploadNotionBlocksToNotion } from "../src/core/notion.js";

describe("pipeline run upload behavior", () => {
  test("parse success + missing credentials => upload failure and ok=false", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: {
        cookies: [{ name: "z_c0", value: "cookie-v", domain: ".zhihu.com", path: "/" }],
        pipeline: {
          outDir,
          useHtmlStyleForImage: false,
        },
        notion: {},
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("notion upload failed");
    expect(result.upload?.ok).toBe(false);
    expect(result.upload?.reason).toBe("missing notion secrets");
    expect(result.notionBlocksPath).toBeTruthy();
  });

  test("parse success + upload api failure => ok=false", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    vi.mocked(uploadNotionBlocksToNotion).mockResolvedValueOnce({
      ok: false,
      reason: "invalid notion token",
      errorCode: "E_NOTION_API",
    });

    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: {
        cookies: [{ name: "z_c0", value: "cookie-v", domain: ".zhihu.com", path: "/" }],
        pipeline: {
          outDir,
          useHtmlStyleForImage: false,
        },
        notion: {
          notionToken: "invalid",
          databaseId: "db",
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("notion upload failed");
    expect(result.upload?.ok).toBe(false);
  });

  test("parse success + upload api success => ok=true", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    vi.mocked(uploadNotionBlocksToNotion).mockResolvedValueOnce({
      ok: true,
      pageId: "ok-page",
      blocksAppended: 0,
    });

    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: {
        cookies: [{ name: "z_c0", value: "cookie-v", domain: ".zhihu.com", path: "/" }],
        pipeline: {
          outDir,
          useHtmlStyleForImage: false,
        },
        notion: {
          notionToken: "token",
          databaseId: "db",
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.upload?.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
