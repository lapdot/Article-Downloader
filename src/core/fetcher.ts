import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseSourceUrl, resolveSource } from "../adapters/resolve-source.js";
import { toIsoNow } from "../utils/time.js";
import type {
  DownloadInput,
  DownloadMethod,
  DownloadResult,
  PdfDownloadInput,
  PdfDownloadResult,
} from "../types.js";

const DEFAULT_COOKIEPROXY_PATH = "/Users/lapdot/Documents/projects/runnable/cookieproxy";
const execFileAsync = promisify(execFile);

function getDownloadMethod(input: DownloadInput): DownloadMethod {
  return input.downloadMethod ?? "cookieproxy";
}

function getCookieproxyPath(input: DownloadInput): string {
  return input.cookieproxyPath ?? process.env.ARTICLE_DOWNLOADER_COOKIEPROXY_PATH ?? DEFAULT_COOKIEPROXY_PATH;
}

function collectCookieproxyErrorDiagnostics(
  error: unknown,
  cookieproxyPath: string,
): Record<string, string | number | boolean> {
  const diagnostics: Record<string, string | number | boolean> = {
    cookieproxyPath,
  };
  if (error && typeof error === "object") {
    const stderr = Reflect.get(error, "stderr");
    const stdout = Reflect.get(error, "stdout");
    const code = Reflect.get(error, "code");
    const killed = Reflect.get(error, "killed");
    const signal = Reflect.get(error, "signal");
    if (typeof stderr === "string" && stderr.trim()) {
      diagnostics.stderr = stderr.trim();
    }
    if (typeof stdout === "string" && stdout.trim()) {
      diagnostics.stdout = stdout.trim();
    }
    if (typeof code === "number" || typeof code === "string") {
      diagnostics.exitCode = String(code);
    }
    if (typeof killed === "boolean") {
      diagnostics.killed = killed;
    }
    if (typeof signal === "string" && signal) {
      diagnostics.signal = signal;
    }
  }
  return diagnostics;
}

interface CookieproxyTransportSuccess {
  ok: true;
  outputPath: string;
  diagnostics?: Record<string, string | number | boolean>;
}

interface CookieproxyTransportFailure {
  ok: false;
  reason: string;
  diagnostics: Record<string, string | number | boolean>;
}

type CookieproxyTransportResult = CookieproxyTransportSuccess | CookieproxyTransportFailure;

async function withCookieproxyDownloadedFile<T>(
  input: DownloadInput,
  outputFilename: string,
  consume: (result: CookieproxyTransportResult) => Promise<T>,
): Promise<T> {
  const timeoutMs = input.timeoutMs ?? 15000;
  const cookieproxyPath = getCookieproxyPath(input);
  const tempDir = await mkdtemp(path.join(tmpdir(), "article-downloader-cookieproxy-"));
  const outputPath = path.join(tempDir, outputFilename);

  try {
    const { stderr } = await execFileAsync(
      cookieproxyPath,
      ["--url", input.url, "--output", outputPath],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      },
    );

    return await consume({
      ok: true,
      outputPath,
      diagnostics: stderr.trim() ? { stderr: stderr.trim() } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown cookieproxy error";
    return await consume({
      ok: false,
      reason: message,
      diagnostics: collectCookieproxyErrorDiagnostics(error, cookieproxyPath),
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function downloadViaCookieproxy(
  input: DownloadInput,
  fetchedAt: string,
): Promise<DownloadResult> {
  return withCookieproxyDownloadedFile(input, "page.html", async (transport) => {
    if (!transport.ok) {
      return {
        ok: false,
        url: input.url,
        downloadMethod: "cookieproxy",
        finalUrl: input.url,
        fetchedAt,
        reason: transport.reason,
        errorCode: "E_FETCH_EXEC",
        diagnostics: transport.diagnostics,
      };
    }

    const html = await readFile(transport.outputPath, "utf8");
    return {
      ok: true,
      url: input.url,
      downloadMethod: "cookieproxy",
      finalUrl: input.url,
      html,
      fetchedAt,
      diagnostics: transport.diagnostics,
    };
  });
}

async function downloadOnce(input: DownloadInput, fetchedAt: string): Promise<DownloadResult> {
  void getDownloadMethod(input);
  return downloadViaCookieproxy(input, fetchedAt);
}

export async function downloadHtml(input: DownloadInput): Promise<DownloadResult> {
  const fetchedAt = toIsoNow();
  const initial = await downloadOnce(input, fetchedAt);
  const sourceUrl = parseSourceUrl(input.url);
  if (!sourceUrl) {
    return initial;
  }

  const resolved = resolveSource(sourceUrl);
  if (!resolved?.adapter.fetch) {
    return resolved ? { ...initial, source: resolved.source } : initial;
  }

  const result = await resolved.adapter.fetch.normalizeDownload({
    source: resolved.source,
    input,
    initial,
    fetchedAt,
    runTransport: (nextInput) => downloadOnce(nextInput, fetchedAt),
  });
  return result.source ? result : { ...result, source: resolved.source };
}

function getPdfOutputFilename(input: PdfDownloadInput): string {
  const filename = input.filename ?? decodeURIComponent(new URL(input.url).pathname.split("/").at(-1) ?? "");
  if (!filename || filename !== path.basename(filename) || !filename.toLowerCase().endsWith(".pdf")) {
    throw new Error(`invalid pdf filename: ${filename || input.url}`);
  }
  return filename;
}

export async function downloadPdf(input: PdfDownloadInput): Promise<PdfDownloadResult> {
  const fetchedAt = toIsoNow();
  const downloadMethod = getDownloadMethod(input);
  const filename = getPdfOutputFilename(input);
  return withCookieproxyDownloadedFile(input, filename, async (transport) => {
    if (!transport.ok) {
      return {
        ok: false,
        url: input.url,
        downloadMethod,
        finalUrl: input.url,
        fetchedAt,
        reason: transport.reason,
        errorCode: "E_FETCH_EXEC",
        diagnostics: transport.diagnostics,
      };
    }

    const bytes = await readFile(transport.outputPath);
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      return {
        ok: false,
        url: input.url,
        downloadMethod,
        finalUrl: input.url,
        fetchedAt,
        reason: `downloaded file is not a pdf: ${input.url}`,
        errorCode: "E_FETCH_EXEC",
        diagnostics: {
          ...(transport.diagnostics ?? {}),
          bytes: bytes.length,
        },
      };
    }

    await mkdir(input.outDir, { recursive: true });
    const pdfPath = path.join(input.outDir, filename);
    await writeFile(pdfPath, bytes);
    return {
      ok: true,
      url: input.url,
      downloadMethod,
      finalUrl: input.url,
      fetchedAt,
      pdfPath,
      bytes: bytes.length,
      diagnostics: transport.diagnostics,
    };
  });
}
