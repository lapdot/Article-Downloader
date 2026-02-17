import path from "node:path";
import { copyFile } from "node:fs/promises";
import { downloadHtml } from "./fetcher.js";
import { runIngest } from "./ingest.js";
import { createOutputDir, ensureDir, writeJsonFile, writeTextFile } from "../utils/fs.js";
import type { CaptureFixtureInput, CaptureFixtureResult } from "../types.js";

export async function runCaptureFixture(input: CaptureFixtureInput): Promise<CaptureFixtureResult> {
  const outputBaseDir = input.outDir ?? input.runtimeConfig.pipeline.outDir;
  const download = await downloadHtml({
    url: input.url,
    cookies: input.runtimeConfig.cookies,
    userAgent: input.runtimeConfig.pipeline.userAgent,
  });

  if (!download.ok || !download.html) {
    return {
      ok: false,
      reason: "fetch failed",
      fetch: {
        result: download,
      },
    };
  }

  const outputDir = await createOutputDir(outputBaseDir, input.url);
  const htmlPath = path.join(outputDir, "page.html");
  await writeTextFile(htmlPath, download.html);
  await writeJsonFile(path.join(outputDir, "meta.json"), {
    download: {
      ...download,
      html: undefined,
    },
  });

  const sourceUrl = download.finalUrl ?? input.url;
  try {
    const ingest = await runIngest({
      htmlPath,
      sourceUrl,
      fixture: input.fixture,
      outFixturesDir: input.outFixturesDir,
      policyVersion: input.policyVersion,
      debugLedger: input.debugLedger,
    });

    const copiedArtifactsDir = path.join(outputDir, "ingest");
    await ensureDir(copiedArtifactsDir);
    const copiedHtmlPath = path.join(copiedArtifactsDir, `${input.fixture}.html`);
    const copiedMapPath = path.join(copiedArtifactsDir, `${input.fixture}.map.json`);
    await copyFile(ingest.artifacts.sanitizedHtmlPath, copiedHtmlPath);
    await copyFile(ingest.artifacts.mapPath, copiedMapPath);

    if (ingest.artifacts.ledgerPath) {
      const copiedLedgerPath = path.join(copiedArtifactsDir, `${input.fixture}.ledger.json`);
      await copyFile(ingest.artifacts.ledgerPath, copiedLedgerPath);
    }

    return {
      ok: true,
      fetch: {
        outputDir,
        htmlPath,
        result: {
          ...download,
          html: undefined,
        },
      },
      ingest,
      handoff: {
        sourceUrl,
        htmlPath,
        copiedArtifactsDir,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown ingest error";
    return {
      ok: false,
      reason: `ingest failed: ${message}`,
      ingestError: message,
      fetch: {
        outputDir,
        htmlPath,
        result: {
          ...download,
          html: undefined,
        },
      },
    };
  }
}
