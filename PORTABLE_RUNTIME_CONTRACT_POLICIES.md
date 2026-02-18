# Portable Policies: Config Paths and Input Contracts

This document captures reusable policies for command-line and service-style projects.
It is intentionally domain-agnostic and can be applied across repositories.

## 1. Design Intent

### 1.1 Goals
- Make runtime behavior explicit and predictable.
- Reduce hidden coupling to machine-local environment state.
- Keep error handling deterministic and easy to debug.

### 1.2 Core principle
- Treat **content inputs**, **configuration paths**, and **secret values** as different classes of data with different rules.

## 2. Path Resolution Policy

### 2.1 Recommended precedence
For any file-path setting (config or secret path):
1. Explicit CLI argument
2. Environment variable
3. Project default (only when a safe default exists)

Example:
- `--config` > `APP_PUBLIC_CONFIG_PATH`
- `--secret-path` > `APP_SECRET_PATH` > `config/secret.local.json`

### 2.2 Explicit failure on missing required path
- If required path cannot be resolved, fail with a clear, actionable message.
- Include both missing key and accepted sources.

Example:
- `missing config path: provide --config or APP_PUBLIC_CONFIG_PATH`

### 2.3 Path-only env policy for secrets
- Environment variables should usually provide **secret file paths**, not secret values.
- Secret values should be loaded from files or secure stores.

Examples:
- Good: `APP_API_SECRETS_PATH=/secure/path/secrets.json`
- Avoid: `APP_API_TOKEN=...` in plain shell history (unless platform constraints require it)

## 3. Input Contract Policy

### 3.1 Core inputs are CLI/API-only
- Inputs that define the execution target should come from explicit invocation, not fallback config.

Examples:
- `--url`, `--input-file`, `--query`, `--job-id`
- API fields like `targetId`, `sourceUrl`, `payloadPath`

### 3.2 Strict argument surface
- Each command should accept only relevant options.
- Irrelevant options should fail fast (unknown option), not be silently accepted.

Examples:
- `inspect` command rejects `--publish-target`
- `publish` command rejects `--scan-rules`

### 3.3 Irrelevant env vars are ignored
- Unrelated env vars should not break commands that do not require them.
- Avoid warning spam by default.

Example:
- `APP_UPLOAD_SECRET_PATH` may be set globally, but a `verify` command should ignore it.

### 3.4 Core output paths are CLI/API-only by default
- Paths that define where core artifacts are written should be provided explicitly by invocation (CLI flag or API field), not silently inferred from config/env.
- This mirrors the core input explicitness rule.
- Shell expansion is acceptable when the value is still passed explicitly through invocation (for example `--out "$OUT_DIR"`).

Exception policy:
- Exceptions are allowed only for concrete operational specialties.
- Any exception should be:
  - command/field-specific,
  - explicitly documented,
  - test-covered,
  - and non-default unless clearly justified.

## 4. Error Semantics

### 4.1 Standardize high-frequency errors
- Use a consistent format for file-missing errors.

Example:
- `E_FILE_NOT_FOUND: <kind>: <path>`

### 4.2 Error message quality requirements
- Include:
  - what failed
  - where it looked
  - what user can do next

Bad:
- `invalid config`

Good:
- `E_FILE_NOT_FOUND: public config: ./config/app.json`
- `missing config path: provide --config or APP_PUBLIC_CONFIG_PATH`

## 5. Operational Safety Rules

### 5.1 Do not hide skipped stages
- If a downstream stage cannot run due to missing prerequisites, prefer explicit stage failure over silent skip when correctness matters.

Example:
- A pipeline that parses content then uploads:
  - parse may succeed,
  - upload should still report `ok: false` if credentials are missing.

### 5.2 Preserve intermediate artifacts on downstream failure
- Keep outputs from successful upstream stages for debugging/retry.

Examples:
- Keep outputs from Stage 1 (`acquire`), Stage 2 (`normalize`), and Stage 3 (`analyze`) even if Stage 4 (`deliver`) fails.
- Example files: keep `01-acquired.json`, `02-normalized.json`, `03-analysis.json` when `04-delivery-result.json` is missing due to delivery failure.

### 5.3 Requirement strictness follows stage criticality
- Requirement flags do not need to be symmetric across all dependencies.
- Treat dependencies needed to start/produce core outputs as **upstream-critical** and validate them fail-fast.
- Treat dependencies needed only for late delivery/integration as **downstream-critical** and validate them at that stage.
- If a downstream-critical dependency is missing, report explicit stage failure instead of silently skipping.
- Different strictness is intentional when dependencies are consumed at different stages.

### 5.4 Requirement strictness follows stage criticality
- Requirement strictness does not need to be symmetric across all dependencies.
- Dependencies needed to start or produce core artifacts are **upstream-critical** and should be validated fail-fast.
- Dependencies needed only for later delivery/integration are **downstream-critical** and may be validated at the stage where they are consumed.
- Missing downstream-critical dependencies should produce explicit stage failure rather than silent skip.

### 5.5 Preserve intermediate artifacts on downstream failure
- If upstream stages succeed and a later stage fails, keep intermediate artifacts by default for diagnosis and retry.
- Artifact retention should be intentional, documented, and consistent across command modes.

## 6. Test Expectations

