import { describe, expect, test } from "vitest";
import {
  matchAuthor,
  migrateLegacyAuthorWhitelist,
  parseAuthorWhitelist,
} from "../src/core/author.js";
import type { AuthorWhitelist } from "../src/types.js";

const whitelist: AuthorWhitelist = {
  authors: [
    {
      id: "trita-parsi",
      canonicalName: "Trita Parsi",
      platforms: {
        substack: {
          source: {
            handles: ["tritaparsi"],
            names: ["Trita Parsi"],
            urls: ["https://substack.com/@tritaparsi"],
          },
        },
        zhihu: {
          source: {
            names: ["Trita Parsi"],
            urls: ["https://www.zhihu.com/people/trita-parsi"],
          },
        },
        notion: {
          destination: {
            name: "Trita Parsi",
          },
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

  test("returns configured default topics for a matched author", () => {
    const author = matchAuthor({
      sourceUrl: "https://zhuanlan.zhihu.com/p/123",
      source: { sourceId: "zhihu", contentType: "post" },
      whitelist: {
        authors: [
          {
            id: "saechia",
            canonicalName: "Saechia",
            platforms: {
              zhihu: { source: { names: ["Saechia"] } },
              notion: {
                destination: {
                  name: "saechia",
                  topics: ["Thailand", "Southeast Asia"],
                },
              },
            },
          },
        ],
      },
      metadata: {
        articleUrl: "https://zhuanlan.zhihu.com/p/123",
        authorId: "Saechia",
      },
    });

    expect(author?.defaultTopics).toEqual(["Thailand", "Southeast Asia"]);
  });

  test("rejects an empty default topic list", () => {
    expect(() =>
      parseAuthorWhitelist({
        authors: [
          {
            id: "saechia",
            canonicalName: "Saechia",
            platforms: {
              notion: { destination: { name: "saechia", topics: [] } },
            },
          },
        ],
      }),
    ).toThrowError("platforms.notion.destination.topics: Array must contain at least 1 element(s)");
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

  test("migrates legacy source aliases and Notion name into platform capabilities", () => {
    expect(
      migrateLegacyAuthorWhitelist({
        authors: [
          {
            id: "trita-parsi",
            canonicalName: "Trita Parsi",
            notionName: "Trita Parsi",
            sources: {
              substack: {
                handles: ["tritaparsi"],
              },
              zhihu: {
                names: ["Trita Parsi"],
              },
            },
          },
        ],
      }),
    ).toEqual({
      authors: [
        {
          id: "trita-parsi",
          canonicalName: "Trita Parsi",
          platforms: {
            substack: { source: { handles: ["tritaparsi"] } },
            zhihu: { source: { names: ["Trita Parsi"] } },
            notion: { destination: { name: "Trita Parsi" } },
          },
        },
      ],
    });
  });

  test("normalizes a legacy whitelist during normal parsing", () => {
    const parsed = parseAuthorWhitelist({
      authors: [
        {
          id: "trita-parsi",
          canonicalName: "Trita Parsi",
          notionName: "Trita Parsi",
        },
      ],
    });

    expect(parsed.legacy).toBe(true);
    expect(parsed.whitelist.authors[0]?.platforms.notion?.destination?.name).toBe("Trita Parsi");
  });

  test("rejects mixed legacy and platform-capability author entries", () => {
    expect(() =>
      parseAuthorWhitelist({
        authors: [
          {
            id: "trita-parsi",
            canonicalName: "Trita Parsi",
            notionName: "Trita Parsi",
            platforms: {},
          },
        ],
      }),
    ).toThrowError("entries cannot mix legacy sources/notionName with platforms");
  });
});
