import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { parseSourceUrl, resolveSource } from "../adapters/resolve-source.js";
import { toIsoNow } from "../utils/time.js";
import type { DownloadInput, DownloadMethod, DownloadResult } from "../types.js";

const DEFAULT_COOKIEPROXY_PATH = "/Users/lapdot/Documents/projects/runnable/cookieproxy";
const execFileAsync = promisify(execFile);

function getDownloadMethod(input: DownloadInput): DownloadMethod {
  return input.downloadMethod ?? "cookieproxy";
}

function getCookieproxyPath(input: DownloadInput): string {
  return input.cookieproxyPath ?? process.env.ARTICLE_DOWNLOADER_COOKIEPROXY_PATH ?? DEFAULT_COOKIEPROXY_PATH;
}

async function downloadViaCookieproxy(
  input: DownloadInput,
  fetchedAt: string,
): Promise<DownloadResult> {
  const timeoutMs = input.timeoutMs ?? 15000;
  const cookieproxyPath = getCookieproxyPath(input);
  const tempDir = await mkdtemp(path.join(tmpdir(), "article-downloader-cookieproxy-"));
  const outputPath = path.join(tempDir, "page.html");

  try {
    const { stderr } = await execFileAsync(
      cookieproxyPath,
      ["--url", input.url, "--output", outputPath],
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      },
    );

    const html = await readFile(outputPath, "utf8");
    return {
      ok: true,
      url: input.url,
      downloadMethod: "cookieproxy",
      finalUrl: input.url,
      html,
      fetchedAt,
      diagnostics: stderr.trim() ? { stderr: stderr.trim() } : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown cookieproxy error";
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
    return {
      ok: false,
      url: input.url,
      downloadMethod: "cookieproxy",
      finalUrl: input.url,
      fetchedAt,
      reason: message,
      errorCode: "E_FETCH_EXEC",
      diagnostics,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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
