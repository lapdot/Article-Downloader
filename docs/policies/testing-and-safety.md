# Testing And Safety

This document defines the authoritative testing, fixture-safety, and validation policies for ArticleDownloader.

## 1. Coverage Focus

Tests are expected to protect:
- Current CLI contract, including options and unknown-flag behavior
- Runtime config resolution and precedence rules
- Cookie merge and validation invariants
- Strategy-dependent prerequisite behavior
- Parser correctness and strict selector behavior
- Run upload-stage semantics
- Redaction and safety guarantees

## 2. Legacy Test Posture

- Migration-era tests for removed legacy flags were intentionally pruned.
- The suite should prioritize current policy guarantees over historical transition checks.

## 3. Closed-Loop Local Safety Gate

- The project defines a local closed test loop via `npm run test:closed-loop`.
- The closed loop runs preflight checks and then the full test suite.
- Closed-loop execution must not require real secrets.
- Closed-loop execution enforces localhost-only network access; external hosts are blocked.
- Test fixtures must not contain real secret material or obvious secret markers.
- Runtime artifacts, for example `meta.json`, must not expose secret values or secret paths.

## 4. Closed-Loop Evolution Note

- Future growth may split the loop into `closed-loop:required` and `closed-loop:full`.
- Until explicitly introduced, a single `test:closed-loop` entrypoint remains the default policy.

## 5. Test URL Sanitization Policy

Scope:
- Applies to URLs in test fixtures and test code, including `tests/fixtures/*.html` and `tests/*.test.ts`.

Rules:
- Keep generic, non-sensitive endpoints unchanged.
  - Example: `https://www.zhihu.com/settings/account`
- Sanitize content-identifying Zhihu URLs:
  - `/question/<id>`
  - `/question/<id>/answer/<id>`
  - `/pin/<id>`
  - `zhuanlan.zhihu.com/p/<id>`
- Sanitize long numeric IDs, 9 digits or more, to deterministic placeholders.
- Do not over-sanitize route structure.
- Replacements must be stable and repeatable across fixtures and tests.
- Short demo IDs like `1`, `2`, and `123` are allowed when synthetic.

Validation expectation:
- Any policy-compliant test update must keep `npm test` and `npm run test:closed-loop` passing.

## 6. HTML Ingest Sanitization Policy

- New fixture imports must use HTML-only ingest:
  - `ingest --html <path> --source-url <url> --fixture <name>`
- `ingest` must reject URL input mode in v1:
  - `E_INGEST_UNSUPPORTED_INPUT: --url is not supported; use --html`
- `ingest` is intentionally HTML-only and offline.
- Import-time sanitization is mandatory before writing tracked fixture artifacts.
- Sanitization must preserve structure by default:
  - keep unknown or new tags and attribute keys unless explicitly disallowed by policy
  - replace sensitive values in place with deterministic placeholders
- Ledger diff validation is required:
  - fail if node or tag disappears unexpectedly
  - fail if attribute key disappears unexpectedly
  - allow only approved value-class transitions
- Secret pattern validation is required on sanitized outputs:
  - fail with `E_INGEST_SECRET_PATTERN` if obvious secret markers are detected
- Raw unsanitized HTML must remain local and untracked only, for example `.local/raw-imports/...`
- Fixture target overwrite policy:
  - if `tests/fixtures/<fixture>.html` or `tests/fixtures/<fixture>.map.json` already exists, fail fast with `E_INGEST_TARGET_EXISTS`

## 7. Canonical Fixture Workflow Policy

- Canonical producer-to-sanitizer workflow command is:
  - `capture-fixture --url <url> --fixture <name> ...`
- `capture-fixture` is fetch-first and ingest-second in a single flow.

Stage failure semantics:
- If fetch fails, ingest must not run.
- If fetch succeeds and ingest fails, the command must return non-zero and preserve fetch artifacts for inspection.

Artifact linkage and copy policy:
- Canonical sanitized fixture artifacts stay in `tests/fixtures/`.
- Linked copies are written to `output/<run>/ingest/`.
- Raw artifacts remain dual-path by design:
  - `output/<run>/page.html`
  - `.local/raw-imports/<timestamp>-<fixture>/raw.html`

## 8. Workflow Naming Policy

- Commands that may grow additional stages should use outcome-oriented names.
- `capture-fixture` is the preferred naming style over composition-only names.
- No alias naming track is required for this policy change.

## 9. Documentation Example Ordering

- In user-facing docs, especially `README.md`, examples are best presented default-first and advanced-later.
- The first example for a task should generally be the simplest safe default workflow that works for most users.
- Advanced, specialized, or compatibility-sensitive variants can follow with brief context.
