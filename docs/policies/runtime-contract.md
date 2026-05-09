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
- Public config and secret config are stored in separate files.
- Secret values are loaded from secret files, not from environment variable values.
- Environment variables are used for path selection, not secret payloads.

### 2.2 Public config path policy
- Public config path sources:
  - CLI: `--config`
  - Env: `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH`
- Precedence: CLI > env.
- If both are missing, fail with:
  - `missing public config path: provide --config or ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH`

### 2.3 Secret path policy
- Cookie secret path sources:
  - CLI: `--cookies-secrets`
  - Env: `ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH`
  - Default: `config/cookies.secrets.local.json`
- Notion secret path sources:
  - CLI: `--notion-secrets`
  - Env: `ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH`
  - Default: `config/notion.secrets.local.json`
- Precedence for both: CLI > env > default.

### 2.4 Public runtime selector policy
- Public runtime selectors may be set by CLI override or by public config, depending on the field.
- `downloadMethod` is the project's first-class public runtime selector.
- Supported setting methods for `downloadMethod`:
  - CLI: `--download-method <http|cookieproxy>`
  - Public config: `public.config.json -> pipeline.downloadMethod`
- Precedence for `downloadMethod`:
  - CLI `--download-method`
  - public config `pipeline.downloadMethod`
  - built-in default `cookieproxy`
- Strategy-dependent runtime behavior must always use the effective resolved value after precedence is applied.

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

## 4. Cookie Contract

### 4.1 Merge-only cookie model
- Public cookie source: `public.config.json -> cookies.publicEntries`
- Secret cookie source: `cookies.secrets.local.json` in array format
- Runtime behavior: merge both arrays directly.

### 4.2 Classification rule
- Runtime does not classify cookies as public vs secret.
- Split is for storage and operational separation only.

### 4.3 Identity and conflict rule
- Cookie identity tuple: `name|normalizedDomain|normalizedPath`
- Duplicate tuple is an error:
  - across public and secrets sources
  - within a single source

### 4.4 Empty cookie behavior
- Empty merged cookie list is allowed.

## 5. Failure And Error Semantics

### 5.1 Missing-file policy
- Required file reads fail with:
  - `E_FILE_NOT_FOUND: <kind>: <path>`
- This applies only when the file is required by the active command flow.

### 5.2 Cookie validation policy
- Invalid cookie shapes fail with:
  - `E_COOKIE_INVALID: ...detailed reason...`
- Validation diagnostics are emitted as `[validateCookies] ...`.

### 5.3 Run pipeline and Notion policy
- `run` does not silently skip upload after markdown generation.
- `run` reaches upload stage and reports explicit failure when Notion cannot succeed:
  - missing notion setup
  - invalid notion credentials
  - Notion API failure
- On upload failure:
  - `ok: false`
  - `reason: "notion upload failed"`
- Artifacts are preserved for inspection and retry.

### 5.4 Requirement strictness follows stage criticality
- Requirement flags are not forced to be symmetric across dependencies.
- A dependency is upstream-critical if needed to start or produce core artifacts; it should be loaded fail-fast.
- A dependency is downstream-critical if needed only in later delivery stages; it may be validated at that stage and fail explicitly there.
- Requirement strictness may also depend on the selected download strategy.
- In this project:
  - `verify-zhihu` remains cookie-required.
  - `fetch` requires cookies only when effective `pipeline.downloadMethod` is `http`.
  - `fetch` does not require cookies when effective `pipeline.downloadMethod` is `cookieproxy`.
  - `run` does not perform Zhihu cookie verification before download.
  - Notion setup remains downstream-critical for `run`.

### 5.5 Download strategy policy
- `downloadMethod` is a first-class execution selector.
- The effective selector may come from CLI override, public config, or built-in default according to precedence rules.
- Method-dependent prerequisites must be decided from the effective resolved runtime value.
- Runtime requirement changes introduced by a new strategy must be reflected together in:
  - CLI and runtime behavior
  - GUI and wrapper behavior
  - tests
  - README
  - policy docs

## 6. Runtime Debug Logging

### 6.1 Default mode
- Normal output is JSON results on stdout and error messages on stderr.

### 6.2 Debug mode
- Runtime-config debug logs are gated by:
  - `ARTICLE_DOWNLOADER_DEBUG_CONFIG=1`
- Debug messages use `[runtime-config] ...` prefix.

## 7. Change Governance

### 7.1 When changing runtime contract
- Update code, tests, and README together.
- Preserve clear error surfaces and deterministic behavior.

### 7.2 Backward-compatibility default
- Prefer strict, explicit contracts unless compatibility is explicitly requested and documented.
