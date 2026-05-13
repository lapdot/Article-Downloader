# Runtime Contract

This document defines the current, authoritative runtime contract for ArticleDownloader.

If code and docs diverge, align code to this document unless a newer repo decision supersedes it.

## 1. Goals

### 1.1 Primary goals
- Keep execution intent explicit and predictable.
- Separate sensitive data from committable configuration.
- Fail clearly on contract violations.
- Preserve artifacts for debugging, even when final status is failure.

### 1.2 Non-goals
- Backward compatibility with removed legacy flags.
- Silent fallback behavior that hides missing required inputs.

## 2. Configuration And Secret Model

### 2.1 Separation of concerns
- Content inputs, configuration paths, and secret values are different classes of data and follow different rules.
- Public config and secret config are stored in separate files.
- Secret values are loaded from secret files, not from environment variable values.
- Environment variables are used for path selection, not secret payloads.
- When a required path cannot be resolved, the error must identify the missing key and the accepted sources for resolving it.

### 2.2 Public config path policy
- Public config path sources:
  - CLI: `--config`
  - Env: `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH`
- Precedence: CLI > env.
- If both are missing, fail with:
  - `missing public config path: provide --config or ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH`

### 2.3 Secret path policy
- Notion secret path sources:
  - CLI: `--notion-secrets`
  - Env: `ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH`
  - Default: `config/notion.secrets.local.json`
- Precedence: CLI > env > default.

### 2.4 Public runtime selector policy
- Public runtime selectors may be set by CLI override or by public config, depending on the field.
- `downloadMethod` is the project's first-class public runtime selector.
- Supported setting methods for `downloadMethod`:
  - CLI: `--download-method <cookieproxy>`
  - Public config: `public.config.json -> pipeline.downloadMethod`
- Precedence for `downloadMethod`:
  - CLI `--download-method`
  - public config `pipeline.downloadMethod`
  - built-in default `cookieproxy`
- The runtime intentionally keeps effective-method resolution even though the current concrete supported set contains only `cookieproxy`.
- `http` is no longer supported and must fail validation early when supplied through CLI, config, or bridge inputs.
- Method-dependent runtime behavior must always use the effective resolved value after precedence is applied.

### 2.5 Default local artifact layout
- The default runtime artifact base directory is `artifacts/runtime`.
- LLM-oriented local materials should live under `artifacts/llm/`.
- `.local/` is reserved for local operational state, not user content artifacts.
- Current user-visible artifact meanings are:
  - HTML format: fetched source page artifact (`page.html`)
  - PDF format: source-owned fetched PDF artifact for fetch-only PDF sources
  - Markdown format: parsed article artifact (`article.md`)
  - Notion format: generated Notion block artifact (`notion-blocks.json`)
- Current local operational state includes:
  - `.local/gui/history/`
  - `.local/gui/logs/`

## 3. Input Contract

### 3.1 Core content inputs are CLI-only
Core inputs are not read from config or env fallbacks:
- `run`, `fetch`: `--url`
- `get_metadata`, `parse`: `--html`, `--url`
- `transform-notion`: `--md`
- `upload-notion`: `--blocks`

### 3.2 Command flag strictness
- Each subcommand only accepts declared flags.
- Irrelevant flags fail as unknown options.

### 3.3 Env variable handling
- Unrelated env vars are ignored silently for commands that do not require them.
- No warning noise for ignored env vars.

### 3.4 Core output paths are CLI-only by default
Core output paths must be provided explicitly via CLI flags and are not read from config or env fallbacks by default.

Current core output path flags:
- `--out`:
  - `fetch`
  - `get_metadata`
  - `parse`
  - `transform-notion`
  - `run`

Exception policy:
- Exceptions are allowed only when there is concrete operational specialty.
- Any exception must be command-specific or flag-specific, explicitly approved, documented in both policy and README, and covered by tests.
- No broad implicit fallback track is allowed for core output paths.

Default-layout note:
- When public config does provide a default runtime output base via `pipeline.outDir`, the project default is `artifacts/runtime`.

### 3.5 Canonical source identity in runtime results
- Runtime stage results may include canonical source identity when the input URL can be resolved to a supported source.
- The identity shape is source-aware and uses:
  - `sourceId`
  - `contentType`
- Current canonical identities are:
  - Zhihu answer -> `sourceId: "zhihu"`, `contentType: "answer"`
  - Zhihu pin -> `sourceId: "zhihu"`, `contentType: "pin"`
  - Zhihu post (`zhuanlan.zhihu.com/p/...`) -> `sourceId: "zhihu"`, `contentType: "post"`
  - Substack post -> `sourceId: "substack"`, `contentType: "post"`
  - Foreign Affairs article page -> `sourceId: "foreignaffairs"`, `contentType: "post"`
  - Foreign Affairs podcast page -> `sourceId: "foreignaffairs"`, `contentType: "podcast"`
- Source identity is additional result context and does not change existing artifact meanings or stage failure semantics by itself.

