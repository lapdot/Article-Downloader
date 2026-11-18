import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { describe, expect, test } from "vitest";
import { createTurndownService } from "../src/adapters/parser-support.js";
import { markdownToNotionBlocks, type NotionBlock } from "../src/core/notion.js";
import { parseHtmlToMarkdown } from "../src/core/parser.js";

function getTables(markdown: string) {
  return markdownToNotionBlocks(markdown).filter((block) => block.type === "table");
}

function getCellText(block: Extract<NotionBlock, { type: "table" }>) {
  return block.table.children?.map((row) => {
    if (row.type !== "table_row") {
      throw new Error("Expected a Notion table row");
    }
    return row.table_row.cells.map((cell) => cell.map((text) => {
      if (text.type !== "text") {
        throw new Error("Expected a text cell");
      }
      return text.text.content;
    }).join(""));
  });
}

describe("HTML table conversion", () => {
  test("preserves all cells and row order from a captured Zhihu table layout", async () => {
    const html = readFileSync("tests/fixtures/zhihu-zhuanlan-tables.html", "utf8");
    const result = await parseHtmlToMarkdown({
      html,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(result.ok).toBe(true);
    const markdown = result.markdown ?? "";
    expect(markdown).toContain("\n\nFirst company.\n\n| Year | Revenue / Sh");
    expect(markdown).toContain("\n\nRevenue comparison.\n\n| Company |");
    expect(markdown).toContain("\n\nClosing paragraph.");

    const tables = getTables(markdown);
    expect(tables.map(({ table }) => [table.children?.length, table.table_width])).toEqual([
      [5, 5],
      [5, 5],
      [7, 4],
    ]);
    expect(tables.every(({ table }) => table.has_column_header)).toBe(true);

    const $ = load(html);
    const expected = $("table").toArray().map((table) =>
      $(table).find("tr").toArray().map((row) =>
        $(row).children("th, td").toArray().map((cell) => $(cell).text()),
      ),
    );
    expect(tables.map(getCellText)).toEqual(expected);
  });

  test("keeps Substack headerless data, pads short rows, and separates the caption", async () => {
    const result = await parseHtmlToMarkdown({
      html: '<article><h1 class="post-title">Example</h1><div class="body markup">'
        + '<p>Before.</p><table><caption><em>Details</em></caption>'
        + '<tr><td>First</td><td>Value</td><td></td></tr><tr><td>Second</td></tr>'
        + '</table><p>After.</p></div></article>',
      sourceUrl: "https://examplepublication.substack.com/p/table",
    });

    expect(result.ok).toBe(true);
    const markdown = result.markdown ?? "";
    expect(markdown).toContain(
      "\n\nBefore.\n\n_Details_\n\n|  |  |  |\n| --- | --- | --- |\n"
      + "| First | Value |  |\n| Second |  |  |\n\nAfter.",
    );
    const tables = getTables(markdown);
    expect(tables).toHaveLength(1);
    expect(getCellText(tables[0])).toEqual([["", "", ""], ["First", "Value", ""], ["Second", "", ""]]);
  });

  test("expands combined spans without carrying them into the next row group", () => {
    const markdown = createTurndownService({ useHtmlStyleForImage: false }).turndown(
      '<table><thead><tr><td colspan="2">Group</td><td>Score</td></tr></thead>'
      + '<tbody><tr><td colspan="2" rowspan="0">Shared</td><td>A</td></tr><tr><td>B</td></tr></tbody>'
      + '<tbody><tr><td rowspan="9">Next</td><td>C</td><td>D</td></tr><tr><td>E</td><td>F</td></tr></tbody>'
      + '<tfoot><tr><td>Total</td><td colspan="2">Done</td></tr></tfoot></table>',
    );

    const tables = getTables(markdown);
    expect(tables).toHaveLength(1);
    expect(getCellText(tables[0])).toEqual([
      ["Group", "", "Score"],
      ["Shared", "", "A"],
      ["", "", "B"],
      ["Next", "C", "D"],
      ["", "E", "F"],
      ["Total", "Done", ""],
    ]);
  });

  test("preserves inline formatting and escaped pipes while keeping each row on one line", () => {
    const markdown = createTurndownService({ useHtmlStyleForImage: false }).turndown(
      '<table><tr><th>Metric</th><th>Value</th></tr>'
      + '<tr><td><strong>One | two</strong><br><em>three</em></td>'
      + '<td><a href="https://example.com/">A|B</a> <code>x|y</code></td></tr></table>',
    );

    const tables = getTables(markdown);
    expect(tables).toHaveLength(1);
    expect(getCellText(tables[0])).toEqual([["Metric", "Value"], ["One | two three", "A|B x|y"]]);
    const row = tables[0].table.children?.[1];
    expect(row?.type === "table_row" && row.table_row.cells).toMatchObject([
      [{ annotations: { bold: true } }, { text: { content: " " } }, { annotations: { italic: true } }],
      [{ text: { link: { url: "https://example.com/" } } }, { text: { content: " " } }, { annotations: { code: true } }],
    ]);
  });

  test.each([
    ['<img src="https://example.com/chart.png">', '![](https://example.com/chart.png)'],
    ["<ul><li>List item</li></ul>", "*   List item"],
    ["<pre><code>const x = 1;</code></pre>", "const x = 1;"],
    ["<table><tr><th>Nested</th></tr><tr><td>Content</td></tr></table>", "Nested\n\nContent"],
    ["<code>x\\|y</code>", "x\\|y"],
  ])("falls back to standard conversion for %s", (cell, expected) => {
    const markdown = createTurndownService({ useHtmlStyleForImage: false }).turndown(
      '<table><tr><th>Header</th></tr><tr><td>' + cell + '</td></tr></table>',
    );
    expect(getTables(markdown)).toEqual([]);
    expect(markdown).toContain(expected);
  });
});
