import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { downloadHtml } from "../src/core/fetcher.js";
import { createFakeCookieproxy } from "./helpers/fake-cookieproxy.js";

describe("fetcher core transport orchestration", () => {
  test("defaults to cookieproxy when no method is provided", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "success");

    const result = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/default",
      cookies: [],
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.html).toContain("https://zhuanlan.zhihu.com/p/default");
  });

  test("downloads html through cookieproxy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "success");

    const result = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/456",
      cookies: [],
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.html).toContain("https://zhuanlan.zhihu.com/p/456");
  });

  test("reports command failures from cookieproxy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "failure");

    const result = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/789",
      cookies: [],
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(false);
    expect(result.downloadMethod).toBe("cookieproxy");
    expect(result.errorCode).toBe("E_FETCH_EXEC");
    expect(result.diagnostics?.stderr).toBe("cookieproxy exploded");
  });
});
