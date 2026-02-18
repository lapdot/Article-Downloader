import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test, vi } from "vitest";
import { runCli } from "../src/cli.js";
import { runIngest } from "../src/core/ingest.js";
import { writeTextFile } from "../src/utils/fs.js";

describe("ingest", () => {
  async function captureStderr(run: () => Promise<void>): Promise<string> {
    let stderr = "";
    const spy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(((chunk: string | Uint8Array) => {
        stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
        return true;
      }) as typeof process.stderr.write);
    try {
      await run();
      return stderr;
    } finally {
      spy.mockRestore();
    }
  }

  test("rejects --url input in v1", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ingest-cli-test-"));
    const htmlPath = path.join(root, "input.html");
    await writeTextFile(htmlPath, "<html><body><p>hello</p></body></html>");

    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "ingest",
        "--html",
        htmlPath,
        "--source-url",
        "https://www.zhihu.com/question/111111111/answer/222222222",
        "--fixture",
        "ingest-cli-reject-url",
        "--out-fixtures-dir",
        path.join(root, "fixtures"),
        "--url",
        "https://example.com/any",
      ]);
    });

    expect(stderr).toContain("E_INGEST_UNSUPPORTED_INPUT");
  });

  test("reports E_FILE_NOT_FOUND for missing --html path", async () => {
    const missingHtmlPath = path.join(tmpdir(), `missing-ingest-html-${Date.now()}.html`);
    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "ingest",
        "--html",
        missingHtmlPath,
        "--source-url",
        "https://www.zhihu.com/question/111111111/answer/222222222",
        "--fixture",
        "ingest-cli-missing-html",
        "--out-fixtures-dir",
        path.join(tmpdir(), "ingest-missing-html-fixtures"),
      ]);
    });

    expect(stderr).toContain(`E_FILE_NOT_FOUND: ingest html: ${missingHtmlPath}`);
  });

  test("sanitizes sensitive values while preserving unknown attributes", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ingest-run-test-"));
    const htmlPath = path.join(root, "input.html");
    const fixturesDir = path.join(root, "fixtures");

    const html = `<!doctype html>
<html>
  <body>
    <article class="Post-content" data-custom-new="feature-alpha">
      <meta itemprop="name" content="Alice Example" />
      <a href="https://www.zhihu.com/people/alice-example">profile</a>
      <a href="https://www.zhihu.com/question/123456789123/answer/987654321987?utm_source=abc123&xsec_token=verylongtoken_abcdefghijklmnopqrstuvwxyz">post</a>
      <p data-user-id="123456789123">token ntn_abcd1234abcd1234</p>
    </article>
  </body>
</html>`;
    await writeTextFile(htmlPath, html);

    const result = await runIngest({
      htmlPath,
      sourceUrl: "https://www.zhihu.com/question/123456789123/answer/987654321987",
      fixture: "ingest-sanitized",
      outFixturesDir: fixturesDir,
    });

    expect(result.ok).toBe(true);
    const sanitizedHtml = await readFile(path.join(fixturesDir, "ingest-sanitized.html"), "utf8");
    const mapRaw = await readFile(path.join(fixturesDir, "ingest-sanitized.map.json"), "utf8");

    expect(sanitizedHtml).toContain('data-custom-new="feature-alpha"');
    expect(sanitizedHtml).not.toContain("Alice Example");
    expect(sanitizedHtml).not.toContain("123456789123");
    expect(sanitizedHtml).not.toContain("ntn_abcd1234abcd1234");
    expect(mapRaw).toContain("PERSON_");
    expect(mapRaw).toContain("CID_");
    expect(mapRaw).not.toContain("ntn_abcd1234abcd1234");
  });

  test("produces deterministic sanitized output for same input", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ingest-determinism-test-"));
    const htmlPath = path.join(root, "input.html");
    const fixturesDir1 = path.join(root, "fixtures-a");
    const fixturesDir2 = path.join(root, "fixtures-b");
    const html = `<!doctype html><html><body>
      <a href="https://zhuanlan.zhihu.com/p/3333333333333333333">read</a>
      <p>Author Jane Doe</p>
    </body></html>`;
    await writeTextFile(htmlPath, html);

    await runIngest({
      htmlPath,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
      fixture: "deterministic",
      outFixturesDir: fixturesDir1,
    });

    await runIngest({
      htmlPath,
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
      fixture: "deterministic",
      outFixturesDir: fixturesDir2,
    });

    const htmlA = await readFile(path.join(fixturesDir1, "deterministic.html"), "utf8");
    const htmlB = await readFile(path.join(fixturesDir2, "deterministic.html"), "utf8");
    const mapA = await readFile(path.join(fixturesDir1, "deterministic.map.json"), "utf8");
    const mapB = await readFile(path.join(fixturesDir2, "deterministic.map.json"), "utf8");

    expect(htmlA).toBe(htmlB);
    expect(mapA).toBe(mapB);
  });

  test("fails fast when fixture target already exists", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "ingest-overwrite-test-"));
    const htmlPath = path.join(root, "input.html");
    const fixturesDir = path.join(root, "fixtures");
    const html = "<!doctype html><html><body><p>name Alice Example</p></body></html>";
    await writeTextFile(htmlPath, html);

    await runIngest({
      htmlPath,
      sourceUrl: "https://www.zhihu.com/question/123456789/answer/987654321",
      fixture: "existing-target",
      outFixturesDir: fixturesDir,
    });

    await expect(
      runIngest({
        htmlPath,
        sourceUrl: "https://www.zhihu.com/question/123456789/answer/987654321",
        fixture: "existing-target",
        outFixturesDir: fixturesDir,
      }),
    ).rejects.toThrow("E_INGEST_TARGET_EXISTS");
  });
});
