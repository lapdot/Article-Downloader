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

import { runPipeline } from "../src/core/pipeline.js";

describe("pipeline redaction", () => {
  test("meta.json does not include secret values or secret paths and records upload failure", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "pipeline-redaction-test-"));
    const secretValue = "secret-z-c0";

    const result = await runPipeline({
      url: "https://zhuanlan.zhihu.com/p/123",
      runtimeConfig: {
        cookies: [{ name: "z_c0", value: secretValue, domain: ".zhihu.com", path: "/" }],
        pipeline: {
          outDir,
          useHtmlStyleForImage: false,
        },
        notion: {},
      },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("notion upload failed");
    expect(result.metaPath).toBeDefined();

    const metaRaw = await readFile(result.metaPath!, "utf8");
    expect(metaRaw).not.toContain(secretValue);
    expect(metaRaw).not.toContain("cookies.secrets.local.json");
    expect(metaRaw).not.toContain("notion.secrets.local.json");
    expect(metaRaw).toContain("\"notionUploadAttempted\": true");
    expect(metaRaw).toContain("\"cookieCount\": 1");
  });
});
