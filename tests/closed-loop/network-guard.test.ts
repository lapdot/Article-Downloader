import { createServer } from "node:http";
import { once } from "node:events";
import { fetch } from "undici";
import { afterEach, describe, expect, test } from "vitest";

const CLOSED_LOOP_ENV = "ARTICLE_DOWNLOADER_CLOSED_LOOP";
const runWhenClosedLoop = process.env[CLOSED_LOOP_ENV] === "1" ? test : test.skip;

let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  if (server) {
    server.close();
    await once(server, "close");
    server = undefined;
  }
});

describe("closed-loop network guard", () => {
  runWhenClosedLoop("blocks outbound network to external hosts", async () => {
    await expect(fetch("https://www.zhihu.com/settings/account")).rejects.toThrowError(
      /fetch failed|net\.connect disabled|not matched|Mock dispatch/i,
    );
  });

  runWhenClosedLoop("allows requests to localhost", async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
    });

    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("failed to get server address");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