## 4. Failure And Error Semantics

### 4.1 Missing-file policy
- Required file reads fail with:
  - `E_FILE_NOT_FOUND: <kind>: <path>`
- This applies only when the file is required by the active command flow.

### 4.2 Run pipeline and Notion policy
- `run` does not silently skip upload after markdown generation.
- `run` reaches upload stage and reports explicit failure when Notion cannot succeed:
  - missing notion setup
  - invalid notion credentials
  - Notion API failure
- On upload failure:
  - `ok: false`
  - `reason: "notion upload failed"`
- Artifacts are preserved for inspection and retry.

### 4.3 Requirement strictness follows stage criticality
- Requirement flags are not forced to be symmetric across dependencies.
- A dependency is upstream-critical if needed to start or produce core artifacts; it should be loaded fail-fast.
- A dependency is downstream-critical if needed only in later delivery stages; it may be validated at that stage and fail explicitly there.
- In this project:
  - Notion setup remains downstream-critical for `run`.

### 4.4 Download strategy policy
- `downloadMethod` is a first-class execution selector.
- The effective selector may come from CLI override, public config, or built-in default according to precedence rules.
- The current concrete supported method set is exactly `cookieproxy`.
- The project still preserves the effective-method resolution layer intentionally, because future methods may be added later under a new ADR.
- Under the current `cookieproxy` strategy, parser-stage source detection must not depend on redirect-normalized final URLs unless the fetch contract is explicitly extended to provide them.
- Substack aggregator URLs are a supported source-owned fetch-time normalization exception:
  - when `substack.com/@<author>/p-<id>` fetches a Substack reader shell instead of article HTML
  - runtime may derive the publication-host canonical article URL directly from preloaded shell data when the shell already contains a canonical post payload
  - otherwise runtime may derive the publication-host canonical article URL from the shell plus a Substack posts lookup
  - runtime may then re-fetch the canonical article page using the same effective download method
  - if the canonical page fetch fails but the preloaded shell payload or lookup payload includes sufficient article content, runtime may emit a synthetic parser-friendly article HTML artifact derived from that payload while still reporting the canonical article URL as `download.finalUrl`
  - when that normalization succeeds, `download.finalUrl` may differ from the original input URL even under `cookieproxy`
  - source-owned diagnostics may indicate whether normalization came from a preloaded canonical payload or a posts lookup flow
  - rationale for this current Substack-specific canonical policy lives in `docs/decisions/0004-substack-canonical-url-policy.md`
- Runtime requirement changes introduced by a new strategy must be reflected together in:
  - CLI and runtime behavior
  - GUI and wrapper behavior
  - tests
  - README
  - policy docs

### 4.5 Current named errors
- Current notable named errors include:
  - `E_FILE_NOT_FOUND`
  - `E_PARSE_SELECTOR`
  - `E_PARSE_UNSUPPORTED_SITE`
  - `E_NOTION_API`
- These identifiers are useful diagnostic surfaces, but they do not replace the command-level failure semantics defined above.

### 4.6 Foreign Affairs fetch-only PDF policy
- Foreign Affairs support is currently limited to the `fetch` command.
- `fetch` first downloads the HTML page through `cookieproxy`, then extracts an official PDF link under `/system/files/pdf/.../*.pdf`, then downloads that PDF through the same effective download method.
- The saved PDF artifact uses the basename from the official PDF URL, not a generic filename.
- If no PDF link is available, `fetch` fails with an actionable no-PDF reason while preserving `page.html` and `meta.json`.
- Metadata, Markdown parsing, Notion block generation, upload, and `run` are not implemented for Foreign Affairs.
- Deterministic tests cover representative Foreign Affairs HTML/PDF/no-PDF behavior with fake cookieproxy fixtures. Live verification against `foreignaffairs.com` is environment-dependent because it requires external network access and the relevant cookieproxy session state.

## 5. Runtime Debug Logging

### 5.1 Default mode
- Normal output is JSON results on stdout and error messages on stderr.
- Normal machine-readable output must stay concise and contract-stable for automation.
- Do not let normal machine-readable output get noisy over time.

### 5.2 Debug mode
- Runtime-config debug logs are gated by:
  - `ARTICLE_DOWNLOADER_DEBUG_CONFIG=1`
- Debug messages use `[runtime-config] ...` prefix.
- Extra diagnostic detail belongs behind explicit debug modes or log channels, not in default machine-readable output.

### 5.3 Redaction policy
- Runtime-produced artifacts and runtime diagnostics must not expose secret values or secret file paths.
- Redaction requirements apply even when a command fails after partial progress and leaves artifacts behind for debugging.

## 6. Change Governance

### 6.1 When changing runtime contract
- Update code, tests, and README together.
- Preserve clear error surfaces and deterministic behavior.

### 6.2 Backward-compatibility default
- Prefer strict, explicit contracts unless compatibility is explicitly requested and documented.
