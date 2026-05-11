import { describe, expect, test } from "vitest";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "../src/core/parser.js";
import { substackFixture, substackPreloadOnlyFixture } from "./helpers/parser-fixtures.js";

describe("substack markdown parsing", () => {
  test("parses substack markdown from publication url", async () => {
    const result = await parseHtmlToMarkdown({
      html: substackFixture,
      sourceUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Trading Post Friday May 8, 2026");
    expect(result.markdown).toContain("# Trading Post Friday May 8, 2026");
    expect(result.markdown).toContain("\n\nTGIF\n\n");
    expect(result.markdown).toContain("[Michael Burry](https://substack.com/@michaeljburry)");
    expect(result.markdown).toContain("May 08, 2026");
    expect(result.markdown).toContain("Huge rally in stocks today. Very much more of the same.");
    expect(result.markdown).toContain("![](https://cdn.example.com/original.png)");
    expect(result.markdown).not.toContain("](https://cdn.example.com/full.png)");
    expect(result.markdown).not.toContain("This post is for paid subscribers");
  });

  test("parses substack markdown from aggregator url", async () => {
    const result = await parseHtmlToMarkdown({
      html: substackFixture,
      sourceUrl: "https://substack.com/@michaeljburry/p-196918166",
    });

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("# Trading Post Friday May 8, 2026");
    expect(result.markdown).toContain("[Michael Burry](https://substack.com/@michaeljburry)");
  });

  test("parses substack markdown from preload fallback when visible body is missing", async () => {
    const result = await parseHtmlToMarkdown({
      html: substackPreloadOnlyFixture,
      sourceUrl: "https://substack.com/@exampleauthor/p-123456789",
    });

    expect(result.ok).toBe(true);
    expect(result.title).toBe("Fallback Substack Title");
    expect(result.markdown).toContain("# Fallback Substack Title");
    expect(result.markdown).toContain("\n\nFallback subtitle\n\n");
    expect(result.markdown).toContain("[Example Author](https://substack.com/@exampleauthor)");
    expect(result.markdown).toContain("Fallback body paragraph.");
    expect(result.markdown).toContain("Second paragraph.");
  });
});

describe("substack metadata parsing", () => {
  test("extracts substack metadata from publication url", async () => {
    const result = await parseHtmlToMetadata({
      html: substackFixture,
      sourceUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
      authorId: "Michael Burry",
      authorHomepage: "https://substack.com/@michaeljburry",
      publishTime: "2026-05-08T16:21:07+00:00",
      editTime: "2026-05-08T16:21:53+00:00",
    });
  });

  test("extracts substack metadata from aggregator url using canonical article url", async () => {
    const result = await parseHtmlToMetadata({
      html: substackFixture,
      sourceUrl: "https://substack.com/@michaeljburry/p-196918166",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
      authorId: "Michael Burry",
      authorHomepage: "https://substack.com/@michaeljburry",
      publishTime: "2026-05-08T16:21:07+00:00",
      editTime: "2026-05-08T16:21:53+00:00",
    });
  });

  test("extracts substack metadata from preload fallback", async () => {
    const result = await parseHtmlToMetadata({
      html: substackPreloadOnlyFixture,
      sourceUrl: "https://substack.com/@exampleauthor/p-123456789",
    });

    expect(result.ok).toBe(true);
    expect(result.metadata).toEqual({
      articleUrl: "https://examplepublication.substack.com/p/fallback-post",
      authorId: "Example Author",
      authorHomepage: "https://substack.com/@exampleauthor",
      publishTime: "2026-06-01T10:00:00.000Z",
      editTime: "2026-06-01T10:05:00.000Z",
    });
  });
});
