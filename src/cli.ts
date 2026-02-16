#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { verifyZhihuCookies } from "./adapters/zhihu.js";
import { assertValidCookies } from "./core/cookies.js";
import { downloadHtml } from "./core/fetcher.js";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "./core/parser.js";
import {
  markdownToNotionBlocks,
  uploadNotionBlocksToNotion,
  type NotionBlock,
} from "./core/notion.js";
import { runPipeline } from "./core/pipeline.js";
import { readNotionConfig } from "./core/notion-config.js";
import {
  createOutputDir,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from "./utils/fs.js";
import { logError, logInfo } from "./utils/log.js";
import type { PipelineResult } from "./types.js";

async function loadCookies(cookiesPath: string) {
  const raw = await readJsonFile<unknown>(cookiesPath);
  return assertValidCookies(raw);
}

function printResult(value: unknown, json: boolean): void {
  if (json) {
    logInfo(JSON.stringify(value, null, 2));
    return;
  }
  logInfo(JSON.stringify(value, null, 2));
}

function simplifyRunResult(result: PipelineResult): Record<string, unknown> {
  return {
    ok: result.ok,
    reason: result.reason,
    outputDir: result.outputDir,
    htmlPath: result.htmlPath,
    metadataPath: result.metadataPath,
    markdownPath: result.markdownPath,
    notionBlocksPath: result.notionBlocksPath,
    metaPath: result.metaPath,
    pageId: result.upload?.pageId,
    blocksAppended: result.upload?.blocksAppended,
  };
}

function assertNotionBlocks(value: unknown): NotionBlock[] {
  if (!Array.isArray(value)) {
    throw new Error("invalid Notion blocks JSON: expected an array");
  }
  const valid = value.every((item) => item && typeof item === "object");
  if (!valid) {
    throw new Error("invalid Notion blocks JSON: every item must be an object");
  }
  return value as NotionBlock[];
}

export function createProgram(): Command {
  const program = new Command();
  program.name("article-downloader").description("Download and process articles").version("0.1.0");

  program
    .command("verify-zhihu")
    .requiredOption("--cookies <path>", "path to cookies JSON")
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const cookies = await loadCookies(opts.cookies);
        const result = await verifyZhihuCookies(cookies);
        printResult(result, opts.json);
        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("fetch")
    .requiredOption("--url <url>", "target URL")
    .requiredOption("--cookies <path>", "path to cookies JSON")
    .option("--out <dir>", "output base directory", "output")
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const cookies = await loadCookies(opts.cookies);
        const result = await downloadHtml({ url: opts.url, cookies });
        if (!result.ok || !result.html) {
          printResult(result, opts.json);
          process.exitCode = 1;
          return;
        }

        const outputDir = await createOutputDir(opts.out, opts.url);
        const htmlPath = path.join(outputDir, "page.html");
        await writeTextFile(htmlPath, result.html);
        await writeJsonFile(path.join(outputDir, "meta.json"), {
          download: {
            ...result,
            html: undefined,
          },
        });

        printResult({ ...result, htmlPath }, opts.json);
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("get_metadata")
    .requiredOption("--html <path>", "path to input HTML")
    .requiredOption("--url <url>", "original URL")
    .option("--out <dir>", "output base directory", "output")
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const html = await readTextFile(opts.html);
        const result = await parseHtmlToMetadata({
          html,
          sourceUrl: opts.url,
        });
        if (!result.ok || !result.metadata) {
          printResult(result, opts.json);
          process.exitCode = 1;
          return;
        }

        const outputDir = await createOutputDir(opts.out, opts.url);
        const metadataPath = path.join(outputDir, "metadata.json");
        await writeJsonFile(metadataPath, result.metadata);
        await writeJsonFile(path.join(outputDir, "meta.json"), {
          metadata: result,
        });

        printResult({ ...result, metadataPath }, opts.json);
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("parse")
    .requiredOption("--html <path>", "path to input HTML")
    .requiredOption("--url <url>", "original URL")
    .option("--out <dir>", "output base directory", "output")
    .option(
      "--use-html-style-for-image",
      "use HTML img output instead of markdown image",
      false,
    )
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const html = await readTextFile(opts.html);
        const result = await parseHtmlToMarkdown({
          html,
          sourceUrl: opts.url,
          useHtmlStyleForImage: opts.useHtmlStyleForImage,
        });
        if (!result.ok || !result.markdown) {
          printResult(result, opts.json);
          process.exitCode = 1;
          return;
        }

        const outputDir = await createOutputDir(opts.out, opts.url);
        const markdownPath = path.join(outputDir, "article.md");
        await writeTextFile(markdownPath, result.markdown);
        await writeJsonFile(path.join(outputDir, "meta.json"), {
          parse: {
            ...result,
            markdown: undefined,
          },
        });

        printResult({ ...result, markdownPath }, opts.json);
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("transform-notion")
    .requiredOption("--md <path>", "path to markdown file")
    .option("--out <dir>", "output base directory", "output")
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const markdown = await readTextFile(opts.md);
        const blocks = markdownToNotionBlocks(markdown);
        const outputDir = await createOutputDir(opts.out, opts.md);
        const blocksPath = path.join(outputDir, "notion-blocks.json");
        await writeJsonFile(blocksPath, blocks);

        printResult(
          {
            ok: true,
            outputDir,
            blocksPath,
            blockCount: blocks.length,
          },
          opts.json,
        );
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("upload-notion")
    .requiredOption("--blocks <path>", "path to Notion blocks JSON file")
    .requiredOption("--title <title>", "article title")
    .requiredOption("--source-url <url>", "article source URL")
    .requiredOption("--fetched-at <iso>", "fetch timestamp in ISO format")
    .requiredOption("--notion-config <path>", "path to Notion config JSON")
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const notionConfig = await readNotionConfig(opts.notionConfig);
        const blocksRaw = await readJsonFile<unknown>(opts.blocks);
        const blocks = assertNotionBlocks(blocksRaw);
        const result = await uploadNotionBlocksToNotion({
          blocks,
          title: opts.title,
          sourceUrl: opts.sourceUrl,
          fetchedAt: opts.fetchedAt,
          notionToken: notionConfig.notionToken,
          databaseId: notionConfig.databaseId,
        });

        printResult(result, opts.json);
        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("run")
    .requiredOption("--url <url>", "target URL")
    .requiredOption("--cookies <path>", "path to cookies JSON")
    .option("--out <dir>", "output base directory", "output")
    .option("--notion-config <path>", "path to Notion config JSON")
    .option(
      "--use-html-style-for-image",
      "use HTML img output instead of markdown image",
      false,
    )
    .option(
      "--full-result",
      "print full pipeline result (default is simplified result)",
      false,
    )
    .option("--json", "json output", false)
    .action(async (opts) => {
      try {
        const result = await runPipeline({
          url: opts.url,
          cookiesPath: opts.cookies,
          outDir: opts.out,
          notionConfigPath: opts.notionConfig,
          useHtmlStyleForImage: opts.useHtmlStyleForImage,
        });
        printResult(opts.fullResult ? result : simplifyRunResult(result), opts.json);
        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    logError(error instanceof Error ? error.message : "unknown error");
    process.exit(1);
  });
}
