# ArticleDownloader

This README is the top-level human-first onboarding and quickstart entrypoint for ArticleDownloader.

ArticleDownloader is a Node.js (TypeScript + ESM) project for turning article URLs into local HTML, Markdown, metadata, and Notion-block artifacts, with optional downstream upload to Notion.

## Features

- Generate reviewable local artifacts from a URL:
  - fetched source HTML (`page.html`)
  - extracted metadata (`metadata.json`)
  - parsed Markdown (`article.md`)
  - generated Notion block JSON (`notion-blocks.json`)
- Download through the current `cookieproxy` transport.
- Parse supported Zhihu and Substack article URLs with source-specific adapters.
- Fetch official PDFs from Foreign Affairs and Foreign Policy article pages. These sources are fetch-only.
- Fetch public YouTube transcripts into readable Markdown through the `youtube-transcript` command.
- Optionally upload generated Notion blocks to a Notion database.

## Requirements

- Node.js `>=20`
- npm
- Optional for YouTube transcripts: Python 3 with `youtube-transcript-api`

## Install

```bash
npm install
```

For YouTube transcript support, install the Python helper dependency:

```bash
python3 -m pip install -r requirements-youtube-transcript.txt
```

## Quickstart

Prepare these local config files first:

- public config: `config/public.config.json`
- optional Notion secrets for upload flows: `config/notion.secrets.local.json`
- templates:
  - `config/public.config.example.json`
  - `config/notion.secrets.local.example.json`

Typical local-artifacts-first flow:

```bash
npx tsx src/cli.ts fetch \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime

npx tsx src/cli.ts get_metadata \
  --html ./artifacts/runtime/<run>/page.html \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --out ./artifacts/runtime

npx tsx src/cli.ts parse \
  --html ./artifacts/runtime/<run>/page.html \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --out ./artifacts/runtime

npx tsx src/cli.ts transform-notion \
  --md ./artifacts/runtime/<run>/article.md \
  --out ./artifacts/runtime
```

Typical artifacts:

- HTML: `artifacts/runtime/<run>/page.html`
- metadata: `artifacts/runtime/<run>/metadata.json`
- Markdown: `artifacts/runtime/<run>/article.md`
- Notion blocks: `artifacts/runtime/<transform-run>/notion-blocks.json`

Foreign Affairs and Foreign Policy fetch flows write `page.html`, the official PDF, and `meta.json`; Markdown, metadata, Notion transform, and `run` are not supported for these fetch-only PDF sources. Foreign Affairs uses the official PDF filename linked from the HTML, such as `105301.pdf`; Foreign Policy generates the PDF URL from the article URL and saves a slug filename such as `trump-china-hawk-xi-jinping-covid.pdf`.

The automated suite covers the current fetch-only PDF scenarios with deterministic cookieproxy fixtures. Live verification against `foreignaffairs.com` or `foreignpolicy.com` still requires a working cookieproxy session with the needed site access.

YouTube transcript flow:

```bash
npx tsx src/cli.ts youtube-transcript \
  --url "https://www.youtube.com/watch?v=cg6MD07Vz6U" \
  --out ./artifacts/runtime
```

The Node.js CLI uses English transcripts, plain text formatting, and `python3` internally.

Expected artifacts:

- Markdown transcript: `artifacts/runtime/<run>/transcript.md`
- structured transcript snippets: `artifacts/runtime/<run>/transcript.json`
- run metadata: `artifacts/runtime/<run>/meta.json`

Markdown transcript entries are timestamped:

```md
- [00:00:00.000 - 00:00:01.200] Hello from the video.
- [00:00:01.200 - 00:00:03.600] This is the transcript.
```

For command-by-command usage, see `docs/reference/cli-usage.md`.

## Validation

Run the default test suite:

```bash
npm test
```

Run the stricter closed test loop:

```bash
npm run test:closed-loop
```

For validation expectations and safety rules, see `docs/policies/testing-and-safety.md`.

## Documentation Map

- agent-first repository context: `CONTEXT.md`
- portable agent guide: `AGENTS.md`
- docs index: `docs/README.md`
- tracked experiments: `experiments/README.md`
- CLI command reference: `docs/reference/cli-usage.md`
- environment variables: `docs/reference/environment-variables.md`
- library API reference: `docs/reference/library-api.md`
- URL-to-artifacts workflow: `docs/workflows/url-driven-iteration.md`
- local development and GUI workflow: `docs/workflows/local-dev.md`
- source onboarding workflow: `docs/workflows/add-a-new-source.md`
- runtime contract: `docs/policies/runtime-contract.md`
- testing and safety policy: `docs/policies/testing-and-safety.md`
- GUI contract: `docs/policies/gui-contract.md`
- architecture overview: `docs/architecture/overview.md`
- decision records: `docs/decisions/`
