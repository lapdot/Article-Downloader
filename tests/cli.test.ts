import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Command } from "commander";
import { createProgram, runCli } from "../src/cli.js";
import { writeTextFile } from "../src/utils/fs.js";
import * as zhihuAdapter from "../src/adapters/zhihu.js";
import * as parserCore from "../src/core/parser.js";

let server: ReturnType<typeof createServer> | undefined;
const ORIGINAL_ENV = { ...process.env };

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
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
          outDir: "output",
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

  await writeTextFile(
    cookiesSecretsPath,
    JSON.stringify([], null, 2),
  );

  return { configPath, cookiesSecretsPath };
}

describe("cli", () => {
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

  function mustRequireOption(command: Command, longOption: string): void {
    const option = command.options.find((item) => item.long === longOption);
    expect(option, `missing option ${longOption}`).toBeDefined();
    expect(option?.mandatory, `${longOption} should be mandatory`).toBe(true);
  }

  function mustHaveOption(command: Command, longOption: string): void {
    const option = command.options.find((item) => item.long === longOption);
    expect(option, `missing option ${longOption}`).toBeDefined();
  }

  test("fetch command writes output artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "article-downloader-test-"));
    const outDir = path.join(root, "output");
    const { configPath, cookiesSecretsPath } = await writeConfigFiles(root);

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h1>Hello</h1></body></html>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("missing server address");
    }

    await runCli([
      "node",
      "article-downloader",
      "fetch",
      "--url",
      `http://127.0.0.1:${addr.port}/`,
      "--config",
      configPath,
      "--cookies-secrets",
      cookiesSecretsPath,
      "--out",
      outDir,
    ]);

    const createdDirs = await (await import("node:fs/promises")).readdir(outDir);
    expect(createdDirs.length).toBe(1);

    const html = await readFile(path.join(outDir, createdDirs[0], "page.html"), "utf8");
    expect(html).toContain("Hello");
  });

  test("parse command toggles image output style via --use-html-style-for-image", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "article-downloader-test-"));
    const htmlPath = path.join(root, "page.html");
    const outWithoutFlag = path.join(root, "output-without-flag");
    const outWithFlag = path.join(root, "output-with-flag");
    const html = `<!doctype html>
<html>
  <head><title>Zhihu Fixture Title</title></head>
  <body>
    <h1 class="QuestionHeader-title">Zhihu Fixture Title</h1>
    <div class="AnswerItem">
      <span class="RichText">
        <p>Paragraph.</p>
        <img src="https://picx.zhimg.com/cli-image.png" data-rawheight="50" data-rawwidth="60" />
      </span>
    </div>
  </body>
</html>`;

    await writeTextFile(htmlPath, html);

    await runCli([
      "node",
      "article-downloader",
      "parse",
      "--html",
      htmlPath,
      "--url",
      "https://www.zhihu.com/question/1/answer/2",
      "--out",
      outWithoutFlag,
    ]);

    const withoutFlagDirs = await (await import("node:fs/promises")).readdir(outWithoutFlag);
    const markdownWithoutFlag = await readFile(
      path.join(outWithoutFlag, withoutFlagDirs[0], "article.md"),
      "utf8",
    );
    expect(markdownWithoutFlag).toContain("![](https://picx.zhimg.com/cli-image.png)");
    expect(markdownWithoutFlag).not.toContain("<img src=");

    await runCli([
      "node",
      "article-downloader",
      "parse",
      "--html",
      htmlPath,
      "--url",
      "https://www.zhihu.com/question/1/answer/2",
      "--out",
      outWithFlag,
      "--use-html-style-for-image",
    ]);

    const withFlagDirs = await (await import("node:fs/promises")).readdir(outWithFlag);
    const markdownWithFlag = await readFile(path.join(outWithFlag, withFlagDirs[0], "article.md"), "utf8");
    expect(markdownWithFlag).toContain(
      '<img src="https://picx.zhimg.com/cli-image.png" style="height: 50;width: 60;">',
    );
  });

  test("commands expose expected options", () => {
    const program = createProgram();
    const verifyCommand = program.commands.find((command) => command.name() === "verify-zhihu");
    const fetchCommand = program.commands.find((command) => command.name() === "fetch");
    const metadataCommand = program.commands.find((command) => command.name() === "get_metadata");
    const parseCommand = program.commands.find((command) => command.name() === "parse");
    const transformCommand = program.commands.find((command) => command.name() === "transform-notion");
    const uploadCommand = program.commands.find((command) => command.name() === "upload-notion");
    const ingestCommand = program.commands.find((command) => command.name() === "ingest");
    const captureFixtureCommand = program.commands.find((command) => command.name() === "capture-fixture");
    const runCommand = program.commands.find((command) => command.name() === "run");
    const runOptionNames = runCommand?.options.map((option) => option.long);

    expect(verifyCommand).toBeDefined();
    expect(fetchCommand).toBeDefined();
    expect(metadataCommand).toBeDefined();
    expect(parseCommand).toBeDefined();
    expect(transformCommand).toBeDefined();
    expect(uploadCommand).toBeDefined();
    expect(ingestCommand).toBeDefined();
    expect(captureFixtureCommand).toBeDefined();
    expect(runCommand).toBeDefined();

    mustHaveOption(verifyCommand!, "--config");
    mustRequireOption(fetchCommand!, "--url");
    mustHaveOption(fetchCommand!, "--config");
    mustRequireOption(metadataCommand!, "--html");
    mustRequireOption(metadataCommand!, "--url");
    mustRequireOption(parseCommand!, "--html");
    mustRequireOption(parseCommand!, "--url");
    mustRequireOption(transformCommand!, "--md");
    mustRequireOption(uploadCommand!, "--blocks");
    mustHaveOption(uploadCommand!, "--config");
    mustRequireOption(ingestCommand!, "--html");
    mustRequireOption(ingestCommand!, "--source-url");
    mustRequireOption(ingestCommand!, "--fixture");
    mustRequireOption(captureFixtureCommand!, "--url");
    mustRequireOption(captureFixtureCommand!, "--fixture");
    mustHaveOption(captureFixtureCommand!, "--config");
    mustHaveOption(captureFixtureCommand!, "--cookies-secrets");
    mustRequireOption(runCommand!, "--url");
    mustHaveOption(runCommand!, "--config");

    expect(runOptionNames).toContain("--config");
    expect(runOptionNames).toContain("--cookies-secrets");
    expect(runOptionNames).toContain("--notion-secrets");
    expect(runOptionNames).toContain("--full-result");
  });

  test("run command fails when config path is missing in both arg and env", async () => {
    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "run",
        "--url",
        "https://zhuanlan.zhihu.com/p/123",
      ]);
    });

    expect(stderr).toContain(
      "missing public config path: provide --config or ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH",
    );
  });

  test("fetch supports public config path from env var", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "article-downloader-test-"));
    const outDir = path.join(root, "output");
    const { configPath, cookiesSecretsPath } = await writeConfigFiles(root);
    process.env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH = configPath;
    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = cookiesSecretsPath;

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h1>Hello</h1></body></html>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("missing server address");
    }

    await runCli([
      "node",
      "article-downloader",
      "fetch",
      "--url",
      `http://127.0.0.1:${addr.port}/`,
      "--out",
      outDir,
    ]);
  });

  test("run reaches upload stage and fails when notion secrets are missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "article-downloader-test-"));
    const outDir = path.join(root, "output");
    const { configPath, cookiesSecretsPath } = await writeConfigFiles(root);

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/html" });
      res.end("<html><body><h1>Hello</h1></body></html>");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("missing server address");
    }

    const verifySpy = vi
      .spyOn(zhihuAdapter, "verifyZhihuCookies")
      .mockResolvedValue({ ok: true, statusCode: 200 });
    const metadataSpy = vi
      .spyOn(parserCore, "parseHtmlToMetadata")
      .mockResolvedValue({
        ok: true,
        metadata: { articleUrl: `http://127.0.0.1:${addr.port}/` },
      });
    const markdownSpy = vi
      .spyOn(parserCore, "parseHtmlToMarkdown")
      .mockResolvedValue({
        ok: true,
        title: "Hello",
        markdown: "# Hello",
      });
    const output = await (async () => {
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
          "run",
          "--url",
          `http://127.0.0.1:${addr.port}/`,
          "--config",
          configPath,
          "--cookies-secrets",
          cookiesSecretsPath,
          "--out",
          outDir,
          "--full-result",
        ]);
      } finally {
        spy.mockRestore();
        verifySpy.mockRestore();
        metadataSpy.mockRestore();
        markdownSpy.mockRestore();
      }
      return stdout;
    })();

    const parsed = JSON.parse(output) as { ok: boolean; reason?: string; notionBlocksPath?: string; upload?: { ok: boolean; reason?: string } };
    expect(parsed.ok).toBe(false);
    expect(parsed.reason).toBe("notion upload failed");
    expect(parsed.notionBlocksPath).toBeTruthy();
    expect(parsed.upload?.ok).toBe(false);
  });

  test("get_metadata reports E_FILE_NOT_FOUND for missing --html path", async () => {
    const missingHtmlPath = path.join(tmpdir(), `missing-html-${Date.now()}.html`);
    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "get_metadata",
        "--html",
        missingHtmlPath,
        "--url",
        "https://zhuanlan.zhihu.com/p/123",
      ]);
    });

    expect(stderr).toContain(`E_FILE_NOT_FOUND: input html: ${missingHtmlPath}`);
  });

  test("transform-notion reports E_FILE_NOT_FOUND for missing --md path", async () => {
    const missingMdPath = path.join(tmpdir(), `missing-md-${Date.now()}.md`);
    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "transform-notion",
        "--md",
        missingMdPath,
      ]);
    });

    expect(stderr).toContain(`E_FILE_NOT_FOUND: input markdown: ${missingMdPath}`);
  });

  test("upload-notion reports E_FILE_NOT_FOUND for missing --blocks path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "article-downloader-test-"));
    const { configPath } = await writeConfigFiles(root);
    const missingBlocksPath = path.join(root, "missing-blocks.json");
    const notionSecretsPath = path.join(root, "notion.secrets.local.json");
    await writeTextFile(
      notionSecretsPath,
      JSON.stringify(
        {
          notionToken: "token",
          databaseId: "database",
        },
        null,
        2,
      ),
    );

    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "upload-notion",
        "--blocks",
        missingBlocksPath,
        "--config",
        configPath,
        "--notion-secrets",
        notionSecretsPath,
      ]);
    });

    expect(stderr).toContain(`E_FILE_NOT_FOUND: input blocks: ${missingBlocksPath}`);
  });

  test("config-aware commands report E_FILE_NOT_FOUND for missing --config path", async () => {
    const missingConfigPath = path.join(tmpdir(), `missing-public-config-${Date.now()}.json`);
    const stderr = await captureStderr(async () => {
      await runCli([
        "node",
        "article-downloader",
        "verify-zhihu",
        "--config",
        missingConfigPath,
      ]);
    });

    expect(stderr).toContain(`E_FILE_NOT_FOUND: public config: ${missingConfigPath}`);
  });

  test("verify-zhihu rejects irrelevant --notion-secrets flag", async () => {
    const program = createProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(
        [
          "node",
          "article-downloader",
          "verify-zhihu",
          "--config",
          "./config/public.config.json",
          "--notion-secrets",
          "./config/notion.secrets.local.json",
        ],
      ),
    ).rejects.toThrowError('process.exit unexpectedly called with "1"');
  });

  test("fetch rejects irrelevant --notion-secrets flag", async () => {
    const program = createProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(
        [
          "node",
          "article-downloader",
          "fetch",
          "--url",
          "https://zhuanlan.zhihu.com/p/123",
          "--config",
          "./config/public.config.json",
          "--notion-secrets",
          "./config/notion.secrets.local.json",
        ],
      ),
    ).rejects.toThrowError('process.exit unexpectedly called with "1"');
  });

  test("upload-notion rejects irrelevant --cookies-secrets flag", async () => {
    const program = createProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(
        [
          "node",
          "article-downloader",
          "upload-notion",
          "--blocks",
          "./output/notion-blocks.json",
          "--config",
          "./config/public.config.json",
          "--cookies-secrets",
          "./config/cookies.secrets.local.json",
        ],
      ),
    ).rejects.toThrowError('process.exit unexpectedly called with "1"');
  });

  test("capture-fixture rejects irrelevant --notion-secrets flag", async () => {
    const program = createProgram();
    program.exitOverride();
    await expect(
      program.parseAsync(
        [
          "node",
          "article-downloader",
          "capture-fixture",
          "--url",
          "https://zhuanlan.zhihu.com/p/123",
          "--fixture",
          "capture-irrelevant",
          "--config",
          "./config/public.config.json",
          "--notion-secrets",
          "./config/notion.secrets.local.json",
        ],
      ),
    ).rejects.toThrowError('process.exit unexpectedly called with "1"');
  });
});
