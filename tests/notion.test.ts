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
});
