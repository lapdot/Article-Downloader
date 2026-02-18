# Project Policies

This document defines the current, authoritative policies for configuration, runtime behavior, CLI contract, and testing.
If code and docs diverge, align code to these policies unless a newer decision supersedes this file.

## 1. Policy Goals

### 1.1 Primary goals
- Keep execution intent explicit and predictable.
- Separate sensitive data from committable configuration.
- Fail clearly on contract violations.
- Preserve artifacts for debugging, even when final status is failure.

### 1.2 Non-goals
- Backward compatibility with removed legacy flags.
- Silent fallback behavior that hides missing required inputs.

## 2. Configuration and Secret Model

### 2.1 Separation of concerns
- Public config and secret config are stored in separate files.
- Secret values are loaded from secret files, not from environment variable values.
- Environment variables are used for **path selection**, not secret payloads.

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
- Precedence (both): CLI > env > default.

## 3. Input Contract

### 3.1 Core content inputs are CLI-only
Core inputs are not read from config/env fallbacks:
- `run`, `fetch`: `--url`
- `get_metadata`, `parse`: `--html`, `--url`
- `transform-notion`: `--md`
- `upload-notion`: `--blocks`
- `ingest`: `--html`, `--source-url`, `--fixture`
- `capture-fixture`: `--url`, `--fixture`

### 3.2 Command flag strictness
- Each subcommand only accepts declared flags.
- Irrelevant flags fail as unknown options.

### 3.3 Env variable handling
- Unrelated env vars are ignored silently for commands that do not require them.
- No warning noise for ignored env vars.

### 3.4 Core output paths are CLI-only by default
Core output paths must be provided explicitly via CLI flags and are not read from config/env fallbacks by default.

Current core output path flags:
- `--out`:
  - `fetch`
  - `get_metadata`
  - `parse`
  - `transform-notion`
  - `run`
  - `capture-fixture`
- `--out-fixtures-dir`:
  - `ingest`
  - `capture-fixture`

Exception policy:
- Exceptions are allowed only when there is concrete operational specialty.
- Any exception must be command/flag-specific, explicitly approved, documented in both policy and README, and covered by tests.
- No broad implicit fallback track is allowed for core output paths.

## 4. Cookie Policy

### 4.1 Merge-only cookie model
- Public cookie source: `public.config.json -> cookies.publicEntries`
- Secret cookie source: `cookies.secrets.local.json` (array format)
- Runtime behavior: merge both arrays directly.

### 4.2 Classification rule
- Runtime does **not** classify cookies as public vs secret.
- Split is for storage/operational separation only.

### 4.3 Identity and conflict rule
- Cookie identity tuple: `name|normalizedDomain|normalizedPath`
- Duplicate tuple is an error:
  - across public/secrets sources
  - within a single source

### 4.4 Empty cookie behavior
- Empty merged cookie list is allowed.

## 5. Failure and Error Semantics

### 5.1 Missing-file policy
- Required file reads fail with:
  - `E_FILE_NOT_FOUND: <kind>: <path>`
- Applies only when that file is required by the active command flow.

### 5.2 Cookie validation policy
- Invalid cookie shapes fail with:
  - `E_COOKIE_INVALID: ...detailed reason...`
- Validation diagnostics are emitted as `[validateCookies] ...`.

### 5.3 Run pipeline + Notion policy
- `run` does not silently skip upload after markdown generation.
- `run` reaches upload stage and reports explicit failure when Notion cannot succeed:
  - missing notion setup
  - invalid notion credentials
  - Notion API failure
- On upload failure:
  - `ok: false`
  - `reason: "notion upload failed"`
- Artifacts are preserved for inspection/retry.

### 5.4 Requirement symmetry by stage criticality
- Requirement flags are not forced to be symmetric across dependencies.
- A dependency is **upstream-critical** if needed to start/produce core artifacts; it should be loaded fail-fast.
- A dependency is **downstream-critical** if needed only in later delivery stages; it may be validated at that stage and fail explicitly there.
- In `run`, this means cookies are treated as upstream-critical, while Notion setup is downstream-critical.
- Different strictness is intentional when dependencies are needed at different stages.

