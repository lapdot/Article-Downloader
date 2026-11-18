import TurndownService from "turndown";
import type { ParseResult, SourceIdentity } from "../types.js";

const MARKDOWN_TEXT_ESCAPES: Array<[RegExp, string]> = [
  [/\\/g, "\\\\"],
  [/\*/g, "\\*"],
  [/^-/g, "\\-"],
  [/^\+ /g, "\\+ "],
  [/^(=+)/g, "\\$1"],
  [/^(#{1,6}) /g, "\\$1 "],
  [/`/g, "\\`"],
  [/^~~~/g, "\\~~~"],
  [/\[/g, "\\["],
  [/\]/g, "\\]"],
  [/^>/g, "\\>"],
  [/_/g, "\\_"],
  [/^(\d+)\. /g, "$1\\. "],
];

export function escapeMarkdownPlainText(value: string): string {
  const turndownEscaped = MARKDOWN_TEXT_ESCAPES.reduce((escaped, [pattern, replacement]) => {
    return escaped.replace(pattern, replacement);
  }, value);
  return turndownEscaped.replace(/\$/gu, () => "\\$");
}

export function buildMarkdownLink(label: string, url: string): string {
  return `[${escapeMarkdownPlainText(label)}](${url})`;
}

const UNSUPPORTED_TABLE_CELL_CONTENT =
  "img, ul, ol, dl, pre, blockquote, hr, h1, h2, h3, h4, h5, h6, figure, audio, video, iframe";

function renderMarkdownTable(
  table: HTMLTableElement,
  turndownService: TurndownService,
): string | undefined {
  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tr"));
  const grid: Array<Array<string | undefined>> = rows.map(() => []);
  let groupEnd = 0;
  let width = 0;

  for (const [rowIndex, row] of rows.entries()) {
    if (rowIndex === groupEnd) {
      do {
        groupEnd += 1;
      } while (rows[groupEnd]?.parentElement === row.parentElement);
    }

    const slots = grid[rowIndex];
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      if (cell.querySelector(UNSUPPORTED_TABLE_CELL_CONTENT)) {
        return undefined;
      }
      const markdown = turndownService.turndown(cell.innerHTML);
      // An odd run of backslashes before a pipe is already an escape in GFM.
      // Adding another would split the cell, while reusing it can lose a literal backslash in code.
      if (/^\$\$$/mu.test(markdown) || /(?<!\\)(?:\\\\)*\\\|/u.test(markdown)) {
        return undefined;
      }
      const content = markdown.replace(/\s*\n\s*/gu, " ").replace(/\|/gu, "\\|");
      const columnSpan = Math.min(1000, Math.max(1, cell.colSpan || 1));
      const rowsRemaining = groupEnd - rowIndex;
      const rowSpan = cell.rowSpan === 0
        ? rowsRemaining
        : Math.min(rowsRemaining, Math.max(1, cell.rowSpan || 1));

      // Find a contiguous span so an irregular row cannot overwrite earlier cells.
      for (let candidate = column; candidate < column + columnSpan; candidate += 1) {
        if (slots[candidate] !== undefined) {
          column = candidate + 1;
        }
      }
      for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
        const coveredSlots = grid[rowIndex + rowOffset];
        coveredSlots.length = Math.max(coveredSlots.length, column + columnSpan);
        coveredSlots.fill("", column, column + columnSpan);
      }
      slots[column] = content;
      column += columnSpan;
      width = Math.max(width, column);
    }
  }

  if (!width) {
    return undefined;
  }
  const firstRow = rows[0];
  const hasHeader = firstRow.parentElement?.tagName === "THEAD"
    || (firstRow.cells.length > 0 && Array.from(firstRow.cells).every((cell) => cell.tagName === "TH"));
  const formatRow = (cells: Array<string | undefined>) => {
    return `| ${Array.from({ length: width }, (_, index) => cells[index] ?? "").join(" | ")} |`;
  };
  const header = hasHeader ? grid[0] : [];
  const body = hasHeader ? grid.slice(1) : grid;
  const separator = Array<string>(width).fill("---");
  const caption = table.querySelector("caption");
  const captionMarkdown = caption ? turndownService.turndown(caption.innerHTML) : "";
  const tableMarkdown = [header, separator, ...body].map(formatRow).join("\n");
  return `\n\n${captionMarkdown ? `${captionMarkdown}\n\n` : ""}${tableMarkdown}\n\n`;
}

export function createTurndownService(options: { useHtmlStyleForImage: boolean }): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  const turndownEscape = turndownService.escape.bind(turndownService);
  turndownService.escape = (value: string): string => {
    return turndownEscape(value).replace(/\$/gu, () => "\\$");
  };

  function extractZhihuMathTex(node: {
    getAttribute: (name: string) => string | null;
    querySelector?: (selector: string) => { textContent?: string | null } | null;
    innerHTML?: string;
  }): string {
    const fromDataTex = (node.getAttribute("data-tex") ?? "").trim();
    if (fromDataTex) {
      return fromDataTex;
    }

    if (typeof node.querySelector === "function") {
      const scriptNode = node.querySelector('script[type*="math/tex"]');
      const scriptText = (scriptNode?.textContent ?? "").trim();
      if (scriptText) {
        return scriptText;
      }
    }

    const innerHtml = node.innerHTML ?? "";
    const scriptMatch = innerHtml.match(
      /<script[^>]*type=["']math\/tex(?:;mode=(?:display|inline))?["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    return (scriptMatch?.[1] ?? "").trim();
  }

  function isZhihuBlockMath(tex: string): boolean {
    return tex.endsWith("\\\\");
  }

  function isZhihuEmoji(node: { getAttribute: (name: string) => string | null }): boolean {
    const className = node.getAttribute("class") ?? "";
    const classList = className.split(/\s+/).filter(Boolean);
    const altRaw = (node.getAttribute("alt") ?? "").trim();
    const isAsciiBracketedAlt = /^\[[^\]]+\]$/.test(altRaw);
    return classList.includes("sticker") && isAsciiBracketedAlt;
  }

  turndownService.addRule("zhihuMathEquation", {
    filter: (node) => {
      const rawNode = node as unknown as {
        nodeName?: string;
        getAttribute?: (name: string) => string | null;
      };
      const nodeName = rawNode.nodeName?.toLowerCase();
      if (nodeName !== "span" || typeof rawNode.getAttribute !== "function") {
        return false;
      }
      const span = rawNode as { getAttribute: (name: string) => string | null };
      const className = span.getAttribute("class") ?? "";
      return className.split(/\s+/).includes("ztext-math");
    },
    replacement: (_content, node) => {
      const span = node as unknown as {
        getAttribute: (name: string) => string | null;
        querySelector?: (selector: string) => {
          textContent?: string | null;
          getAttribute?: (name: string) => string | null;
        } | null;
        innerHTML?: string;
      };
      const tex = extractZhihuMathTex(span);
      if (!tex) {
        return "";
      }
      if (isZhihuBlockMath(tex)) {
        return `\n\n$$\n${tex}\n$$\n\n`;
      }
      return `$${tex}$`;
    },
  });

  turndownService.addRule("zhihuImage", {
    filter: "img",
    replacement: (_content, node) => {
      const img = node as unknown as { getAttribute: (name: string) => string | null };
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:image")) {
        return "";
      }

      const rawHeight = img.getAttribute("data-rawheight");
      const rawWidth = img.getAttribute("data-rawwidth");
      const altRaw = (img.getAttribute("alt") ?? "").trim();
      if (isZhihuEmoji(img)) {
        const altCore = altRaw.replace(/^\[|\]$/g, "").trim();
        if (!altCore) {
          return "";
        }
        return `\\[${altCore}\\]`;
      }

      if (!options.useHtmlStyleForImage) {
        return `![](${src})`;
      }

      let style = "";
      if (rawHeight) {
        style += `height: ${rawHeight};`;
      }
      if (rawWidth) {
        style += `width: ${rawWidth};`;
      }
      return `<img src="${src}" style="${style}">`;
    },
  });

  turndownService.addRule("table", {
    filter: (node) => node.tagName === "TABLE"
      && !node.parentElement?.closest("table")
      && !node.querySelector("table"),
    replacement: (content, node) => {
      return renderMarkdownTable(node as HTMLTableElement, turndownService)
        ?? `\n\n${content}\n\n`;
    },
  });

  return turndownService;
}

