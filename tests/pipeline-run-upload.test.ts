import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, test, vi } from "vitest";

vi.mock("../src/core/fetcher.js", () => ({
  downloadHtml: vi.fn(async ({ url }: { url: string }) => ({
    ok: true,
    url,
    downloadMethod: "cookieproxy",
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
import { markdownToNotionBlocks, uploadNotionBlocksToNotion } from "../src/core/notion.js";
import { parseHtmlToMetadata } from "../src/core/parser.js";
import type { ResolvedRuntimeConfig } from "../src/types.js";

function runtimeConfig(
  outDir: string,
  notion: ResolvedRuntimeConfig["notion"] = {},
  experimental: ResolvedRuntimeConfig["experimental"] = {
    author: {
      enabled: false,
      notionUpload: {
        enabled: false,
        propertyName: "Author",
        propertyType: "multi_select",
      },
    },
  },
): ResolvedRuntimeConfig {
  return {
    pipeline: {
      outDir,
      useHtmlStyleForImage: false,
      downloadMethod: "cookieproxy",
      cookieproxyPath: "/tmp/cookieproxy",
    },
    notion,
    experimental,
  };
}

describe("pipeline run upload behavior", () => {
  test("parse success + missing credentials => upload failure and ok=false", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: runtimeConfig(outDir),
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
      runtimeConfig: runtimeConfig(outDir, {
        notionToken: "invalid",
        databaseId: "db",
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("notion upload failed");
    expect(result.upload?.ok).toBe(false);
  });

  test("passes article URL into Notion transform for relative link rewriting", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    vi.mocked(markdownToNotionBlocks).mockClear();

    await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: runtimeConfig(outDir),
    });

    expect(markdownToNotionBlocks).toHaveBeenCalledWith("# Title", {
      baseUrl: "https://zhuanlan.zhihu.com/p/123",
    });
  });

  test("does not pass author whitelist when experimental author is disabled", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    vi.mocked(parseHtmlToMetadata).mockClear();

    await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: runtimeConfig(outDir),
    });

    expect(parseHtmlToMetadata).toHaveBeenCalledWith({
      html: "<html><body><h1>Title</h1></body></html>",
      sourceUrl: "https://zhuanlan.zhihu.com/p/123",
      authorWhitelist: undefined,
    });
  });

  test("passes whitelisted author to Notion multi-select property when both gates are enabled", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-upload-test-"));
    const whitelistPath = path.join(outDir, "authors.json");
    await writeFile(
      whitelistPath,
      JSON.stringify({
        authors: [
          {
            id: "canonical-author",
            canonicalName: "Canonical Author",
            notionName: "Canonical Author",
            sources: {
              zhihu: {
                names: ["Source Author"],
              },
            },
          },
        ],
      }),
      "utf8",
    );
    vi.mocked(parseHtmlToMetadata).mockResolvedValueOnce({
      ok: true,
      metadata: {
        articleUrl: "https://zhuanlan.zhihu.com/p/123",
        authorId: "Source Author",
        authorHomepage: "https://www.zhihu.com/people/source-author",
        author: {
          id: "canonical-author",
          name: "Canonical Author",
          notionName: "Canonical Author",
        },
      },
    });
    vi.mocked(uploadNotionBlocksToNotion).mockResolvedValueOnce({
      ok: true,
      pageId: "ok-page",
      blocksAppended: 0,
    });

    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: runtimeConfig(
        outDir,
        {
          notionToken: "token",
          databaseId: "db",
        },
        {
          author: {
            enabled: true,
            whitelistPath,
            notionUpload: {
              enabled: true,
              propertyName: "Author",
              propertyType: "multi_select",
            },
          },
        },
      ),
    });

    expect(result.ok).toBe(true);
    expect(parseHtmlToMetadata).toHaveBeenCalledWith({
      html: "<html><body><h1>Title</h1></body></html>",
      sourceUrl: "https://zhuanlan.zhihu.com/p/123",
      authorWhitelist: {
        authors: [
          {
            id: "canonical-author",
            canonicalName: "Canonical Author",
            platforms: {
              zhihu: {
                source: {
                  names: ["Source Author"],
                },
              },
              notion: {
                destination: {
                  name: "Canonical Author",
                },
              },
            },
          },
        ],
      },
    });
    expect(uploadNotionBlocksToNotion).toHaveBeenCalledWith({
      blocks: [],
      notionToken: "token",
      databaseId: "db",
      pageProperties: {
        Author: {
          multi_select: [{ name: "Canonical Author" }],
        },
      },
    });
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
      runtimeConfig: runtimeConfig(outDir, {
        notionToken: "token",
        databaseId: "db",
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.upload?.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });
});
