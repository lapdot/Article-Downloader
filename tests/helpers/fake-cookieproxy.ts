import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createFakeCookieproxy(
  root: string,
  mode:
    | "success"
    | "failure"
    | "pdf-success"
    | "pdf-html"
    | "substack-normalize"
    | "substack-normalize-lookup-failure"
    | "substack-normalize-canonical-fetch-failure"
    | "substack-normalize-single-mismatched-id",
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
      : mode === "pdf-success"
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
if [ "$url" = "https://www.foreignaffairs.com/system/files/pdf/2026/105301.pdf" ]; then
  printf '%s\\n' '%PDF-1.7 fake pdf body' > "$output"
else
  echo "unexpected url: $url" >&2
  exit 9
fi
`
        : mode === "pdf-html"
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
printf '<!doctype html><html><body>login</body></html>' > "$output"
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
        : mode === "substack-normalize-single-mismatched-id"
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
if [ "$url" = "https://substack.com/@tritaparsi/p-196179865" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <body>
    <script>window._preloads = JSON.parse("{\\"base_url\\":\\"https://substack.com\\",\\"profile\\":{\\"primaryPublication\\":{\\"id\\":3095469,\\"subdomain\\":\\"tritaparsi\\"}},\\"feedData\\":{\\"initialPost\\":{\\"post\\":{\\"id\\":196179865,\\"publication_id\\":3095469,\\"canonical_url\\":\\"https://tritaparsi.substack.com/p/the-important-change-in-irans-latest\\",\\"title\\":\\"The important change in Iran's latest response to Trump\\",\\"body_html\\":\\"<p>Canonical body.</p>\\",\\"post_date\\":\\"2026-05-10T00:00:00.000Z\\",\\"updated_at\\":\\"2026-05-10T00:05:00.000Z\\",\\"publishedBylines\\":[{\\"name\\":\\"Trita Parsi\\",\\"handle\\":\\"tritaparsi\\"}]}}}}");</script>
    <div>Aggregator shell only.</div>
  </body>
</html>
EOF
elif [ "$url" = "https://tritaparsi.substack.com/api/v1/posts?publication_id=3095469&post_ids=196179865" ]; then
  cat > "$output" <<'EOF'
[{"id":197148951,"canonical_url":"https://tritaparsi.substack.com/p/the-important-change-in-irans-latest"}]
EOF
elif [ "$url" = "https://tritaparsi.substack.com/p/the-important-change-in-irans-latest" ]; then
  cat > "$output" <<'EOF'
<!doctype html>
<html>
  <body>
    <article>
      <h1 class="post-title">The important change in Iran's latest response to Trump</h1>
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
