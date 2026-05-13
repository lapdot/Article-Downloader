import { mkdtemp, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { downloadHtml, downloadPdf } from "../src/core/fetcher.js";
import { createFakeCookieproxy } from "./helpers/fake-cookieproxy.js";

describe("fetcher core transport orchestration", () => {
  test("defaults to cookieproxy when no method is provided", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "success");

    const result = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/default",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.source).toBeUndefined();
    expect(result.html).toContain("https://zhuanlan.zhihu.com/p/default");
  });

  test("downloads html through cookieproxy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "success");

    const result = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/456",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.source).toEqual({ sourceId: "zhihu", contentType: "post" });
    expect(result.html).toContain("https://zhuanlan.zhihu.com/p/456");
  });

  test("reports command failures from cookieproxy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "failure");

    const result = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/789",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(false);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.source).toEqual({ sourceId: "zhihu", contentType: "post" });
    expect(result.errorCode).toBe("E_FETCH_EXEC");
    expect(result.diagnostics?.stderr).toBe("cookieproxy exploded");
  });

  test("downloads pdf through shared cookieproxy transport", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const outDir = path.join(root, "output");
    const cookieproxyPath = await createFakeCookieproxy(root, "pdf-success");

    const result = await downloadPdf({
      url: "https://www.foreignaffairs.com/system/files/pdf/2026/105301.pdf",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
      outDir,
    });

    expect(result.ok).toBe(true);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.pdfPath).toBe(path.join(outDir, "105301.pdf"));
    await expect(readFile(path.join(outDir, "105301.pdf"), "utf8")).resolves.toContain("%PDF-");
  });

  test("rejects non-pdf responses without creating final pdf artifact", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const outDir = path.join(root, "output");
    const cookieproxyPath = await createFakeCookieproxy(root, "pdf-html");

    const result = await downloadPdf({
      url: "https://www.foreignaffairs.com/system/files/pdf/2026/105301.pdf",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
      outDir,
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_FETCH_EXEC");
    expect(result.reason).toContain("downloaded file is not a pdf");
    await expect(readdir(outDir)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
