import { describe, expect, test } from "vitest";
import { matchAuthor } from "../src/core/author.js";
import type { AuthorWhitelist } from "../src/types.js";

const whitelist: AuthorWhitelist = {
  authors: [
    {
      id: "trita-parsi",
      canonicalName: "Trita Parsi",
      notionName: "Trita Parsi",
      sources: {
        substack: {
          handles: ["tritaparsi"],
          names: ["Trita Parsi"],
          urls: ["https://substack.com/@tritaparsi"],
        },
        zhihu: {
          names: ["Trita Parsi"],
          urls: ["https://www.zhihu.com/people/trita-parsi"],
        },
      },
    },
  ],
};

describe("author whitelist matching", () => {
  test("matches substack author handle from url", () => {
    const author = matchAuthor({
      sourceUrl: "https://substack.com/@tritaparsi/p-201184379",
      source: { sourceId: "substack", contentType: "post" },
      whitelist,
      metadata: {
        articleUrl: "https://tritaparsi.substack.com/p/example",
        authorId: "Different Display",
        authorHomepage: "https://substack.com/@different",
      },
    });

    expect(author).toEqual({
      id: "trita-parsi",
      name: "Trita Parsi",
      notionName: "Trita Parsi",
    });
  });

  test("matches substack author from extracted metadata", () => {
    const author = matchAuthor({
      sourceUrl: "https://tritaparsi.substack.com/p/example",
      source: { sourceId: "substack", contentType: "post" },
      whitelist,
      metadata: {
        articleUrl: "https://tritaparsi.substack.com/p/example",
        authorId: "Trita Parsi",
        authorHomepage: "https://substack.com/@tritaparsi",
      },
    });

    expect(author?.id).toBe("trita-parsi");
  });

  test("matches zhihu author from extracted metadata", () => {
    const author = matchAuthor({
      sourceUrl: "https://zhuanlan.zhihu.com/p/123",
      source: { sourceId: "zhihu", contentType: "post" },
      whitelist,
      metadata: {
        articleUrl: "https://zhuanlan.zhihu.com/p/123",
        authorId: "Trita Parsi",
        authorHomepage: "https://www.zhihu.com/people/trita-parsi",
      },
    });

    expect(author?.id).toBe("trita-parsi");
  });

  test("returns undefined for unknown authors", () => {
    const author = matchAuthor({
      sourceUrl: "https://substack.com/@unknown/p-201184379",
      source: { sourceId: "substack", contentType: "post" },
      whitelist,
      metadata: {
        articleUrl: "https://unknown.substack.com/p/example",
        authorId: "Unknown Author",
        authorHomepage: "https://substack.com/@unknown",
      },
    });

    expect(author).toBeUndefined();
  });
});