### 6.1 Must-have contract tests
- Path precedence tests (arg > env > default).
- Missing-path failure tests with exact error text.
- Unknown-option tests for irrelevant flags.
- Ignore-unrelated-env tests.

### 6.2 Keep tests aligned to current policy
- Remove migration-era tests once transition is complete.
- Prioritize current behavior guarantees over historical compatibility checks.

### 6.3 Policy-alignment tests for output and stage behavior
Include tests for:
- explicit core output path requirements,
- exception-path behavior (if any),
- upstream-critical fail-fast behavior,
- downstream-critical explicit-failure behavior,
- intermediate artifact preservation on downstream failure.

## 7. Runtime diagnostics policy

### 7.1 Default diagnostics mode
- Default runtime output should remain concise and contract-stable for automation.

### 7.2 Debug diagnostics mode
- Additional diagnostic logs should be gated by explicit opt-in (for example `APP_DEBUG=1`).
- Debug logs should use a recognizable prefix to simplify filtering.

### 7.3 Sensitive artifact and log redaction
- Runtime artifacts and diagnostics must not expose secret values or secret file paths.
- Redaction policy should apply consistently across:
  - structured artifact files,
  - terminal output,
  - and persisted logs.
- Add contract tests that verify redaction behavior for representative secret patterns.

## 8. Documentation and change governance

### 8.1 Example ordering in user-facing docs
- Examples are best presented `default-first, advanced-later`.
- The first example for a task should generally be the simplest safe default workflow.
- Advanced/specialized variants should follow with brief context.

### 8.2 Policy change consistency
- When policy changes, update implementation, tests, and user-facing docs together.
- Prefer explicit contracts over implicit fallback behavior unless compatibility is explicitly requested and documented.

## 9. Wrapper and Interface Contract Policy

### 9.1 Thin-wrapper authority model
- If a wrapper layer exists (GUI, API gateway, orchestration service), it should remain a thin wrapper over core execution logic.
- Core backend/CLI/service remains source of truth for:
  - validation,
  - error semantics,
  - and stage outcomes.
- Wrapper-side helpers must not silently change core contract behavior.

### 9.2 Assistive-input non-enforcement
- Input-assistance features (pickers, autocomplete, history insertion) are assistive, not authoritative.
- Manual input must remain available.
- Wrapper/helper layers must not block execution solely due to local prechecks when core runtime is authoritative.

### 9.3 Stable wrapper/API interface
- Wrapper-facing endpoints or interfaces should be treated as explicit contracts.
- Frontend/tooling/runtime migrations should preserve request/response semantics unless a versioned contract change is intentionally introduced.
- Contract stability expectations should be documented and test-covered.

### 9.4 Semantic descriptor hints (for dynamic clients)
- Dynamic client surfaces may require semantic metadata beyond basic type shape (for example mode hints).
- Descriptor hints should be explicit and test-covered, rather than inferred from ambiguous naming alone.
- Exception mappings (for example name-like values that should not use path helpers) should be documented as rules.

## 10. Test Gate Policy

### 10.1 Complementary test gates
- Unit/integration tests and end-to-end tests are complementary gates; one does not replace the other.
- Define explicit command entrypoints for each gate and keep docs/CI aligned.

### 10.2 Closed-loop local safety gate
- Projects should define an optional closed-loop mode for deterministic local safety.
- Closed-loop mode should:
  - avoid requiring real secrets,
  - constrain network scope by default (for example localhost-only unless explicitly allowed),
  - and include secret-pattern checks for tracked fixtures/artifacts when applicable.

### 10.3 Baseline end-to-end scenarios
- End-to-end baseline should cover critical user/system flows for the active interface surface.
- For wrapper/GUI interfaces, baseline scenarios typically include:
  - surface boot/render,
  - primary action path,
  - key error/fallback behavior.

## 11. Script Contract Policy

### 11.1 Script names as operational interface
- Named automation scripts (for example package scripts or task runners) should be treated as stable operational interfaces for users and CI.
- Changes to script names/behavior should be documented and reflected in tests and user-facing docs.

### 11.2 Script-to-doc alignment
- User-facing docs should reference canonical script entrypoints, not ad-hoc local commands, unless explicitly documented as advanced alternatives.

## 12. Multi-source Merge Conflict Policy (Optional Specialty)

### 12.1 Normalized identity for merges
- When runtime merges records from multiple sources, define a normalized identity tuple for conflict detection.
- Conflict policy should be explicit (for example fail-fast on duplicate identity across/within sources).

### 12.2 Merge conflict test coverage
- Add tests for:
  - cross-source duplicate conflicts,
  - same-source duplicate conflicts,
  - and successful merges with normalized identity handling.

## 13. Adaptation Template

To apply this to a new project, define:
- Core inputs: `[...]`
- Config path env vars: `[...]`
- Secret path env vars: `[...]`
- Default paths (if any): `[...]`
- Required-stage behavior on missing prerequisites: `fail` or `skip`
- Standard error vocabulary: `E_FILE_NOT_FOUND`, `E_CONFIG_INVALID`, ...
- Wrapper authority model (if applicable): `thin-wrapper` or `wrapper-authoritative`
- Assistive-input policy (if applicable): `non-enforced` or `enforced`
- Test gates:
  - unit/integration command: `...`
  - e2e command: `...`
  - closed-loop command (optional): `...`

Then implement and test against those decisions consistently.
