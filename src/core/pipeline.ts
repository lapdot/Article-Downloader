import path from "node:path";
import { verifyZhihuCookies } from "../adapters/zhihu.js";
import { downloadHtml } from "./fetcher.js";
import { parseHtmlToMarkdown, parseHtmlToMetadata } from "./parser.js";
import { markdownToNotionBlocks, uploadNotionBlocksToNotion } from "./notion.js";
import { createOutputDir, writeJsonFile, writeTextFile } from "../utils/fs.js";
import type { PipelineInput, PipelineResult, UploadResult } from "../types.js";

const REDACTED = "[REDACTED]";
const SENSITIVE_TEXT_PATTERNS = [
  /(?:[A-Za-z]:)?[^"\s]*cookies\.secrets\.local\.json/gi,
  /(?:[A-Za-z]:)?[^"\s]*notion\.secrets\.local\.json/gi,
  /\bntn_[A-Za-z0-9._-]+\b/gi,
  /\bsecret[-_][A-Za-z0-9._-]+\b/gi,
  /\bz_c0\s*[=:]\s*[^;\s"]+/gi,
];

function redactSensitiveText(value: string): string {
  let redacted = value;
  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED);
  }
  return redacted;
}

function redactForMeta(value: unknown): unknown {
  if (typeof value === "string") {
    return redactSensitiveText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForMeta(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value).map(([key, nested]) => [key, redactForMeta(nested)]);
  return Object.fromEntries(entries);
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const cookies = input.runtimeConfig.cookies;
  const useHtmlStyleForImage =
    input.useHtmlStyleForImage ?? input.runtimeConfig.pipeline.useHtmlStyleForImage;
  const baseOutputDir = input.outDir ?? input.runtimeConfig.pipeline.outDir;

  const verify = await verifyZhihuCookies(cookies, input.runtimeConfig.pipeline.userAgent);
  if (!verify.ok) {
    return {
      ok: false,
      verify,
      reason: "cookie verification failed",
    };
  }

  const download = await downloadHtml({
    url: input.url,
    cookies,
    userAgent: input.runtimeConfig.pipeline.userAgent,
  });
  if (!download.ok || !download.html) {
    return {
      ok: false,
      verify,
      download,
      reason: "download failed",
    };
  }

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
    useHtmlStyleForImage,
  });
  if (parse.ok && parse.markdown) {
    await writeTextFile(markdownPath, parse.markdown);
  }

  let upload: UploadResult | undefined;
  const notionToken = input.runtimeConfig.notion.notionToken;
  const databaseId = input.runtimeConfig.notion.databaseId;
  const uploadAttempted = parse.ok && Boolean(parse.markdown);
  if (uploadAttempted && parse.markdown) {
    const blocks = markdownToNotionBlocks(parse.markdown);
    await writeJsonFile(notionBlocksPath, blocks);
    if (input.notionSetupError) {
      upload = {
        ok: false,
        reason: input.notionSetupError,
        errorCode: "E_NOTION_API",
      };
    } else if (!notionToken || !databaseId) {
      upload = {
        ok: false,
        reason: "missing notion secrets",
        errorCode: "E_NOTION_API",
      };
    } else {
      upload = await uploadNotionBlocksToNotion({
        blocks,
        notionToken,
        databaseId,
      });
    }
  }

  const resultOk =
    metadata.ok &&
    parse.ok &&
    (!!upload && upload.ok);
  const reason =
    !metadata.ok ? "metadata failed" :
    !parse.ok ? "parse failed" :
    upload && !upload.ok ? "notion upload failed" :
    undefined;

  await writeJsonFile(metaPath, redactForMeta({
    input: {
      url: input.url,
      outDir: baseOutputDir,
      useHtmlStyleForImage,
      notionUploadAttempted: uploadAttempted,
      cookieCount: cookies.length,
    },
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
    notionBlocksPath: uploadAttempted ? notionBlocksPath : undefined,
    upload,
    reason,
  }));

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
    notionBlocksPath: uploadAttempted ? notionBlocksPath : undefined,
    metaPath,
    reason,
  };
}
