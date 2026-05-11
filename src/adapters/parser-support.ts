import TurndownService from "turndown";
import type { ParseResult } from "../types.js";

export function createTurndownService(options: { useHtmlStyleForImage: boolean }): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

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
}

export function buildMarkdownResult(
  context: MarkdownContext,
  turndownService: TurndownService,
): ParseResult {
  const markdownBody = turndownService.turndown(context.contentHtml).trim();
  const includeTitleInMarkdown = context.includeTitleInMarkdown ?? true;
  const markdownSegments = [
    includeTitleInMarkdown && context.title ? `# ${context.title}` : "",
    context.authorBlock,
    markdownBody,
    context.contentTimeBlock,
  ].filter((segment) => segment.trim().length > 0);

  return {
    ok: true,
    title: context.title,
    markdown: markdownSegments.join("\n\n"),
    stats: {
      removedNodes: 0,
      selectedNodes: 1,
    },
  };
}
