import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, test } from "vitest";
import { downloadHtml } from "../src/core/fetcher.js";
import { parseHtmlToMarkdown } from "../src/core/parser.js";
import { readFileSync } from "node:fs";

const fixture = readFileSync("tests/fixtures/zhihu-answer.html", "utf8");
const zhuanlanFixture = readFileSync("tests/fixtures/zhihu-zhuanlan.html", "utf8");

let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  if (server) {
    server.close();
    await once(server, "close");
    server = undefined;
  }
});

describe("fetch + parse integration", () => {
  test("downloads html and parses markdown", async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(fixture);
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to get server address");
    }

    const download = await downloadHtml({
      url: `http://127.0.0.1:${address.port}/article`,
      cookies: [{ name: "z_c0", value: "test" }],
    });

    expect(download.ok).toBe(true);
    expect(download.html).toContain("Zhihu Fixture Title");

    const parsed = await parseHtmlToMarkdown({
      html: download.html ?? "",
      sourceUrl: "https://www.zhihu.com/question/608863165/answer/1933151546000012584",
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.markdown).toContain("Zhihu Fixture Title");
  });

  test("downloads zhuanlan html and parses markdown", async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(zhuanlanFixture);
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to get server address");
    }

    const download = await downloadHtml({
      url: `http://127.0.0.1:${address.port}/article`,
      cookies: [{ name: "z_c0", value: "test" }],
    });

    expect(download.ok).toBe(true);
    expect(download.html).toContain("Zhuanlan Fixture Title");

    const parsed = await parseHtmlToMarkdown({
      html: download.html ?? "",
      sourceUrl: "https://zhuanlan.zhihu.com/p/2002117978997663372",
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.markdown).toContain("Zhuanlan Fixture Title");
  });
});
