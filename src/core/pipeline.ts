import path from "node:path";
import { verifyZhihuCookies } from "../adapters/zhihu.js";
import { downloadHtml } from "./fetcher.js";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "./parser.js";
import { markdownToNotionBlocks, uploadNotionBlocksToNotion } from "./notion.js";
import { readNotionConfig } from "./notion-config.js";
import { assertValidCookies } from "./cookies.js";
import { createOutputDir, readJsonFile, writeJsonFile, writeTextFile } from "../utils/fs.js";
import type { Cookie, PipelineInput, PipelineResult } from "../types.js";

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  let cookies: Cookie[];
  try {
    const cookieJson = await readJsonFile<unknown>(input.cookiesPath);
    cookies = assertValidCookies(cookieJson);
  } catch (error) {
    return {
      ok: false,
      verify: {
        ok: false,
        reason: error instanceof Error ? error.message : "invalid cookie file",
        errorCode: "E_COOKIE_INVALID",
      },
      reason: "cookie validation failed",
    };
  }

  const verify = await verifyZhihuCookies(cookies);
  if (!verify.ok) {
    return {
      ok: false,
      verify,
      reason: "cookie verification failed",
    };
  }

  const download = await downloadHtml({ url: input.url, cookies });
  if (!download.ok || !download.html) {
    return {
      ok: false,
      verify,
      download,
      reason: "download failed",
    };
  }

  const baseOutputDir = input.outDir ?? "output";
  const outputDir = await createOutputDir(baseOutputDir, input.url);
  const htmlPath = path.join(outputDir, "page.html");
  const metadataPath = path.join(outputDir, "metadata.json");
  const markdownPath = path.join(outputDir, "article.md");
  const notionBlocksPath = path.join(outputDir, "notion-blocks.json");
  const metaPath = path.join(outputDir, "meta.json");
  await writeTextFile(htmlPath, download.html);

  const sourceUrl = download.finalUrl ?? input.url;
  const metadata = await parseHtmlToMetadata({
    html: download.html,
    sourceUrl,
  });
  if (metadata.ok && metadata.metadata) {
    await writeJsonFile(metadataPath, metadata.metadata);
  }

  const parse = await parseHtmlToMarkdown({
    html: download.html,
    sourceUrl,
    useHtmlStyleForImage: input.useHtmlStyleForImage,
  });
  if (parse.ok && parse.markdown) {
    await writeTextFile(markdownPath, parse.markdown);
  }

  let upload;
  let notionErrorReason: string | undefined;
  if (input.notionConfigPath && parse.ok && parse.markdown) {
    try {
      const notionConfig = await readNotionConfig(input.notionConfigPath);
      const blocks = markdownToNotionBlocks(parse.markdown);
      await writeJsonFile(notionBlocksPath, blocks);
      upload = await uploadNotionBlocksToNotion({
        blocks,
        title: parse.title ?? "Untitled",
        sourceUrl,
        fetchedAt: download.fetchedAt,
        notionToken: notionConfig.notionToken,
        databaseId: notionConfig.databaseId,
      });
    } catch (error) {
      notionErrorReason = error instanceof Error ? error.message : "invalid notion config";
    }
  }

  const resultOk =
    metadata.ok &&
    parse.ok &&
    (!input.notionConfigPath || (!!upload && upload.ok)) &&
    !notionErrorReason;
  const reason =
    !metadata.ok ? "metadata failed" :
    !parse.ok ? "parse failed" :
    notionErrorReason ? notionErrorReason :
    upload && !upload.ok ? "notion upload failed" :
    undefined;

  await writeJsonFile(metaPath, {
    input,
    verify,
    download: {
      ...download,
      html: undefined,
    },
    metadata,
    parse: {
      ...parse,
      markdown: undefined,
    },
    notionBlocksPath: upload ? notionBlocksPath : undefined,
    upload,
    reason,
  });

  return {
    ok: resultOk,
    verify,
    download,
    metadata,
    parse,
    upload,
    outputDir,
    htmlPath,
    metadataPath: metadata.ok && metadata.metadata ? metadataPath : undefined,
    markdownPath: parse.ok && parse.markdown ? markdownPath : undefined,
    notionBlocksPath: input.notionConfigPath && upload ? notionBlocksPath : undefined,
    metaPath,
    reason,
  };
}
