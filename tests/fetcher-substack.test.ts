import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { downloadHtml } from "../src/core/fetcher.js";
import { createFakeCookieproxy } from "./helpers/fake-cookieproxy.js";

describe("substack fetch normalization", () => {
  test("normalizes substack aggregator downloads to the canonical publication url", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize");

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://substack.com/@exampleauthor/p-196918166");
    expect(result.source).toEqual({ sourceId: "substack", contentType: "post" });
    expect(result.finalUrl).toBe("https://examplepublication.substack.com/p/canonical-post");
    expect(result.html).toContain("Canonical Post");
    expect(result.diagnostics?.normalizedFromUrl).toBe("https://substack.com/@exampleauthor/p-196918166");
    expect(result.diagnostics?.substackLookupUrl).toBe(
      "https://examplepublication.substack.com/api/v1/posts?publication_id=6819723&post_ids=196918166",
    );
  });

  test("keeps the original substack aggregator shell when canonical lookup cannot be resolved", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize-lookup-failure");

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toEqual({ sourceId: "substack", contentType: "post" });
    expect(result.finalUrl).toBe("https://substack.com/@exampleauthor/p-196918166");
    expect(result.html).toContain("Aggregator shell only.");
  });

  test("falls back to synthetic article html when canonical substack fetch fails after lookup succeeds", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize-canonical-fetch-failure");

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toEqual({ sourceId: "substack", contentType: "post" });
    expect(result.finalUrl).toBe("https://examplepublication.substack.com/p/canonical-post");
    expect(result.html).toContain("Canonical Fallback Post");
    expect(result.html).toContain("Canonical fallback body.");
    expect(result.diagnostics?.substackSyntheticFallback).toBe(true);
    expect(result.diagnostics?.normalizedFromUrl).toBe("https://substack.com/@exampleauthor/p-196918166");
  });

  test("normalizes directly from a preloaded canonical post in a newer reader shell", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize-single-mismatched-id");

    const result = await downloadHtml({
      url: "https://substack.com/@tritaparsi/p-196179865",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toEqual({ sourceId: "substack", contentType: "post" });
    expect(result.finalUrl).toBe("https://tritaparsi.substack.com/p/the-important-change-in-irans-latest");
    expect(result.html).toContain("The important change in Iran's latest response to Trump");
    expect(result.diagnostics?.normalizedFromUrl).toBe("https://substack.com/@tritaparsi/p-196179865");
    expect(result.diagnostics?.substackNormalizationSource).toBe("preloaded-canonical");
    expect(result.diagnostics?.substackLookupUrl).toBeUndefined();
  });

  test("normalizes nested substack publication context from a real-world style reader shell", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const scriptPath = path.join(root, "fake-cookieproxy.sh");
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
if [ "$url" = "https://substack.com/@exampleauthor/p-196918166" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <body>
    <script>window._preloads = JSON.parse("{\\"base_url\\":\\"https://substack.com\\",\\"profile\\":{\\"publication\\":{\\"id\\":6819723,\\"subdomain\\":\\"examplepublication\\",\\"base_url\\":\\"https://examplepublication.substack.com\\"}},\\"subscription\\":{\\"publication_id\\":6819723}}");</script>
    <div>Aggregator shell only.</div>
  </body>
</html>
EOF
elif [ "$url" = "https://examplepublication.substack.com/api/v1/posts?publication_id=6819723&post_ids=196918166" ]; then
  cat > "$output" <<'EOF'
[{"id":196918166,"canonical_url":"https://examplepublication.substack.com/p/canonical-post"}]
EOF
elif [ "$url" = "https://examplepublication.substack.com/p/canonical-post" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <body>
    <article><h1 class="post-title">Canonical Nested Post</h1></article>
  </body>
</html>
EOF
else
  echo "unexpected url: $url" >&2
  exit 9
fi
`;
    await writeFile(scriptPath, script, "utf8");
    await chmod(scriptPath, 0o755);

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      downloadMethod: "cookieproxy",
      cookieproxyPath: scriptPath,
    });

    expect(result.ok).toBe(true);
    expect(result.source).toEqual({ sourceId: "substack", contentType: "post" });
    expect(result.finalUrl).toBe("https://examplepublication.substack.com/p/canonical-post");
    expect(result.html).toContain("Canonical Nested Post");
  });

  test("bypasses source normalization for unsupported sources", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "success");

    const result = await downloadHtml({
      url: "https://example.com/article",
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.finalUrl).toBe("https://example.com/article");
    expect(result.html).toContain("https://example.com/article");
    expect(result.diagnostics?.normalizedFromUrl).toBeUndefined();
  });
});
