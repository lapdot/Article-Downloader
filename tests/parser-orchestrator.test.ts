import { describe, expect, test } from "vitest";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "../src/core/parser.js";
import { substackFixture, zhihuAnswerFixture } from "./helpers/parser-fixtures.js";

describe("parser orchestration", () => {
  test("fails on unsupported host", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuAnswerFixture,
      sourceUrl: "https://example.com/article",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_UNSUPPORTED_SITE");
  });

  test("fails on unsupported supported-host path", async () => {
    const result = await parseHtmlToMarkdown({
      html: zhihuAnswerFixture,
      sourceUrl: "https://www.zhihu.com/question/111111111",
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_PARSE_UNSUPPORTED_SITE");
  });

  test("dispatches markdown parsing across supported sources", async () => {
    const zhihuResult = await parseHtmlToMarkdown({
      html: zhihuAnswerFixture,
      sourceUrl: "https://www.zhihu.com/question/111111111/answer/1111111111111111111",
    });
    const substackResult = await parseHtmlToMarkdown({
      html: substackFixture,
      sourceUrl: "https://substack.com/@michaeljburry/p-196918166",
    });

    expect(zhihuResult.ok).toBe(true);
    expect(zhihuResult.title).toBe("Zhihu Fixture Title");
    expect(substackResult.ok).toBe(true);
    expect(substackResult.title).toBe("Trading Post Friday May 8, 2026");
  });

  test("dispatches metadata parsing across supported sources", async () => {
    const zhihuResult = await parseHtmlToMetadata({
      html: zhihuAnswerFixture,
      sourceUrl: "https://www.zhihu.com/question/1/answer/2",
    });
    const substackResult = await parseHtmlToMetadata({
      html: substackFixture,
      sourceUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    });

    expect(zhihuResult.ok).toBe(true);
    expect(zhihuResult.metadata?.articleUrl).toBe("https://www.zhihu.com/question/1/answer/2");
    expect(substackResult.ok).toBe(true);
    expect(substackResult.metadata?.articleUrl).toBe(
      "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    );
  });
});
