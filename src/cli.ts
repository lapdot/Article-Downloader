#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { downloadHtml, downloadPdf } from "./core/fetcher.js";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "./core/parser.js";
import {
  markdownToNotionBlocks,
  uploadNotionBlocksToNotion,
  type NotionBlock,
} from "./core/notion.js";
import { runPipeline } from "./core/pipeline.js";
import { browsePath } from "./core/browse-path.js";
import { resolveEffectiveDownloadMethod, resolveRuntimeConfig } from "./core/runtime-config.js";
import {
  extractForeignAffairsPdfUrl,
  getForeignAffairsPdfFilename,
} from "./adapters/foreignaffairs.js";
import {
  getForeignPolicyPdfFilename,
  getForeignPolicyPdfUrl,
} from "./adapters/foreignpolicy.js";
import {
  createOutputDir,
  formatMissingFileError,
  isNotFoundError,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from "./utils/fs.js";
import { logError, logInfo } from "./utils/log.js";
import type { DownloadMethod, PipelineResult, ResolvedRuntimeConfig } from "./types.js";

function assertNoDeprecatedFlags(argv: string[]): void {
  const hasDeprecatedCookiesFlag = argv.some((arg) => arg === "--cookies" || arg.startsWith("--cookies="));
  const hasDeprecatedNotionFlag = argv.some(
    (arg) => arg === "--notion-config" || arg.startsWith("--notion-config="),
  );
  if (hasDeprecatedCookiesFlag || hasDeprecatedNotionFlag) {
    throw new Error('deprecated flags detected: use --config and --notion-secrets');
  }
}

function printResult(value: unknown): void {
  logInfo(JSON.stringify(value, null, 2));
}

function parseDownloadMethod(value: string): DownloadMethod {
  if (value === "cookieproxy") {
    return value;
  }
  throw new Error(`invalid download method: ${value}; only "cookieproxy" is currently supported`);
}

function simplifyRunResult(result: PipelineResult): Record<string, unknown> {
  return {
    ok: result.ok,
    reason: result.reason,
    downloadMethod: result.download?.downloadMethod,
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

async function readRequiredTextInput(kind: string, filePath: string): Promise<string> {
  try {
    return await readTextFile(filePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError(kind, filePath);
    }
    throw error;
  }
}

async function readRequiredJsonInput<T>(kind: string, filePath: string): Promise<T> {
  try {
    return await readJsonFile<T>(filePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError(kind, filePath);
    }
    throw error;
  }
}

interface RuntimeConfigOptions {
  config?: string;
  notionSecrets?: string;
  downloadMethod?: DownloadMethod;
  requireNotion?: boolean;
}

async function loadRuntimeConfig(options: RuntimeConfigOptions): Promise<ResolvedRuntimeConfig> {
  return resolveRuntimeConfig({
    configPath: options.config,
    notionSecretsPath: options.notionSecrets,
    downloadMethodOverride: options.downloadMethod,
    requireNotion: options.requireNotion,
  });
}

async function loadRuntimeConfigForDownload(options: RuntimeConfigOptions): Promise<ResolvedRuntimeConfig> {
  const downloadMethod = await resolveEffectiveDownloadMethod({
    configPath: options.config,
    downloadMethodOverride: options.downloadMethod,
  });
  return loadRuntimeConfig({
    ...options,
    downloadMethod,
  });
}

async function loadRuntimeConfigForRun(options: RuntimeConfigOptions): Promise<{
  runtimeConfig: ResolvedRuntimeConfig;
  notionSetupError?: string;
}> {
  try {
    const runtimeConfig = await loadRuntimeConfig({
      ...options,
      requireNotion: true,
    });
    return { runtimeConfig };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    const runtimeConfig = await loadRuntimeConfig({
      ...options,
      requireNotion: false,
    });
    return { runtimeConfig, notionSetupError: message };
  }
}

function getRequiredNotionSecrets(runtimeConfig: ResolvedRuntimeConfig): {
  notionToken: string;
  databaseId: string;
} {
  if (!runtimeConfig.notion.notionToken || !runtimeConfig.notion.databaseId) {
    throw new Error("missing notion secrets");
  }

  return {
    notionToken: runtimeConfig.notion.notionToken,
    databaseId: runtimeConfig.notion.databaseId,
  };
}

export function createProgram(): Command {
  const program = new Command();
  program.name("article-downloader").description("Download and process articles").version("0.1.0");

  program
    .command("fetch")
    .requiredOption("--url <url>", "target URL")
    .option("--config <path>", "path to public config JSON")
    .option(
      "--download-method <method>",
      "download method override (cookieproxy)",
      parseDownloadMethod,
    )
    .requiredOption("--out <dir>", "output base directory")
    .action(async (opts) => {
      try {
        const runtimeConfig = await loadRuntimeConfigForDownload({
          config: opts.config,
          downloadMethod: opts.downloadMethod,
        });
        const result = await downloadHtml({
          url: opts.url,
          userAgent: runtimeConfig.pipeline.userAgent,
          downloadMethod: runtimeConfig.pipeline.downloadMethod,
          cookieproxyPath: runtimeConfig.pipeline.cookieproxyPath,
        });
        if (!result.ok || !result.html) {
          printResult(result);
          process.exitCode = 1;
          return;
        }

        const outputBaseDir = opts.out;
        const outputDir = await createOutputDir(outputBaseDir, opts.url);
        const htmlPath = path.join(outputDir, "page.html");
        await writeTextFile(htmlPath, result.html);

        if (result.source?.sourceId === "foreignaffairs") {
          const pdfUrl = extractForeignAffairsPdfUrl(result.html);
          if (!pdfUrl) {
            const failedPdfResult = {
              ok: false,
              url: opts.url,
              downloadMethod: result.downloadMethod,
              source: result.source,
              finalUrl: result.finalUrl,
              fetchedAt: result.fetchedAt,
              reason: "no available pdf for foreignaffairs. maybe contentType is podcast.",
              errorCode: "E_FETCH_EXEC",
            };
            await writeJsonFile(path.join(outputDir, "meta.json"), {
              download: {
                ...result,
                html: undefined,
              },
              pdf: failedPdfResult,
            });
            printResult({
              ...failedPdfResult,
              htmlPath,
            });
            process.exitCode = 1;
            return;
          }

          const pdfResult = await downloadPdf({
            url: pdfUrl,
            userAgent: runtimeConfig.pipeline.userAgent,
            downloadMethod: runtimeConfig.pipeline.downloadMethod,
            cookieproxyPath: runtimeConfig.pipeline.cookieproxyPath,
            outDir: outputDir,
            filename: getForeignAffairsPdfFilename(pdfUrl),
          });
          const pdfResultWithSource = {
            ...pdfResult,
            source: result.source,
          };
          await writeJsonFile(path.join(outputDir, "meta.json"), {
            download: {
              ...result,
              html: undefined,
            },
            pdf: pdfResultWithSource,
          });

          printResult({
            ...pdfResultWithSource,
            htmlPath,
            pdfPath: pdfResult.pdfPath,
            pdfUrl,
          });
          if (!pdfResult.ok) {
            process.exitCode = 1;
          }
          return;
        }

        if (result.source?.sourceId === "foreignpolicy") {
          const pdfUrl = getForeignPolicyPdfUrl(opts.url);
          const pdfResult = await downloadPdf({
            url: pdfUrl,
            userAgent: runtimeConfig.pipeline.userAgent,
            downloadMethod: runtimeConfig.pipeline.downloadMethod,
            cookieproxyPath: runtimeConfig.pipeline.cookieproxyPath,
            outDir: outputDir,
            filename: getForeignPolicyPdfFilename(opts.url),
          });
          const pdfResultWithSource = {
            ...pdfResult,
            source: result.source,
          };
          await writeJsonFile(path.join(outputDir, "meta.json"), {
            download: {
              ...result,
              html: undefined,
            },
            pdf: pdfResultWithSource,
          });

          printResult({
            ...pdfResultWithSource,
            htmlPath,
            pdfPath: pdfResult.pdfPath,
            pdfUrl,
          });
          if (!pdfResult.ok) {
            process.exitCode = 1;
          }
          return;
        }

        await writeJsonFile(path.join(outputDir, "meta.json"), {
          download: {
            ...result,
            html: undefined,
          },
        });

        printResult({ ...result, htmlPath });
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("get_metadata")
    .requiredOption("--html <path>", "path to input HTML")
    .requiredOption("--url <url>", "original URL")
    .requiredOption("--out <dir>", "output base directory")
    .action(async (opts) => {
      try {
        const html = await readRequiredTextInput("input html", opts.html);
        const result = await parseHtmlToMetadata({
          html,
          sourceUrl: opts.url,
        });
        if (!result.ok || !result.metadata) {
          printResult(result);
          process.exitCode = 1;
          return;
        }

        const outputDir = await createOutputDir(opts.out, opts.url);
        const metadataPath = path.join(outputDir, "metadata.json");
        await writeJsonFile(metadataPath, result.metadata);
        await writeJsonFile(path.join(outputDir, "meta.json"), {
          metadata: result,
        });

        printResult({ ...result, metadataPath });
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("parse")
    .requiredOption("--html <path>", "path to input HTML")
    .requiredOption("--url <url>", "original URL")
    .requiredOption("--out <dir>", "output base directory")
    .option(
      "--use-html-style-for-image",
      "use HTML img output instead of markdown image",
      false,
    )
    .action(async (opts) => {
      try {
        const html = await readRequiredTextInput("input html", opts.html);
        const result = await parseHtmlToMarkdown({
          html,
          sourceUrl: opts.url,
          useHtmlStyleForImage: opts.useHtmlStyleForImage,
        });
        if (!result.ok || !result.markdown) {
          printResult(result);
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

        printResult({ ...result, markdownPath });
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("transform-notion")
    .requiredOption("--md <path>", "path to markdown file")
    .requiredOption("--out <dir>", "output base directory")
    .action(async (opts) => {
      try {
        const markdown = await readRequiredTextInput("input markdown", opts.md);
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
        );
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("upload-notion")
    .requiredOption("--blocks <path>", "path to Notion blocks JSON file")
    .option("--config <path>", "path to public config JSON")
    .option("--notion-secrets <path>", "path to notion secrets JSON")
    .action(async (opts) => {
      try {
        const runtimeConfig = await loadRuntimeConfig({
          config: opts.config,
          notionSecrets: opts.notionSecrets,
          requireNotion: true,
        });
        const notionSecrets = getRequiredNotionSecrets(runtimeConfig);

        const blocksRaw = await readRequiredJsonInput<unknown>("input blocks", opts.blocks);
        const blocks = assertNotionBlocks(blocksRaw);
        const result = await uploadNotionBlocksToNotion({
          blocks,
          notionToken: notionSecrets.notionToken,
          databaseId: notionSecrets.databaseId,
        });

        printResult(result);
        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (error) {
        logError(error instanceof Error ? error.message : "unknown error");
        process.exitCode = 1;
      }
    });

  program
    .command("browse-path")
    .requiredOption("--path <dir>", "directory path to browse")
    .action(async (opts) => {
      try {
        const result = await browsePath(opts.path);
        printResult(result);
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
    .option("--config <path>", "path to public config JSON")
    .option(
      "--download-method <method>",
      "download method override (cookieproxy)",
      parseDownloadMethod,
    )
    .option("--notion-secrets <path>", "path to notion secrets JSON")
    .requiredOption("--out <dir>", "output base directory")
    .option(
      "--use-html-style-for-image",
      "use HTML img output instead of markdown image",
    )
    .option(
      "--full-result",
      "print full pipeline result (default is simplified result)",
      false,
    )
    .action(async (opts) => {
      try {
        const { runtimeConfig, notionSetupError } = await loadRuntimeConfigForRun({
          config: opts.config,
          downloadMethod: opts.downloadMethod,
          notionSecrets: opts.notionSecrets,
        });

        const result = await runPipeline({
          url: opts.url,
          runtimeConfig,
          outDir: opts.out,
          useHtmlStyleForImage: opts.useHtmlStyleForImage === true ? true : undefined,
          notionSetupError,
        });
        printResult(opts.fullResult ? result : simplifyRunResult(result));
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
  assertNoDeprecatedFlags(argv);
  const program = createProgram();
  await program.parseAsync(argv);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    logError(error instanceof Error ? error.message : "unknown error");
    process.exit(1);
  });
}
