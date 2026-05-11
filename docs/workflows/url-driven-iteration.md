# URL-Driven Iteration Workflow

This document describes the primary working loop for ArticleDownloader.

Use this workflow when you want to start from a URL, generate all supported local formats, inspect the results, identify flaws, and refine the system iteratively.

For authoritative contracts, use:
- `docs/policies/runtime-contract.md`
- `docs/policies/testing-and-safety.md`
- `docs/policies/gui-contract.md`

## Goal

Turn one source URL into reviewable local artifacts:

- HTML format: fetched source page (`page.html`)
- metadata: extracted article metadata (`metadata.json`)
- Markdown format: parsed article body (`article.md`)
- Notion format: generated Notion block JSON (`notion-blocks.json`)

Notion upload is optional and is not part of the definition of “Notion format” in this workflow.

## Default Artifact Layout

- Runtime outputs: `artifacts/runtime/`
- LLM input materials: `artifacts/llm/sources/`
- LLM scratch and intermediate materials: `artifacts/llm/work/`
- LLM final exports: `artifacts/llm/exports/`
- GUI operational state: `.local/gui/history/` and `.local/gui/logs/`

## Core Loop

1. Start from a URL.
2. Fetch HTML.
3. Parse the fetched HTML into metadata and Markdown.
4. Transform Markdown into Notion block JSON.
5. Compare the generated outputs.
6. Identify the flaw by stage.
7. Refine the relevant fetch, parser, or Notion-transform behavior.
8. Regenerate and repeat until the artifacts are acceptable.

## Command Sequence

### 1. Fetch HTML

```bash
npx tsx src/cli.ts fetch \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --config ./config/public.config.json \
  --out ./artifacts/runtime
```

Expected artifact:
- `artifacts/runtime/<run>/page.html`

### 2. Extract Metadata

```bash
npx tsx src/cli.ts get_metadata \
  --html ./artifacts/runtime/<run>/page.html \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --out ./artifacts/runtime
```

Expected artifact:
- `artifacts/runtime/<run>/metadata.json`

### 3. Parse Markdown

```bash
npx tsx src/cli.ts parse \
  --html ./artifacts/runtime/<run>/page.html \
  --url "https://substack.com/@michaeljburry/p-196918166" \
  --out ./artifacts/runtime
```

Expected artifact:
- `artifacts/runtime/<run>/article.md`

### 4. Transform Notion Blocks

```bash
npx tsx src/cli.ts transform-notion \
  --md ./artifacts/runtime/<run>/article.md \
  --out ./artifacts/runtime
```

Expected artifact:
- `artifacts/runtime/<transform-run>/notion-blocks.json`

### 5. Optional Upload

```bash
npx tsx src/cli.ts upload-notion \
  --blocks ./artifacts/runtime/<transform-run>/notion-blocks.json \
  --config ./config/public.config.json \
  --notion-secrets ./config/notion.secrets.local.json
```

Use upload only after the local Notion block artifact looks correct.

## How To Review Outputs

- Inspect HTML when you need to know what was actually fetched from the source site.
- Inspect Markdown when you need to judge article structure, headings, links, text cleanup, image rendering, and parser fidelity.
- Inspect Notion blocks when Markdown is already acceptable but the Notion representation is wrong or incomplete.

## Troubleshooting By Stage

- HTML wrong or incomplete:
  - treat it as a fetch-stage issue
  - inspect `page.html`, cookie handling, download strategy, and any source-owned normalization behavior

- Markdown wrong but HTML correct:
  - treat it as a parser-stage issue
  - inspect selectors, cleanup rules, and Markdown conversion behavior

- Markdown correct but Notion wrong:
  - treat it as a Notion-transform issue
  - inspect Markdown-to-block conversion behavior and Notion artifact output

## Environment Troubleshooting

- Some sandboxed environments may fail DNS resolution for external hosts such as `substack.com`.
- In this failure mode, `cookieproxy` may surface an error like `getaddrinfo ENOTFOUND substack.com`.
- Treat this as an environment issue, not as a reason to change the runtime's default fetch strategy.
- When this happens during development, keep `cookieproxy` as the default method and retry the same `cookieproxy` flow outside the sandbox instead of switching the runtime to another download method.

## Notes

- Keep `--out` explicit when you want strong control over where artifacts are written.
- Use the same fetched `page.html` across metadata and parse steps when debugging parser behavior.
- Preserve local generated artifacts while iterating so you can compare outputs across revisions.
- Internally, source-aware debugging should use the canonical `sourceId/contentType` identity pair rather than assuming content labels such as `post` mean the same thing across sources.
- When using the default `cookieproxy` download flow, parser source detection still accepts both Substack URL families directly. For aggregator URLs like `substack.com/@<author>/p-<id>`, the Substack source adapter may normalize the fetched shell to the publication-host canonical URL before metadata and markdown parsing.
- In newer Substack reader shells, normalization may come directly from a preloaded canonical post payload inside the fetched HTML rather than a separate posts lookup.
- If the canonical page cannot be fetched but the preloaded shell payload or posts lookup returned enough article content, runtime may continue with a synthetic article HTML artifact rather than the reader shell.
