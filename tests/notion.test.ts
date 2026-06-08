import { describe, expect, test } from "vitest";
import {
  markdownToNotionBlocks,
  markdownToNotionBlocksMartian,
} from "../src/core/notion.js";

function collectRichTextLinks(value: unknown): Array<{ content: string; url?: string }> {
  const links: Array<{ content: string; url?: string }> = [];
  const walk = (nested: unknown): void => {
    if (Array.isArray(nested)) {
      for (const item of nested) {
        walk(item);
      }
      return;
    }

    if (!nested || typeof nested !== "object") {
      return;
    }

    const record = nested as Record<string, unknown>;
    const text = record.text;
    if (text && typeof text === "object") {
      const textRecord = text as Record<string, unknown>;
      const content = textRecord.content;
      const link = textRecord.link;
      if (typeof content === "string" && link && typeof link === "object") {
        links.push({
          content,
          url: (link as Record<string, unknown>).url as string | undefined,
        });
      }
    }

    for (const child of Object.values(record)) {
      walk(child);
    }
  };

  walk(value);
  return links;
}

describe("markdownToNotionBlocks", () => {
  test("converts headings, lists, and code fences", () => {
    const markdown = [
      "# Title",
      "",
      "Paragraph text.",
      "",
      "- item one",
      "1. number one",
      "",
      "```ts",
      "const x = 1;",
      "```",
    ].join("\n");

    const blocks = markdownToNotionBlocks(markdown);
    expect(blocks.length).toBeGreaterThanOrEqual(5);
    expect(blocks[0].type).toBe("heading_1");
    expect(blocks.some((b) => b.type === "bulleted_list_item")).toBe(true);
    expect(blocks.some((b) => b.type === "numbered_list_item")).toBe(true);
    expect(blocks.some((b) => b.type === "code")).toBe(true);
  });

  test("keeps martian implementation available", () => {
    const markdown = ["# Title", "", "Paragraph text."].join("\n");

    const martianBlocks = markdownToNotionBlocksMartian(markdown);

    expect(martianBlocks.length).toBeGreaterThan(0);
    expect(martianBlocks[0].type).toBe("heading_1");
  });

  test("preserves escaped square brackets as literal text", () => {
    const markdown = ["Emoji \\[捂脸\\]", "", "[捂脸]: https://example.com"].join("\n");

    const blocks = markdownToNotionBlocksMartian(markdown);
    const richText = blocks[0]?.type === "paragraph" ? blocks[0].paragraph.rich_text : [];
    const content = richText.map((item) => item.type === "text" ? item.text.content : "").join("");

    expect(content).toContain("Emoji [捂脸]");
  });

  test("preserves escaped dollar signs as literal text", () => {
    const markdown = "Price \\$5 to \\$7.";

    const blocks = markdownToNotionBlocks(markdown);
    const richText = blocks[0]?.type === "paragraph" ? blocks[0].paragraph.rich_text : [];

    expect(richText).toHaveLength(1);
    expect(richText[0]?.type).toBe("text");
    if (richText[0]?.type === "text") {
      expect(richText[0].text.content).toBe("Price $5 to $7.");
    }
  });

  test("preserves dollar-delimited markdown as an inline equation", () => {
    const markdown = "Formula $x+y=z$.";

    const blocks = markdownToNotionBlocks(markdown);
    const richText = blocks[0]?.type === "paragraph" ? blocks[0].paragraph.rich_text : [];
    const equation = richText.find((item) => item.type === "equation");

    expect(equation?.type).toBe("equation");
    if (equation?.type === "equation") {
      expect(equation.equation.expression).toBe("x+y=z");
    }
  });

  test("preserves empty-text inline links by promoting the url into link text", () => {
    const markdown = ["Reference:", "", "[](https://example.com/path?q=1)"].join("\n");

    const blocks = markdownToNotionBlocks(markdown);
    const paragraph = blocks[1]?.type === "paragraph" ? blocks[1].paragraph.rich_text : [];
    const text = paragraph[0];

    expect(text?.type).toBe("text");
    expect(text?.text.content).toBe("https://example.com/path?q=1");
    expect(text?.text.link?.url).toBe("https://example.com/path?q=1");
  });

  test("does not change labeled links", () => {
    const markdown = ["[Example](https://example.com/path?q=1)"].join("\n");

    const blocks = markdownToNotionBlocks(markdown);
    const paragraph = blocks[0]?.type === "paragraph" ? blocks[0].paragraph.rich_text : [];
    const text = paragraph[0];

    expect(text?.type).toBe("text");
    expect(text?.text.content).toBe("Example");
    expect(text?.text.link?.url).toBe("https://example.com/path?q=1");
  });

  test("rewrites fragment-only links to absolute source URLs", () => {
    const markdown = [
      "Footnote [\\[1\\]](#ref_1)",
      "",
      "1. [^](#ref_1_0) Details",
    ].join("\n");

    const blocks = markdownToNotionBlocks(markdown, {
      baseUrl: "https://www.zhihu.com/question/53362161/answer/2023382339456091047",
    });
    const links = collectRichTextLinks(blocks);

    expect(links).toEqual(
      expect.arrayContaining([
        {
          content: "[1]",
          url: "https://www.zhihu.com/question/53362161/answer/2023382339456091047#ref_1",
        },
        {
          content: "^",
          url: "https://www.zhihu.com/question/53362161/answer/2023382339456091047#ref_1_0",
        },
      ]),
    );
  });

  test("rewrites relative markdown links to absolute source URLs", () => {
    const markdown = "[Next](/articles/next)";

    const blocks = markdownToNotionBlocks(markdown, {
      baseUrl: "https://example.com/articles/current",
    });
    const [link] = collectRichTextLinks(blocks);

    expect(link).toEqual({
      content: "Next",
      url: "https://example.com/articles/next",
    });
  });

  test("keeps absolute markdown links unchanged when a source URL is provided", () => {
    const markdown = "[Example](https://example.net/path)";

    const blocks = markdownToNotionBlocks(markdown, {
      baseUrl: "https://example.com/articles/current",
    });
    const [link] = collectRichTextLinks(blocks);

    expect(link).toEqual({
      content: "Example",
      url: "https://example.net/path",
    });
  });

  test("drops invalid relative link annotations when no source URL is provided", () => {
    const markdown = "[\\[1\\]](#ref_1)";

    const blocks = markdownToNotionBlocks(markdown);
    const paragraph = blocks[0]?.type === "paragraph" ? blocks[0].paragraph.rich_text : [];
    const text = paragraph[0];

    expect(text?.type).toBe("text");
    expect(text?.text.content).toBe("[1]");
    expect(text?.text.link).toBeNull();
  });

  test("does not change markdown image syntax", () => {
    const markdown = ["![](https://example.com/image.png)"].join("\n");

    const blocks = markdownToNotionBlocks(markdown);

    expect(blocks[0]?.type).toBe("image");
  });

  test("preserves multiple empty-text inline links in one document", () => {
    const markdown = [
      "First:",
      "",
      "[](https://example.com/one)",
      "",
      "Second:",
      "",
      "[](https://example.com/two)",
    ].join("\n");

    const blocks = markdownToNotionBlocks(markdown);
    const firstLink = blocks[1]?.type === "paragraph" ? blocks[1].paragraph.rich_text[0] : undefined;
    const secondLink = blocks[3]?.type === "paragraph" ? blocks[3].paragraph.rich_text[0] : undefined;

    expect(firstLink?.type).toBe("text");
    expect(firstLink?.text.content).toBe("https://example.com/one");
    expect(firstLink?.text.link?.url).toBe("https://example.com/one");
    expect(secondLink?.type).toBe("text");
    expect(secondLink?.text.content).toBe("https://example.com/two");
    expect(secondLink?.text.link?.url).toBe("https://example.com/two");
  });
});
