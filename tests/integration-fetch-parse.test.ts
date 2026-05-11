import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { downloadHtml } from "../src/core/fetcher.js";
import { parseHtmlToMarkdown } from "../src/core/parser.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { substackFixture } from "./helpers/parser-fixtures.js";

const fixture = readFileSync("tests/fixtures/zhihu-answer.html", "utf8");
const zhuanlanFixture = readFileSync("tests/fixtures/zhihu-zhuanlan.html", "utf8");

async function createFixtureCookieproxy(root: string): Promise<string> {
  const scriptPath = path.join(root, "fixture-cookieproxy.sh");
  const script = `#!/bin/sh
output=""
url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --url)
      url="$2"
      shift 2
      ;;
    --output)
      output="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
if [ "$url" = "https://www.zhihu.com/question/111111111/answer/1111111111111111111" ]; then
  cat > "$output" <<'EOF'
${fixture}
EOF
elif [ "$url" = "https://zhuanlan.zhihu.com/p/3333333333333333333" ]; then
  cat > "$output" <<'EOF'
${zhuanlanFixture}
EOF
elif [ "$url" = "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026" ]; then
  cat > "$output" <<'EOF'
${substackFixture}
EOF
else
  echo "unexpected url: $url" >&2
  exit 9
fi
`;
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);
  return scriptPath;
}

describe("fetch + parse integration", () => {
  test("downloads html and parses zhihu answer markdown", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetch-parse-integration-"));
    const cookieproxyPath = await createFixtureCookieproxy(root);

    const download = await downloadHtml({
      url: "https://www.zhihu.com/question/111111111/answer/1111111111111111111",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(download.ok).toBe(true);
    expect(download.downloadMethod).toBe("cookieproxy");
    expect(download.html).toContain("Zhihu Fixture Title");

    const parsed = await parseHtmlToMarkdown({
      html: download.html ?? "",
      sourceUrl: "https://www.zhihu.com/question/111111111/answer/1111111111111111111",
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.markdown).toContain("Zhihu Fixture Title");
  });

  test("downloads zhuanlan html and parses markdown", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetch-parse-integration-"));
    const cookieproxyPath = await createFixtureCookieproxy(root);

    const download = await downloadHtml({
      url: "https://zhuanlan.zhihu.com/p/3333333333333333333",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(download.ok).toBe(true);
    expect(download.downloadMethod).toBe("cookieproxy");
    expect(download.html).toContain("Sanitized Zhuanlan Title");

    const parsed = await parseHtmlToMarkdown({
      html: download.html ?? "",
      sourceUrl: "https://zhuanlan.zhihu.com/p/3333333333333333333",
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.markdown).toContain("Sanitized Zhuanlan Title");
  });

  test("downloads substack html and parses markdown", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetch-parse-integration-"));
    const cookieproxyPath = await createFixtureCookieproxy(root);

    const download = await downloadHtml({
      url: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(download.ok).toBe(true);
    expect(download.downloadMethod).toBe("cookieproxy");
    expect(download.html).toContain("Trading Post Friday May 8, 2026");

    const parsed = await parseHtmlToMarkdown({
      html: download.html ?? "",
      sourceUrl: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.markdown).toContain("# Trading Post Friday May 8, 2026");
    expect(parsed.markdown).toContain("[Michael Burry](https://substack.com/@michaeljburry)");
  });
});