export function normalizeProtocolRelativeHrefs(
  node: {
    find: (selector: string) => {
      each: (cb: (_index: number, el: { attribs: Record<string, string> }) => void) => void;
    };
  },
): void {
  node.find("a[href]").each((_index, element) => {
    const href = element.attribs.href;
    if (typeof href === "string" && href.startsWith("//")) {
      element.attribs.href = `https:${href}`;
    }
  });
}

export interface MarkdownContext {
  title: string;
  contentHtml: string;
  authorBlock: string;
  contentTimeBlock: string;
  includeTitleInMarkdown?: boolean;
  convertHardLineBreaksToParagraphs?: boolean;
}

export function buildMarkdownResult(
  context: MarkdownContext,
  turndownService: TurndownService,
  source?: SourceIdentity,
): ParseResult {
  const convertedMarkdownBody = turndownService.turndown(context.contentHtml).trim();
  const markdownBody = context.convertHardLineBreaksToParagraphs
    ? convertedMarkdownBody.replace(/ {2}\n/gu, "\n\n")
    : convertedMarkdownBody;
  const includeTitleInMarkdown = context.includeTitleInMarkdown ?? true;
  const markdownSegments = [
    includeTitleInMarkdown && context.title ? `# ${escapeMarkdownPlainText(context.title)}` : "",
    context.authorBlock,
    markdownBody,
    context.contentTimeBlock,
  ].filter((segment) => segment.trim().length > 0);

  return {
    ok: true,
    source,
    title: context.title,
    markdown: markdownSegments.join("\n\n"),
    stats: {
      removedNodes: 0,
      selectedNodes: 1,
    },
  };
}
