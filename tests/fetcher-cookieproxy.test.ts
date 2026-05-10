import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { downloadHtml } from "../src/core/fetcher.js";

async function createFakeCookieproxy(
  root: string,
  mode: "success" | "failure" | "substack-normalize" | "substack-normalize-lookup-failure" | "substack-normalize-canonical-fetch-failure",
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
      : mode === "substack-normalize"
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
if [ "$url" = "https://substack.com/@exampleauthor/p-196918166" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <head>
    <meta property="og:title" content="Example Aggregator Title" />
  </head>
  <body>
    <script>window._preloads = JSON.parse("{\\"publication_id\\":6819723,\\"base_url\\":\\"https://examplepublication.substack.com\\"}");</script>
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
    <article>
      <h1 class="post-title">Canonical Post</h1>
      <div class="available-content"><div class="body markup"><p>Canonical body.</p></div></div>
    </article>
  </body>
</html>
EOF
else
  echo "unexpected url: $url" >&2
  exit 9
fi
`
        : mode === "substack-normalize-lookup-failure"
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
if [ "$url" = "https://substack.com/@exampleauthor/p-196918166" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <body>
    <script>window._preloads = JSON.parse("{\\"publication_id\\":6819723,\\"base_url\\":\\"https://examplepublication.substack.com\\"}");</script>
    <div>Aggregator shell only.</div>
  </body>
</html>
EOF
elif [ "$url" = "https://examplepublication.substack.com/api/v1/posts?publication_id=6819723&post_ids=196918166" ]; then
  cat > "$output" <<'EOF'
not json
EOF
else
  echo "unexpected url: $url" >&2
  exit 9
fi
`
          : mode === "substack-normalize-canonical-fetch-failure"
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
if [ "$url" = "https://substack.com/@exampleauthor/p-196918166" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <body>
    <script>window._preloads = JSON.parse("{\\"publication_id\\":6819723,\\"base_url\\":\\"https://examplepublication.substack.com\\"}");</script>
    <div>Aggregator shell only.</div>
  </body>
</html>
EOF
elif [ "$url" = "https://examplepublication.substack.com/api/v1/posts?publication_id=6819723&post_ids=196918166" ]; then
  cat > "$output" <<'EOF'
[{"id":196918166,"canonical_url":"https://examplepublication.substack.com/p/canonical-post","title":"Canonical Fallback Post","subtitle":"Fallback subtitle","body_html":"<p>Canonical fallback body.</p>","post_date":"2026-06-01T10:00:00.000Z","updated_at":"2026-06-01T10:05:00.000Z","publishedBylines":[{"name":"Example Author","handle":"exampleauthor"}]}]
EOF
elif [ "$url" = "https://examplepublication.substack.com/p/canonical-post" ]; then
  echo "canonical fetch failed" >&2
  exit 7
else
  echo "unexpected url: $url" >&2
  exit 9
fi
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

  test("normalizes substack aggregator downloads to the canonical publication url", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize");

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      cookies: [],
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe("https://substack.com/@exampleauthor/p-196918166");
    expect(result.finalUrl).toBe("https://examplepublication.substack.com/p/canonical-post");
    expect(result.html).toContain("Canonical Post");
    expect(result.diagnostics?.normalizedFromUrl).toBe("https://substack.com/@exampleauthor/p-196918166");
  });

  test("keeps the original substack aggregator shell when canonical lookup cannot be resolved", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize-lookup-failure");

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      cookies: [],
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.finalUrl).toBe("https://substack.com/@exampleauthor/p-196918166");
    expect(result.html).toContain("Aggregator shell only.");
  });

  test("falls back to synthetic article html when canonical substack fetch fails after lookup succeeds", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fetcher-cookieproxy-test-"));
    const cookieproxyPath = await createFakeCookieproxy(root, "substack-normalize-canonical-fetch-failure");

    const result = await downloadHtml({
      url: "https://substack.com/@exampleauthor/p-196918166",
      cookies: [],
      downloadMethod: "cookieproxy",
      cookieproxyPath,
    });

    expect(result.ok).toBe(true);
    expect(result.finalUrl).toBe("https://examplepublication.substack.com/p/canonical-post");
    expect(result.html).toContain("Canonical Fallback Post");
    expect(result.html).toContain("Canonical fallback body.");
    expect(result.diagnostics?.substackSyntheticFallback).toBe(true);
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
      cookies: [],
      downloadMethod: "cookieproxy",
      cookieproxyPath: scriptPath,
    });

    expect(result.ok).toBe(true);
    expect(result.finalUrl).toBe("https://examplepublication.substack.com/p/canonical-post");
    expect(result.html).toContain("Canonical Nested Post");
  });
});
