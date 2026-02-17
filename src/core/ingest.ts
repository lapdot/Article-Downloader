import path from "node:path";
import { access } from "node:fs/promises";
import { formatMissingFileError, isNotFoundError, readTextFile, writeJsonFile, writeTextFile } from "../utils/fs.js";
import { timestampCompact } from "../utils/time.js";
import { diffStructureLedger, findForbiddenSecretPatterns, sanitizeHtmlForFixture } from "./sanitizer.js";
import type { IngestInput, IngestResult } from "../types.js";

function assertValidSourceUrl(sourceUrl: string): void {
  try {
    new URL(sourceUrl);
  } catch {
    throw new Error("E_INGEST_INVALID_SOURCE_URL");
  }
}

function assertFixtureName(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value)) {
    throw new Error("E_INGEST_SANITIZE_FAILED: invalid fixture name");
  }
}

async function readInputHtml(htmlPath: string): Promise<string> {
  try {
    return await readTextFile(htmlPath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError("ingest html", htmlPath);
    }
    throw error;
  }
}

async function assertTargetNotExists(filePath: string): Promise<void> {
  try {
    await access(filePath);
    throw new Error(`E_INGEST_TARGET_EXISTS: ${filePath}`);
  } catch (error) {
    if (isNotFoundError(error)) {
      return;
    }
    if (error instanceof Error && error.message.startsWith("E_INGEST_TARGET_EXISTS:")) {
      throw error;
    }
    throw error;
  }
}

export async function runIngest(input: IngestInput): Promise<IngestResult> {
  const outFixturesDir = input.outFixturesDir ?? path.join("tests", "fixtures");
  const policyVersion = input.policyVersion ?? "v1";

  assertValidSourceUrl(input.sourceUrl);
  assertFixtureName(input.fixture);

  const html = await readInputHtml(input.htmlPath);
  if (!html.trim()) {
    throw new Error("E_INGEST_INVALID_HTML");
  }

  let sanitization;
  try {
    sanitization = sanitizeHtmlForFixture(html, input.sourceUrl, policyVersion);
  } catch (error) {
    if (error instanceof TypeError || error instanceof ReferenceError || error instanceof SyntaxError) {
      throw new Error(`E_INGEST_SANITIZE_FAILED: ${error.message}`);
    }
    if (error instanceof Error && error.message === "Invalid URL") {
      throw new Error("E_INGEST_INVALID_SOURCE_URL");
    }
    throw error;
  }

  const diff = diffStructureLedger(sanitization.rawLedger, sanitization.sanitizedLedger);
  if (!diff.ok) {
    throw new Error(`E_INGEST_LEDGER_DIFF: ${diff.violations.join("; ")}`);
  }

  const mapJson = JSON.stringify(sanitization.map, null, 2);
  const htmlHits = findForbiddenSecretPatterns(sanitization.sanitizedHtml);
  const mapHits = findForbiddenSecretPatterns(mapJson);
  if (htmlHits.length > 0 || mapHits.length > 0) {
    const allHits = [...htmlHits, ...mapHits];
    throw new Error(`E_INGEST_SECRET_PATTERN: ${allHits.join(", ")}`);
  }

  const rawArchiveDir = path.join(".local", "raw-imports", `${timestampCompact()}-${input.fixture}`);
  const rawArchivePath = path.join(rawArchiveDir, "raw.html");
  const sanitizedHtmlPath = path.join(outFixturesDir, `${input.fixture}.html`);
  const mapPath = path.join(outFixturesDir, `${input.fixture}.map.json`);
  const ledgerPath = path.join(outFixturesDir, `${input.fixture}.ledger.json`);

  await assertTargetNotExists(sanitizedHtmlPath);
  await assertTargetNotExists(mapPath);
  if (input.debugLedger) {
    await assertTargetNotExists(ledgerPath);
  }

  await writeTextFile(rawArchivePath, html);
  await writeTextFile(sanitizedHtmlPath, sanitization.sanitizedHtml);
  await writeJsonFile(mapPath, sanitization.map);
  if (input.debugLedger) {
    await writeJsonFile(ledgerPath, {
      policyVersion,
      raw: sanitization.rawLedger,
      sanitized: sanitization.sanitizedLedger,
      diff,
    });
  }

  return {
    ok: true,
    input: {
      htmlPath: input.htmlPath,
      sourceUrl: input.sourceUrl,
      fixture: input.fixture,
    },
    artifacts: {
      rawArchivePath,
      sanitizedHtmlPath,
      mapPath,
      ledgerPath: input.debugLedger ? ledgerPath : undefined,
    },
    stats: {
      replacements: sanitization.map.length,
      ledgerNodesRaw: sanitization.rawLedger.nodes.length,
      ledgerNodesSanitized: sanitization.sanitizedLedger.nodes.length,
      diffWarnings: diff.warnings.length,
    },
  };
}