## 6. Runtime Debug Logging

### 6.1 Default mode
- Normal output is JSON results on stdout and error messages on stderr.

### 6.2 Debug mode
- Runtime-config debug logs are gated by:
  - `ARTICLE_DOWNLOADER_DEBUG_CONFIG=1`
- Debug messages use `[runtime-config] ...` prefix.

## 7. Testing Policy

### 7.1 Coverage focus
Tests are expected to protect:
- Current CLI contract (options and unknown-flag behavior)
- Runtime config resolution and precedence rules
- Cookie merge and validation invariants
- Parser correctness and strict selector behavior
- Run upload-stage semantics
- Redaction/safety guarantees

### 7.2 Legacy test posture
- Migration-era tests for removed legacy flags were intentionally pruned.
- Suite should prioritize current policy guarantees over historical transition checks.

### 7.3 Closed-loop local safety gate
- The project defines a local closed test loop via `npm run test:closed-loop`.
- The closed loop runs preflight checks and then the full test suite.
- Closed-loop execution must not require real secrets.
- Closed-loop execution enforces localhost-only network access; external hosts are blocked.
- Test fixtures must not contain real secret material or obvious secret markers.
- Runtime artifacts (for example `meta.json`) must not expose secret values or secret paths.

### 7.4 Closed-loop evolution note
- Future growth may split the loop into `closed-loop:required` and `closed-loop:full`.
- Until explicitly introduced, a single `test:closed-loop` entrypoint remains the default policy.

### 7.5 Test URL sanitization policy
- Scope:
  - Applies to URLs in test fixtures and test code (`tests/fixtures/*.html`, `tests/*.test.ts`).
- Keep generic, non-sensitive endpoints unchanged:
  - Example: `https://www.zhihu.com/settings/account`.
  - Rationale: no personal/content-identifying payload in the path.
- Sanitize content-identifying Zhihu URLs:
  - Routes: `/question/<id>`, `/question/<id>/answer/<id>`, `/pin/<id>`, `zhuanlan.zhihu.com/p/<id>`.
  - Rule: sanitize long numeric IDs (9+ digits) to deterministic placeholders.
- Do not over-sanitize route structure:
  - Keep Zhihu hostnames and route patterns so parser/adapter route-detection coverage remains valid.
- Deterministic replacement requirement:
  - Replacements must be stable and repeatable across fixtures/tests.
  - Short demo IDs (`1`, `2`, `123`) are allowed when they are synthetic examples.
- Validation expectation:
  - Any policy-compliant test update must keep `npm test` and `npm run test:closed-loop` passing.

### 7.6 HTML ingest sanitization policy
- New fixture imports must use HTML-only ingest:
  - `ingest --html <path> --source-url <url> --fixture <name>`
- `ingest` must reject URL input mode in v1:
  - `E_INGEST_UNSUPPORTED_INPUT: --url is not supported; use --html`
- `ingest` is intentionally HTML-only and offline; URL input is not a future direction for this command.
- Import-time sanitization is mandatory before writing tracked fixture artifacts.
- Sanitization must preserve structure by default:
  - keep unknown/new tags and attribute keys unless explicitly disallowed by policy.
  - replace sensitive values in-place with deterministic placeholders.
- Ledger diff validation is required:
  - fail if node/tag disappears unexpectedly.
  - fail if attribute key disappears unexpectedly.
  - allow only approved value-class transitions (for example token/id value -> placeholder text).
- Secret pattern validation is required on sanitized outputs:
  - fail with `E_INGEST_SECRET_PATTERN` if obvious secret markers are detected.
- Raw unsanitized HTML must remain local/untracked only (for example `.local/raw-imports/...`) and must not be committed.
- Fixture target overwrite policy:
  - If `tests/fixtures/<fixture>.html` or `tests/fixtures/<fixture>.map.json` already exists, fail fast with `E_INGEST_TARGET_EXISTS`.

