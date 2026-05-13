import { describe, expect, test } from "vitest";
import { parseSourceUrl, resolveSource } from "../src/adapters/resolve-source.js";

describe("shared source resolution", () => {
  test("parses and resolves zhihu urls", () => {
    const url = parseSourceUrl("https://www.zhihu.com/question/1/answer/2");

    expect(url).toBeInstanceOf(URL);
    expect(resolveSource(url!)).toMatchObject({
      adapter: { sourceId: "zhihu" },
      source: { sourceId: "zhihu", contentType: "answer" },
    });
  });

  test("parses and resolves zhihu post urls", () => {
    const url = parseSourceUrl("https://zhuanlan.zhihu.com/p/3333333333333333333");

    expect(url).toBeInstanceOf(URL);
    expect(resolveSource(url!)).toMatchObject({
      adapter: { sourceId: "zhihu" },
      source: { sourceId: "zhihu", contentType: "post" },
    });
  });

  test("parses and resolves substack urls", () => {
    const url = parseSourceUrl("https://examplepublication.substack.com/p/canonical-post");

    expect(url).toBeInstanceOf(URL);
    expect(resolveSource(url!)).toMatchObject({
      adapter: { sourceId: "substack" },
      source: { sourceId: "substack", contentType: "post" },
    });
  });

  test("parses and resolves foreignpolicy urls", () => {
    const url = parseSourceUrl("https://foreignpolicy.com/2026/05/12/example-article/");

    expect(url).toBeInstanceOf(URL);
    expect(resolveSource(url!)).toMatchObject({
      adapter: { sourceId: "foreignpolicy" },
      source: { sourceId: "foreignpolicy", contentType: "post" },
    });
  });

  test("returns null for unsupported hosts", () => {
    const url = parseSourceUrl("https://example.com/article");

    expect(url).toBeInstanceOf(URL);
    expect(resolveSource(url!)).toBeNull();
  });

  test("returns null for unsupported paths on supported hosts", () => {
    const zhihuUrl = parseSourceUrl("https://www.zhihu.com/question/111111111");
    const substackUrl = parseSourceUrl("https://substack.com/@exampleauthor/about");

    expect(zhihuUrl).toBeInstanceOf(URL);
    expect(substackUrl).toBeInstanceOf(URL);
    expect(resolveSource(zhihuUrl!)).toBeNull();
    expect(resolveSource(substackUrl!)).toBeNull();
  });

  test("returns null for invalid urls", () => {
    expect(parseSourceUrl("not a url")).toBeNull();
  });
});
