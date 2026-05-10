import { describe, expect, test } from "vitest";
import {
  markdownToNotionBlocks,
  markdownToNotionBlocksMartian,
} from "../src/core/notion.js";

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
