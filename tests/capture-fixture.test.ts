import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { runCli } from "../src/cli.js";
import { writeTextFile } from "../src/utils/fs.js";

let server: ReturnType<typeof createServer> | undefined;

beforeEach(() => {
  process.exitCode = 0;
});

afterEach(async () => {
  process.exitCode = 0;
  if (server) {
    server.close();
    await once(server, "close");
    server = undefined;
  }
});

async function writeConfigFiles(root: string): Promise<{ configPath: string; cookiesSecretsPath: string }> {
  const configPath = path.join(root, "public.config.json");
  const cookiesSecretsPath = path.join(root, "cookies.secrets.local.json");

  await writeTextFile(
    configPath,
    JSON.stringify(
      {
        pipeline: {
          outDir: path.join(root, "output"),
          useHtmlStyleForImage: false,
        },
        cookies: {
          publicEntries: [
            {
              name: "z_c0",
              value: "public-abc",
              domain: ".zhihu.com",
              path: "/",
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  await writeTextFile(cookiesSecretsPath, JSON.stringify([], null, 2));

  return { configPath, cookiesSecretsPath };
}

describe("capture-fixture", () => {
  test("captures fetched html and produces linked sanitized artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "capture-fixture-test-"));
    const outDir = path.join(root, "output");
    const fixturesDir = path.join(root, "fixtures");
    const { configPath, cookiesSecretsPath } = await writeConfigFiles(root);

    const html = `<!doctype html><html><body><article data-custom-new="feature-alpha"><p>Alice Example</p></article></body></html>`;
    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(html);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("missing server address");
    }

    let stdout = "";
    const spy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        return true;
      }) as typeof process.stdout.write);

    try {
      await runCli([
        "node",
        "article-downloader",
        "capture-fixture",
        "--url",
        `http://127.0.0.1:${addr.port}/article`,
        "--fixture",
        "captured-article",
        "--config",
        configPath,
        "--cookies-secrets",
        cookiesSecretsPath,
        "--out",
        outDir,
        "--out-fixtures-dir",
        fixturesDir,
      ]);
    } finally {
      spy.mockRestore();
    }

    const result = JSON.parse(stdout) as {
      ok: boolean;
      fetch: { outputDir?: string; htmlPath?: string };
      ingest?: { artifacts: { sanitizedHtmlPath: string; mapPath: string } };
      handoff?: { copiedArtifactsDir: string };
    };

    expect(result.ok).toBe(true);
    expect(result.fetch.outputDir).toBeTruthy();
    expect(result.fetch.htmlPath).toBeTruthy();
    expect(result.ingest?.artifacts.sanitizedHtmlPath).toBe(path.join(fixturesDir, "captured-article.html"));

    const outputRuns = await readdir(outDir);
    expect(outputRuns.length).toBe(1);

    const fetchedHtml = await readFile(path.join(outDir, outputRuns[0], "page.html"), "utf8");
    expect(fetchedHtml).toContain("Alice Example");

    const copiedSanitizedHtml = await readFile(path.join(outDir, outputRuns[0], "ingest", "captured-article.html"), "utf8");
    expect(copiedSanitizedHtml).not.toContain("Alice Example");

    const fixtureSanitizedHtml = await readFile(path.join(fixturesDir, "captured-article.html"), "utf8");
    expect(fixtureSanitizedHtml).toContain("feature-alpha");
    expect(result.handoff?.copiedArtifactsDir).toBe(path.join(outDir, outputRuns[0], "ingest"));
  });

  test("returns non-zero with fetch diagnostics when ingest fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "capture-fixture-failure-test-"));
    const outDir = path.join(root, "output");
    const fixturesDir = path.join(root, "fixtures");
    const { configPath, cookiesSecretsPath } = await writeConfigFiles(root);

    await writeTextFile(path.join(fixturesDir, "existing-fixture.html"), "<html></html>");
    await writeTextFile(path.join(fixturesDir, "existing-fixture.map.json"), "[]");

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<!doctype html><html><body><p>hello</p></body></html>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("missing server address");
    }

    let stdout = "";
    const outSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        return true;
      }) as typeof process.stdout.write);

    try {
      await runCli([
        "node",
        "article-downloader",
        "capture-fixture",
        "--url",
        `http://127.0.0.1:${addr.port}/article`,
        "--fixture",
        "existing-fixture",
        "--config",
        configPath,
        "--cookies-secrets",
        cookiesSecretsPath,
        "--out",
        outDir,
        "--out-fixtures-dir",
        fixturesDir,
      ]);
    } finally {
      outSpy.mockRestore();
    }

    const result = JSON.parse(stdout) as {
      ok: boolean;
      reason?: string;
      fetch: { outputDir?: string; htmlPath?: string };
      ingest?: unknown;
    };

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("ingest failed");
    expect(result.reason).toContain("E_INGEST_TARGET_EXISTS");
    expect(result.fetch.outputDir).toBeTruthy();
    expect(result.fetch.htmlPath).toBeTruthy();
    expect(result.ingest).toBeUndefined();
    expect(process.exitCode).toBe(1);
  });

  test("stops before ingest when fetch fails", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "capture-fixture-fetch-fail-test-"));
    const outDir = path.join(root, "output");
    const fixturesDir = path.join(root, "fixtures");
    const { configPath, cookiesSecretsPath } = await writeConfigFiles(root);

    let stdout = "";
    const outSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        return true;
      }) as typeof process.stdout.write);

    try {
      await runCli([
        "node",
        "article-downloader",
        "capture-fixture",
        "--url",
        "http://127.0.0.1:1/unreachable",
        "--fixture",
        "capture-fetch-failed",
        "--config",
        configPath,
        "--cookies-secrets",
        cookiesSecretsPath,
        "--out",
        outDir,
        "--out-fixtures-dir",
        fixturesDir,
      ]);
    } finally {
      outSpy.mockRestore();
    }

    const result = JSON.parse(stdout) as { ok: boolean; reason?: string; fetch: { outputDir?: string }; ingest?: unknown };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("fetch failed");
    expect(result.fetch.outputDir).toBeUndefined();
    expect(result.ingest).toBeUndefined();
    expect(process.exitCode).toBe(1);
  });
});
