# ArticleDownloader

A Node.js (TypeScript + ESM) project for turning article URLs into local HTML, Markdown, and Notion-block artifacts, with optional downstream upload to Notion.

## Documentation Map

- Human onboarding and usage: this README
- Agent-facing repo guidance: `AGENTS.md`
- Docs index: `docs/README.md`
- Runtime contract: `docs/policies/runtime-contract.md`
- Testing and safety: `docs/policies/testing-and-safety.md`
- GUI contract: `docs/policies/gui-contract.md`
- Cross-project reference template: `docs/policies/portable-policy-template.md`
- Architecture overview: `docs/architecture/overview.md`
- Decision records: `docs/decisions/`
- URL iteration workflow: `docs/workflows/url-driven-iteration.md`
- Local development workflow: `docs/workflows/local-dev.md`

## Features

- Generate three reviewable output formats from a URL:
  - fetched source HTML (`page.html`)
  - parsed Markdown article (`article.md`)
  - Notion block JSON (`notion-blocks.json`)
- Verify Zhihu cookies by checking `https://www.zhihu.com/settings/account`:
  - `200` means valid login session.
  - `301/302` means cookies are invalid or expired.
  - other status codes are treated as network/other issues.
- Download webpage HTML with URL-aware cookie handling, with optional `cookieproxy` command execution.
- Parse Zhihu HTML to Markdown using hardcoded selectors for:
  - answer (`/question/.../answer/...`)
  - pin idea (`/pin/...`)
  - zhuanlan article (`zhuanlan.zhihu.com/p/...`)
- Upload generated Notion blocks to a Notion database as a separate downstream step.
- Run an end-to-end pipeline from URL to local artifacts and optional Notion upload.

## Requirements

- Node.js `>=20`
- npm

## Install

```bash
npm install
```

## Typical Workflow

The primary development loop is:

1. Give the project a URL.
2. Generate local HTML, Markdown, metadata, and Notion block artifacts.
3. Inspect the outputs by format.
4. Identify where the result needs improvement.
5. Refine fetch, parse, or Notion-transform behavior.
6. Regenerate and compare again.

Typical artifact locations:

- HTML format: `artifacts/runtime/<run>/page.html`
- metadata: `artifacts/runtime/<run>/metadata.json`
- Markdown format: `artifacts/runtime/<run>/article.md`
- Notion format: `artifacts/runtime/<transform-run>/notion-blocks.json`

Use this README for the quick path and `docs/workflows/url-driven-iteration.md` for the full iterative workflow.

## Config Model

Configuration is split into non-sensitive and sensitive files.

### Non-sensitive (committable)

`config/public.config.json`

```json
{
  "pipeline": {
    "outDir": "artifacts/runtime",
    "useHtmlStyleForImage": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "downloadMethod": "cookieproxy"
  },
  "cookies": {
    "publicEntries": [
      { "name": "_ga", "value": "GA1.2.example", "domain": ".zhihu.com", "path": "/" },
      { "name": "public_cookie", "value": "public_value", "domain": ".zhihu.com", "path": "/" }
    ]
  }
}
```

### Sensitive (must be gitignored)

`config/cookies.secrets.local.json`

```json
[
  {
    "name": "z_c0",
    "value": "secret_cookie_value",
    "domain": ".zhihu.com",
    "path": "/"
  }
]
```

`config/notion.secrets.local.json`

```json
{
  "notionToken": "secret_xxx",
  "databaseId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

The following files are included as templates:

- `config/public.config.example.json`
- `config/cookies.secrets.local.example.json`
- `config/notion.secrets.local.example.json`

## Artifact Layout

Generated artifacts are organized under `artifacts/`:

- `artifacts/runtime/`: default base for CLI and GUI output artifacts such as `page.html`, `article.md`, `metadata.json`, and `notion-blocks.json`
- `artifacts/llm/sources/`: local source materials for LLM-assisted workflows
- `artifacts/llm/work/`: temporary LLM scratch space and intermediate runs
- `artifacts/llm/exports/`: user-facing LLM exports you may choose to keep or share

Local app state remains under `.local/`:

- `.local/gui/history/`: GUI input history
- `.local/gui/logs/`: GUI bridge logs

Use `.local/` for operational state only, not for user content artifacts.

### Secret path overrides via environment variables

Config file paths can be overridden:

- `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH`
- `ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH`
- `ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH`
- `ARTICLE_DOWNLOADER_COOKIEPROXY_PATH`

For config-aware commands, path precedence is:

- CLI flag (`--config` / `--cookies-secrets` / `--notion-secrets`)
- corresponding env variable
- default (for secrets paths only)

`--config` and `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH` are alternatives; at least one is required.

Secret values are never loaded from environment variables.

`pipeline.userAgent` is non-sensitive and controls the User-Agent header for both `verify-zhihu` and HTTP-based HTML download requests (`fetch`/`run`). If omitted, a built-in default browser UA is used.

`pipeline.downloadMethod` controls how HTML is downloaded:

- `http`: use the in-process `undici` fetcher
- `cookieproxy` (default): use the external `cookieproxy --url <url> --output <path>` command

`downloadMethod` can be set in two ways:

- `--download-method <http|cookieproxy>` on supported download commands
- `pipeline.downloadMethod` in `public.config.json`

Precedence is:

- CLI flag `--download-method`
- public config `pipeline.downloadMethod`
- built-in default `cookieproxy`

Both setting methods are optional on any given run.

`ARTICLE_DOWNLOADER_COOKIEPROXY_PATH` overrides the executable path for the `cookieproxy` method. If unset, runtime falls back to `/Users/lapdot/Documents/projects/runnable/cookieproxy`.

For the full contract around config precedence, cookie behavior, file errors, and CLI strictness, see `docs/policies/runtime-contract.md`.

## CLI usage

CLI output is JSON by default and currently the only supported output format.

### 1) Verify Zhihu cookies

```bash
npx tsx src/cli.ts verify-zhihu --config ./config/public.config.json
```

### 2) Fetch HTML

```bash
npx tsx src/cli.ts fetch \
  --url "https://zhuanlan.zhihu.com/p/123" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime
