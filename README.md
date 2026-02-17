# ArticleDownloader

A Node.js (TypeScript + ESM) project for downloading article pages, parsing them into Markdown, and uploading to Notion.

## Features

- Verify Zhihu cookies by checking `https://www.zhihu.com/settings/account`:
  - `200` means valid login session.
  - `301/302` means cookies are invalid or expired.
  - other status codes are treated as network/other issues.
- Download webpage HTML with URL-aware cookie handling.
- Parse Zhihu HTML to Markdown using hardcoded selectors for:
  - answer (`/question/.../answer/...`)
  - pin idea (`/pin/...`)
  - zhuanlan article (`zhuanlan.zhihu.com/p/...`)
- Upload Markdown to a Notion database as a new page with rich content blocks.
- Run end-to-end pipeline from URL to local artifacts and optional Notion upload.

## Requirements

- Node.js `>=20`
- npm

## Install

```bash
npm install
```

## Config Model

Configuration is split into non-sensitive and sensitive files.

### Non-sensitive (committable)

`config/public.config.json`

```json
{
  "pipeline": {
    "outDir": "output",
    "useHtmlStyleForImage": false,
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
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

### Secret path overrides via environment variables

Config file paths can be overridden:

- `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH`
- `ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH`
- `ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH`

For config-aware commands, path precedence is:

- CLI flag (`--config` / `--cookies-secrets` / `--notion-secrets`)
- corresponding env variable
- default (for secrets paths only)

`--config` and `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH` are alternatives; at least one is required.

Secret values are never loaded from environment variables.

`pipeline.userAgent` is non-sensitive and controls the User-Agent header for both `verify-zhihu` and HTML download requests (`fetch`/`run`). If omitted, a built-in default browser UA is used.

Notion upload is command-driven (for example `upload-notion`), not controlled by a public config toggle.

Cookies now follow a merge-only storage model:

- `public.config.json -> cookies.publicEntries` and `cookies.secrets.local.json` are both cookie arrays.
- Runtime merges the two arrays directly.
- Runtime does not classify cookies as public vs secret.
- If the same normalized cookie tuple (`name|domain|path`) appears in both sources, runtime fails with a duplicate conflict error.

### File Error Behavior

Required file reads fail fast with a unified error format:

- `E_FILE_NOT_FOUND: <kind>: <path>`

This applies to:

- public config (`--config`)
- cookies secrets (`--cookies-secrets`, env override, or default path) when cookies are required
- notion secrets (`--notion-secrets`, env override, or default path) when notion is required
- CLI input files (`--html`, `--md`, `--blocks`)

### Input Contract

Each subcommand accepts only its declared flags. Irrelevant flags fail fast as unknown options.

Unrelated secret-path environment variables are ignored by commands that do not need them.

Examples:

- `verify-zhihu` ignores `ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH`.
- `upload-notion` ignores `ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH`.

### Core Inputs Are CLI-Only

Core content inputs always come from CLI parameters and are never read from env vars or config files:

- `run`: `--url`
- `fetch`: `--url`
- `get_metadata`: `--html`, `--url`
- `parse`: `--html`, `--url`
- `transform-notion`: `--md`
- `upload-notion`: `--blocks`

### Roadmap Note

Future versions may add env-variable support for non-core public configuration parts, but core inputs and explicit `--config` remain mandatory for CLI execution.

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
  --config ./config/public.config.json
```

### 3) Extract Metadata From HTML

```bash
npx tsx src/cli.ts get_metadata --html ./output/<run>/page.html --url "https://zhuanlan.zhihu.com/p/123" --out ./output
```

### 4) Parse HTML to Markdown

```bash
npx tsx src/cli.ts parse --html ./output/<run>/page.html --url "https://zhuanlan.zhihu.com/p/123" --out ./output --use-html-style-for-image
```

`--use-html-style-for-image` is optional. By default, image output uses markdown style (`![](...)`).

### 5) Transform Markdown to Notion Blocks

```bash
npx tsx src/cli.ts transform-notion \
  --md ./output/<run>/article.md \
  --out ./output
```

### 6) Upload Notion Blocks to Notion

```bash
npx tsx src/cli.ts upload-notion \
  --blocks ./output/<transform-run>/notion-blocks.json \
  --config ./config/public.config.json \
  --notion-secrets ./config/notion.secrets.local.json
```

### 7) End-to-end run

```bash
npx tsx src/cli.ts run \
  --url "https://zhuanlan.zhihu.com/p/123" \
  --config ./config/public.config.json \
  --cookies-secrets ./config/cookies.secrets.local.json \
  --notion-secrets ./config/notion.secrets.local.json
```

`run` always executes the Notion upload stage after markdown generation.  
If Notion secrets are missing/invalid or the Notion API rejects the request, `run` ends with `ok: false` and reason `notion upload failed`.

Shortcut with fixed defaults (only URL changes):

```bash
npm run run:url -- "https://zhuanlan.zhihu.com/p/123"
```

`run` writes:

- `page.html`
- `metadata.json`
- `article.md`
- `meta.json`

inside `output/<YYYYMMDD-HHmmss>-<slug>/`.

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

This command enforces:
- localhost-only network calls during tests (external hosts are blocked)
- preflight checks for obvious secret leaks in env vars and fixtures
- full test suite execution with existing redaction/upload behavior checks
- test URL sanitization policy: keep safe generic endpoints (for example `/settings/account`) and sanitize long Zhihu content IDs with deterministic placeholders

If it fails, treat it as a safety gate:
- network-guard failures mean a test attempted external access
- preflight/fixture failures mean sensitive-looking data was detected
- redaction failures mean runtime artifacts may expose secrets/secret paths

Future note: the loop may split into `closed-loop:required` and `closed-loop:full` when the suite grows.
