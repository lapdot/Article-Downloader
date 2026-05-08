# Fixture Capture Workflow

This document describes the canonical fixture workflows for ArticleDownloader.

For authoritative rules, use `docs/policies/testing-and-safety.md`.

## Ingest Existing HTML

Use `ingest` when you already have HTML and want to sanitize it into tracked fixtures.

```bash
npx tsx src/cli.ts ingest \
  --html ./output/<run>/page.html \
  --source-url "https://zhuanlan.zhihu.com/p/123" \
  --fixture zhihu-zhuanlan-new \
  --out-fixtures-dir ./tests/fixtures
```

Behavior:
- HTML-only in V1
- offline by design
- rejects `--url` input mode with `E_INGEST_UNSUPPORTED_INPUT`

Recommended two-step flow for authenticated pages:

1. Collect HTML with `fetch` or `run`
2. Sanitize and generate tracked fixtures with `ingest --html ...`

Artifacts:
- raw local archive: `.local/raw-imports/<timestamp>-<fixture>/raw.html`
- sanitized fixture: `tests/fixtures/<fixture>.html`
- sanitization map: `tests/fixtures/<fixture>.map.json`

## Capture Fixture End To End

Use `capture-fixture` for the canonical fetch-first, sanitize-second flow.

```bash
npx tsx src/cli.ts capture-fixture \
  --url "https://zhuanlan.zhihu.com/p/123" \
  --fixture zhihu-zhuanlan-new \
  --out ./output \
  --out-fixtures-dir ./tests/fixtures \
  --config ./config/public.config.json \
  --download-method http \
  --cookies-secrets ./config/cookies.secrets.local.json
```

Flow:
1. Fetch HTML using the selected download method
2. Sanitize through the ingest policy
3. Copy sanitized artifacts into the fetch run directory for traceability

When `downloadMethod` is `cookieproxy`, `capture-fixture` does not require `--cookies-secrets`.

Artifacts produced:
- fetch raw HTML: `output/<run>/page.html`
- ingest raw archive: `.local/raw-imports/<timestamp>-<fixture>/raw.html`
- canonical fixture artifacts: `tests/fixtures/<fixture>.html`, `tests/fixtures/<fixture>.map.json`
- linked copies: `output/<run>/ingest/<fixture>.html`, `output/<run>/ingest/<fixture>.map.json`

Failure semantics:
- fetch failure stops before ingest
- ingest failure returns non-zero and preserves fetch artifacts for inspection
