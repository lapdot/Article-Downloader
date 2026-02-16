# ArticleDownloader

A Node.js (TypeScript + ESM) project for downloading article pages, parsing them into Markdown, and uploading to Notion.

## Features

- Verify Zhihu cookies by checking `https://www.zhihu.com/settings/account`:
  - `200` means valid login session.
  - `301/302` means cookies are invalid or expired.
  - other status codes are treated as network/other issues.
- Download webpage HTML with a JSON cookie array.
- Parse Zhihu HTML to Markdown using hardcoded selectors for:
  - answer (`/question/.../answer/...`)
  - pin idea (`/pin/...`)
  - zhuanlan article (`zhuanlan.zhihu.com/p/...`)
- Upload Markdown to a Notion database as a new page with rich content blocks.
  - Includes markdown-to-Notion transformer:
    - `martian` (via `@tryfabric/martian`)
- Run end-to-end pipeline from URL to local artifacts and optional Notion upload.

## Requirements

- Node.js `>=20`
- npm

## Install

```bash
npm install
```

## Cookie file format

`cookies.json`:

```json
[
  { "name": "z_c0", "value": "..." },
  { "name": "d_c0", "value": "..." }
]
```

Cookie handling uses RFC-style matching via `tough-cookie`:
- Headers are resolved per request URL (domain/path/secure/expiry aware).
- Duplicate cookie names are handled by cookie matching rules instead of naive string concatenation.

## CLI usage

### 1) Verify Zhihu cookies

```bash
npx tsx src/cli.ts verify-zhihu --cookies ./cookies.json --json
```

### 2) Fetch HTML

```bash
npx tsx src/cli.ts fetch --url "https://zhuanlan.zhihu.com/p/123" --cookies ./cookies.json --out ./output --json
```

### 3a) Extract Metadata From HTML

```bash
npx tsx src/cli.ts get_metadata --html ./output/<run>/page.html --url "https://zhuanlan.zhihu.com/p/123" --out ./output --json
```

### 3b) Parse HTML to Markdown

```bash
npx tsx src/cli.ts parse --html ./output/<run>/page.html --url "https://zhuanlan.zhihu.com/p/123" --out ./output --use-html-style-for-image --json
```

`--use-html-style-for-image` is optional. By default, image output uses markdown style (`![](...)`).

### 4a) Transform Markdown to Notion Blocks

```bash
npx tsx src/cli.ts transform-notion \
  --md ./output/<run>/article.md \
  --out ./output \
  --json
```

### 4b) Upload Notion Blocks to Notion

```bash
npx tsx src/cli.ts upload-notion \
  --blocks ./output/<transform-run>/notion-blocks.json \
  --title "Article title" \
  --source-url "https://zhuanlan.zhihu.com/p/123" \
  --fetched-at "2026-02-15T00:00:00.000Z" \
  --notion-config ./notion.config.json \
  --json
```

### 5) End-to-end run

```bash
npx tsx src/cli.ts run \
  --url "https://zhuanlan.zhihu.com/p/123" \
  --cookies ./cookies.json \
  --out ./output \
  --use-html-style-for-image \
  --notion-config ./notion.config.json \
  --json
```

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

## Notion config file

Provide Notion constants via a JSON file path passed by user (`--notion-config`).

Example `notion.config.json`:

```json
{
  "notionToken": "secret_xxx",
  "databaseId": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
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
} from "article-downloader";
```

## Error codes

- `E_COOKIE_INVALID`
- `E_FETCH_HTTP`
- `E_PARSE_SELECTOR`
- `E_PARSE_UNSUPPORTED_SITE`
- `E_NOTION_API`

## Test

```bash
npm test
```
