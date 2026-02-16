import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { afterEach, describe, expect, test } from "vitest";
import { createProgram, runCli } from "../src/cli.js";
import { writeTextFile } from "../src/utils/fs.js";

let server: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  if (server) {
    server.close();
    await once(server, "close");
    server = undefined;
  }
});

describe("cli", () => {
  test("fetch command writes output artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "article-downloader-test-"));
    const cookiesPath = path.join(root, "cookies.json");
    const outDir = path.join(root, "output");

    await writeTextFile(cookiesPath, JSON.stringify([{ name: "z_c0", value: "abc" }], null, 2));

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
      "--cookies",
      cookiesPath,
      "--out",
      outDir,
      "--json",
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
      "--json",
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
      "--json",
    ]);

    const withFlagDirs = await (await import("node:fs/promises")).readdir(outWithFlag);
    const markdownWithFlag = await readFile(path.join(outWithFlag, withFlagDirs[0], "article.md"), "utf8");
    expect(markdownWithFlag).toContain(
      '<img src="https://picx.zhimg.com/cli-image.png" style="height: 50;width: 60;">',
    );
  });

  test("get_metadata, parse and run commands expose expected options", () => {
    const program = createProgram();
    const metadataCommand = program.commands.find((command) => command.name() === "get_metadata");
    const parseCommand = program.commands.find((command) => command.name() === "parse");
    const runCommand = program.commands.find((command) => command.name() === "run");
    const metadataOptionNames = metadataCommand?.options.map((option) => option.long);
    const parseOptionNames = parseCommand?.options.map((option) => option.long);
    const runOptionNames = runCommand?.options.map((option) => option.long);

    expect(parseOptionNames).toContain("--use-html-style-for-image");
    expect(metadataOptionNames).toContain("--html");
    expect(metadataOptionNames).toContain("--url");
    expect(runOptionNames).toContain("--use-html-style-for-image");
    expect(runOptionNames).toContain("--full-result");
  });

});
