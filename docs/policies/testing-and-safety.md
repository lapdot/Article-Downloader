# Testing And Safety

This document defines the authoritative testing, fixture-safety, and validation policies for ArticleDownloader.

## 1. Coverage Focus

Tests are expected to protect:
- Current CLI contract, including options and unknown-flag behavior
- Runtime config resolution and precedence rules
- Download-method selection logic and validation behavior
- Parser correctness and strict selector behavior
- Run upload-stage semantics
- Redaction and safety guarantees

## 2. Legacy Test Posture

- Migration-era tests for removed legacy flags were intentionally pruned.
- The suite should prioritize current policy guarantees over historical transition checks.

## 3. Closed-Loop Local Safety Gate

- The project defines a local closed test loop via `npm run test:closed-loop`.
- The closed loop runs preflight checks, then `npm run typecheck`, and then the full test suite.
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
- Sanitize content-identifying Substack URLs:
  - `substack.com/@<author>/p-<id>`
  - `<publication>.substack.com/p/<slug>`
- Sanitize long numeric IDs, 9 digits or more, to deterministic placeholders.
- Do not over-sanitize route structure.
- Replacements must be stable and repeatable across fixtures and tests.
- Short demo IDs like `1`, `2`, and `123` are allowed when synthetic.

Validation expectation:
- Any policy-compliant test update must keep `npm test` and `npm run test:closed-loop` passing.
- Add focused coverage when fetch-time normalization is introduced for a supported source. For Substack aggregator URLs, tests should cover successful canonical normalization, graceful fallback to the original fetched shell when lookup data is insufficient, and synthetic article fallback when canonical-page refetch fails after a successful lookup.
- Keep at least one CLI-level smoke test for each supported non-Zhihu source so source support is exercised through the user-facing command surface, not only lower-level parser/fetch helpers.

## 6. Fixture Safety Policy

- The CLI does not provide fixture import or sanitization commands.
- Test fixtures may still live under `tests/fixtures/` as curated HTML samples, but they are maintained outside the runtime contract.
- Closed-loop and committed-fixture safety checks must continue scanning tracked fixtures for obvious secret markers.
- Raw HTML collected during development should stay in untracked local artifact paths unless deliberately curated for tests.
- Preferred local locations are:
  - `artifacts/runtime/` for runtime-produced files
  - `artifacts/llm/work/` for scratch captures and intermediate LLM workflow material
- Iterative URL-review work should inspect local artifacts by stage rather than curating ad hoc tracked snapshots unless the artifact is intentionally promoted into `tests/fixtures/`.
- `.local/` should not be used as a catch-all artifact store; it is reserved for operational state.

## 7. Documentation Example Ordering

- In user-facing docs, especially `README.md`, examples are best presented default-first and advanced-later.
- The first example for a task should generally be the simplest safe default workflow that works for most users.
- Advanced, specialized, or compatibility-sensitive variants can follow with brief context.