### 7.7 Canonical fixture workflow policy
- Canonical producer-to-sanitizer workflow command is:
  - `capture-fixture --url <url> --fixture <name> ...`
- `capture-fixture` is fetch-first and ingest-second in a single flow.
- Stage failure semantics:
  - If fetch fails, ingest must not run.
  - If fetch succeeds and ingest fails, command must return non-zero and include fetch artifacts for inspection.
- Artifact linkage/copy policy:
  - canonical sanitized fixture artifacts stay in `tests/fixtures/`.
  - linked copies are written to `output/<run>/ingest/`.
  - raw artifacts remain dual-path by design:
    - `output/<run>/page.html`
    - `.local/raw-imports/<timestamp>-<fixture>/raw.html`

### 7.8 Workflow naming policy
- Commands that may grow additional stages should use outcome-oriented names.
- `capture-fixture` is the preferred naming style over composition-only names.
- No alias naming track is required for this policy change.

## 8. Change Governance

### 8.1 When changing policy
- Update code, tests, and README together.
- Preserve clear error surfaces and deterministic behavior.

### 8.2 Backward-compatibility default
- Prefer strict, explicit contracts unless compatibility is explicitly requested and documented.

### 8.3 Documentation example ordering
- In user-facing docs (especially `README.md`), examples are best presented `default-first, advanced-later`.
- The first example for a task should generally be the simplest safe default workflow that works for most users.
- Advanced, specialized, or compatibility-sensitive variants can follow, with brief context on when they are useful.

## 9. GUI Policy (V1 Local-Only)

### 9.1 Runtime and topology policy
- GUI V1 is a first-class local runtime:
  - frontend, bridge, and CLI run on the same machine.
- Bridge API is the GUI contract surface and remains stable for V1:
  - `GET /api/commands`
  - `GET /api/history?argKey=...`
  - `POST /api/history`
  - `POST /api/browse-path`
  - `POST /api/run`
- Frontend assets are served by the bridge from built output artifacts.
- `handleApi` API behavior remains authoritative and must not be broken by frontend/tooling changes.

### 9.2 GUI execution model policy
- GUI remains a thin wrapper over existing CLI behavior.
- CLI remains source of truth for validation and failure semantics.
- GUI-side input assistance must not add local enforcement that changes CLI contract outcomes.

### 9.3 GUI argument metadata policy
- GUI argument descriptors carry UI semantics beyond CLI option shape:
  - `valueHint`
  - `pathMode` (`file | dir`) for path inputs
  - `inputMode` (`name | text`) for non-path interaction hints
- Explicitly non-path arguments (for example `--fixture`) must not expose path-browse affordances.

### 9.4 Path picker interaction policy
- Path picker is modal-first with inline fallback for constrained contexts.
- Manual path input must remain available at all times.
- Path picker is non-enforced:
  - GUI must never block execution based on local path existence checks.
- Prompt-based browser dialogs are not part of the shipped V1 picker interaction model.

### 9.5 GUI tooling and script contract policy
- V1 GUI frontend stack is:
  - React
  - Vite
  - MUI (+ Emotion)
- GUI script contracts in `package.json` are policy-level entrypoints:
  - `gui`
  - `gui:server`
  - `gui:dev`
  - `gui:build`
  - `gui:test:e2e`
- Documentation and CI/test guidance must stay aligned with these script names.

### 9.6 GUI testing baseline policy
- GUI behavior coverage includes both unit/integration and browser E2E layers.
- Browser E2E baseline is maintained via Playwright and exercised through:
  - `npm run gui:test:e2e`
- Baseline GUI E2E scenarios must cover at least:
  - command rendering/switching
  - path picker modal interaction
  - inline fallback behavior
  - browse error visibility with manual-path fallback
  - run-flow output smoke
- `npm test` and GUI E2E are complementary gates; one does not replace the other.
