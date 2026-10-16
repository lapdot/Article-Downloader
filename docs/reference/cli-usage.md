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
- Experimental author deduction is disabled by default. Enable it through public config under `experimental.author` and provide an author whitelist path.

## `fetch`

Fetch a supported source URL and write fetch-stage artifacts.

```bash
npx tsx src/cli.ts fetch \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime
```

Expected artifacts:

- `artifacts/runtime/<run>/page.html`
- `artifacts/runtime/<run>/meta.json`

Fetch-only PDF sources write `page.html`, one official PDF, and `meta.json`. Downstream metadata, Markdown, Notion transform, and `run` flows are not supported for these sources.

Foreign Affairs discovers the official PDF link from the fetched HTML page:

```bash
npx tsx src/cli.ts fetch \
  --url "https://www.foreignaffairs.com/iran/real-war-irans-future-islamic-republic" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime
```

Expected Foreign Affairs artifacts:

- `artifacts/runtime/<run>/page.html`
- `artifacts/runtime/<run>/<official-pdf-filename>.pdf`
- `artifacts/runtime/<run>/meta.json`

Known Foreign Affairs fetch outcomes covered by deterministic tests:

- Magazine article: `https://www.foreignaffairs.com/iran/real-war-irans-future-islamic-republic` saves `105301.pdf`.
- Non-magazine article: `https://www.foreignaffairs.com/middle-east/dangers-weak-iran` saves `the-dangers-of-a-weak-iran-2026-03-12-10-17.pdf`.
- Podcast: `https://www.foreignaffairs.com/podcasts/irans-tenacious-regime-and-future-gulf` fails with `no available pdf for foreignaffairs. maybe contentType is podcast.`

Podcast pages, and other pages where no official PDF link is available, fail at the fetch stage while preserving `page.html` and `meta.json`. Live checks against `foreignaffairs.com` depend on cookieproxy access and are not part of the closed-loop test suite.

Foreign Policy verifies the article HTML first, then downloads the official PDF by adding `?download_pdf=true` to the article URL:

```bash
npx tsx src/cli.ts fetch \
  --url "https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid/" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime
```

Expected Foreign Policy artifacts:

- `artifacts/runtime/<run>/page.html`
- `artifacts/runtime/<run>/trump-china-hawk-xi-jinping-covid.pdf`
- `artifacts/runtime/<run>/meta.json`

Live checks against `foreignpolicy.com` depend on cookieproxy access and are not part of the closed-loop test suite.

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
  --out ./artifacts/runtime \
  --source-url https://example.com/article
```

Expected artifact:

- `artifacts/runtime/<transform-run>/notion-blocks.json`

Current note: dollar-delimited inline Markdown spans are preserved as inline equations in Notion block output. See `../decisions/0005-inline-equation-markdown-policy.md`.

Relative Markdown links, including fragment-only links such as footnote anchors, are resolved against `--source-url` because Notion rich text links require absolute URLs. When no source URL is provided, invalid relative link annotations are removed while the visible link text is preserved.

## `youtube-transcript`

Fetch a public YouTube transcript and write readable Markdown plus structured transcript snippets.

```bash
npx tsx src/cli.ts youtube-transcript \
  --url "https://www.youtube.com/watch?v=cg6MD07Vz6U" \
  --out ./artifacts/runtime
```

The Node.js-facing command intentionally exposes no transcript selection options.
It uses English transcripts, plain text formatting, and the uv-managed Python
environment internally.

Expected artifacts:

- `artifacts/runtime/<run>/transcript.md`
- `artifacts/runtime/<run>/transcript.json`
- `artifacts/runtime/<run>/meta.json`

`transcript.md` keeps one timestamped bullet per transcript snippet:

```md
# YouTube Transcript: cg6MD07Vz6U

- Source URL: https://www.youtube.com/watch?v=cg6MD07Vz6U
- Video ID: cg6MD07Vz6U
- Language: English (en)
- Transcript type: auto-generated
- Snippets: 2
- Fetched at: 2026-05-26T12:00:00+00:00

## Transcript

- [00:00:00.000 - 00:00:01.200] Hello from the video.
- [00:00:01.200 - 00:00:03.600] This is the transcript.
```

This command uses the production Python helper at `scripts/youtube_transcript_fetcher.py`, which depends on `youtube-transcript-api`. Install the uv-managed Python environment with:

```bash
uv sync
```

Then run the command normally. The TypeScript runtime invokes the Python helper
through `uv run python`.

```bash
npx tsx src/cli.ts youtube-transcript \
  --url "https://www.youtube.com/watch?v=cg6MD07Vz6U" \
  --out ./artifacts/runtime
```

The Python helper's direct-debug interface is preserved separately from the
Node.js CLI.

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
- When `experimental.author.enabled` and `experimental.author.notionUpload.enabled` are both true, `run` may set a Notion multi-select page property from a whitelisted metadata author. The default property name is `Author`; the target Notion database must already have a matching multi-select property.

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