```

To use `http` instead, set `"pipeline.downloadMethod": "http"` in `config/public.config.json` or pass `--download-method http`.

When `downloadMethod` is `cookieproxy`, `fetch` does not require `--cookies-secrets`.

### 3) Extract Metadata From HTML

```bash
npx tsx src/cli.ts get_metadata --html ./artifacts/runtime/<run>/page.html --url "https://zhuanlan.zhihu.com/p/123" --out ./artifacts/runtime
```

### 4) Parse HTML to Markdown

```bash
npx tsx src/cli.ts parse --html ./artifacts/runtime/<run>/page.html --url "https://zhuanlan.zhihu.com/p/123" --out ./artifacts/runtime
```

`--use-html-style-for-image` is optional. By default, image output uses markdown style (`![](...)`).
Current recommendation: keep `--use-html-style-for-image` off for downstream compatibility.

For core output paths:
- `--out` is required for `fetch`, `get_metadata`, `parse`, `transform-notion`, and `run`.

### 5) Transform Markdown to Notion Blocks

```bash
npx tsx src/cli.ts transform-notion \
  --md ./artifacts/runtime/<run>/article.md \
  --out ./artifacts/runtime
```

This step produces the Notion format artifact: `notion-blocks.json`.

### 6) Upload Notion Blocks to Notion

```bash
npx tsx src/cli.ts upload-notion \
  --blocks ./artifacts/runtime/<transform-run>/notion-blocks.json \
  --config ./config/public.config.json \
  --notion-secrets ./config/notion.secrets.local.json
```

Upload is optional and downstream from artifact generation. The project’s “Notion format” refers to the generated Notion block JSON, not the upload itself.

### 7) End-to-end run

```bash
npx tsx src/cli.ts run \
  --url "https://zhuanlan.zhihu.com/p/123" \
  --config ./config/public.config.json \
  --download-method http \
  --cookies-secrets ./config/cookies.secrets.local.json \
  --notion-secrets ./config/notion.secrets.local.json \
  --out ./artifacts/runtime
```

`run` always executes the Notion upload stage after markdown generation.  
If Notion secrets are missing/invalid or the Notion API rejects the request, `run` ends with `ok: false` and reason `notion upload failed`.

### 8) Browse Local Path Entries (JSON)

```bash
npx tsx src/cli.ts browse-path --path .
```

Returns JSON with minimal entries:
- `name`
- `fullPath`
- `kind` (`file | dir | symlink | other`)

## GUI (V1 local-only)

V1 GUI runs on the same machine as the CLI. It provides command selection for existing CLI subcommands, per-argument input history, assistive path browsing, and streamed run output in the browser.

Start GUI:

```bash
npm run gui
```

Start bridge only (after build):

```bash
npm run build
npm run gui:build
npm run gui:server
```

Bridge server with user-controlled directories (recommended for sensitive data separation):

```bash
npm run gui:build
npm run gui:server -- \
  --workspace-dir=/secure/workspace \
  --history-dir=/secure/gui-history \
  --logs-dir=/secure/gui-logs \
  --output-dir=/secure/artifacts/runtime
```

GUI directory controls:
- `--workspace-dir`: working directory used by CLI subprocesses launched from GUI.
- `--history-dir`: where GUI history file is stored (`history.json`).
- `--logs-dir`: where GUI server log file is stored (`gui-server.log`).
- `--output-dir`: default output base injected for commands with `--out` when not explicitly set in form.

Open the GUI bridge endpoint:

```text
http://localhost:8787
```

For GUI development details, script entrypoints, bridge routes, and path-picker behavior, see:
- `docs/workflows/local-dev.md`
- `docs/policies/gui-contract.md`

## Cookie Secrets Format

Cookie secrets use list-only format:

```json
[
  {
    "name": "z_c0",
    "value": "secret_cookie_value",
    "domain": ".zhihu.com",
    "path": "/"
  }
]
```

## Public Cookie Field

Public cookie entries use `cookies.publicEntries`:

```json
{
  "cookies": {
    "publicEntries": [{ "name": "z_c0", "value": "cookie_value", "domain": ".zhihu.com", "path": "/" }]
  }
}
```

## Library API

```ts
import {
  verifyZhihuCookies,
  downloadHtml,
  parseHtmlToMarkdown,
  parseHtmlToMetadata,
  uploadNotionBlocksToNotion,
  markdownToNotionBlocks,
  runPipeline,
  resolveRuntimeConfig,
} from "article-downloader";
```

## Error codes

- `E_FILE_NOT_FOUND` (thrown for missing required files)
- `E_COOKIE_INVALID`
- `E_FETCH_HTTP`
- `E_PARSE_SELECTOR`
- `E_PARSE_UNSUPPORTED_SITE`
- `E_NOTION_API`

## Test

```bash
npm test
```

## Closed Test Loop

Use the closed loop when you need a local, sealed validation pass before adding features.

```bash
npm run test:closed-loop
```

For closed-loop guarantees and fixture-safety rules, see `docs/policies/testing-and-safety.md`.
