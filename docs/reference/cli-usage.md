# CLI Usage

This document is the command-by-command CLI reference for ArticleDownloader.

CLI output is JSON by default and currently the only supported output format.

For the broader URL-to-artifacts iteration loop, see `../workflows/url-driven-iteration.md`.

For authoritative rules about config precedence, required flags, output-path policy, failure semantics, and `downloadMethod`, see `../policies/runtime-contract.md`.

## Common Notes

- Core output paths use `--out` on:
  - `fetch`
  - `get_metadata`
  - `parse`
  - `transform-notion`
  - `run`
- `pipeline.downloadMethod` currently supports only `cookieproxy`.
- Current recommendation: keep `--use-html-style-for-image` off for downstream compatibility.

## `fetch`

Fetch HTML for a supported source URL and write `page.html` plus fetch metadata.

```bash
npx tsx src/cli.ts fetch \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime
```

Expected artifacts:

- `artifacts/runtime/<run>/page.html`
- `artifacts/runtime/<run>/meta.json`

## `get_metadata`

Extract article metadata from previously fetched HTML.

```bash
npx tsx src/cli.ts get_metadata \
  --html ./artifacts/runtime/<run>/page.html \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --out ./artifacts/runtime
```

Expected artifacts:

- `artifacts/runtime/<run>/metadata.json`
- `artifacts/runtime/<run>/meta.json`

## `parse`

Parse fetched HTML into Markdown.

```bash
npx tsx src/cli.ts parse \
  --html ./artifacts/runtime/<run>/page.html \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --out ./artifacts/runtime
```

Optional flag:

- `--use-html-style-for-image`: use HTML `<img>` output instead of Markdown image syntax

Expected artifacts:

- `artifacts/runtime/<run>/article.md`
- `artifacts/runtime/<run>/meta.json`

## `transform-notion`

Transform Markdown into Notion block JSON.

```bash
npx tsx src/cli.ts transform-notion \
  --md ./artifacts/runtime/<run>/article.md \
  --out ./artifacts/runtime
```

Expected artifact:

- `artifacts/runtime/<transform-run>/notion-blocks.json`

Current note: dollar-delimited inline Markdown spans are preserved as inline equations in Notion block output. See `../decisions/0005-inline-equation-markdown-policy.md`.

## `upload-notion`

Upload generated Notion blocks to a Notion database.

```bash
npx tsx src/cli.ts upload-notion \
  --blocks ./artifacts/runtime/<transform-run>/notion-blocks.json \
  --config ./config/public.config.json \
  --notion-secrets ./config/notion.secrets.local.json
```

Upload is optional and downstream from artifact generation. The project's "Notion format" refers to generated Notion block JSON, not the upload itself.

## `run`

Run the end-to-end pipeline from URL to local artifacts and Notion upload.

```bash
npx tsx src/cli.ts run \
  --url "https://zhuanlan.zhihu.com/p/123" \
  --config ./config/public.config.json \
  --download-method cookieproxy \
  --notion-secrets ./config/notion.secrets.local.json \
  --out ./artifacts/runtime
```

Behavior notes:

- `run` always executes the Notion upload stage after Markdown generation.
- If Notion secrets are missing or invalid, or the Notion API rejects the request, `run` ends with `ok: false` and reason `notion upload failed`.
- Artifacts are preserved for inspection and retry when downstream upload fails.

## `browse-path`

Browse local path entries and return minimal JSON metadata.

```bash
npx tsx src/cli.ts browse-path --path .
```

Returned fields:

- `name`
- `fullPath`
- `kind` (`file | dir | symlink | other`)

## Related Docs

- `../workflows/url-driven-iteration.md`
- `../workflows/local-dev.md`
- `../policies/runtime-contract.md`
- `../policies/gui-contract.md`
