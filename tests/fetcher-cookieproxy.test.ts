import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { downloadHtml } from "../src/core/fetcher.js";

async function createFakeCookieproxy(
  root: string,
  mode: "success" | "failure",
): Promise<string> {
  const scriptPath = path.join(root, "fake-cookieproxy.sh");
  const script =
    mode === "success"
      ? `#!/bin/sh
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
printf '<!doctype html><html><body><h1>%s</h1></body></html>' "$url" > "$output"
`
      : `#!/bin/sh
echo "cookieproxy exploded" >&2
exit 7
`;
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);
  return scriptPath;
}

describe("cookieproxy fetcher", () => {
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
