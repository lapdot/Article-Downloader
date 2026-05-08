# Portable Policy Template

This document captures reusable policy ideas for command-line and service-style projects.

It is intentionally domain-agnostic and can be applied across repositories. It is not the authoritative contract for ArticleDownloader. For this repository, use `docs/policies/runtime-contract.md`, `docs/policies/testing-and-safety.md`, and `docs/policies/gui-contract.md`.

## 1. Design Intent

### 1.1 Goals
- Make runtime behavior explicit and predictable.
- Reduce hidden coupling to machine-local environment state.
- Keep error handling deterministic and easy to debug.

### 1.2 Core principle
- Treat content inputs, configuration paths, and secret values as different classes of data with different rules.

## 2. Path Resolution Policy

### 2.1 Recommended precedence
For any file-path setting, config or secret path:
1. Explicit CLI argument
2. Environment variable
3. Project default, only when a safe default exists

### 2.2 Explicit failure on missing required path
- If required path cannot be resolved, fail with a clear, actionable message.
- Include both missing key and accepted sources.

### 2.3 Path-only env policy for secrets
- Environment variables should usually provide secret file paths, not secret values.
- Secret values should be loaded from files or secure stores.

## 3. Input Contract Policy

### 3.1 Core inputs are CLI or API only
- Inputs that define the execution target should come from explicit invocation, not fallback config.

### 3.2 Strict argument surface
- Each command should accept only relevant options.
- Irrelevant options should fail fast, not be silently accepted.

### 3.3 Irrelevant env vars are ignored
- Unrelated env vars should not break commands that do not require them.
- Avoid warning spam by default.

### 3.4 Core output paths are CLI or API only by default
- Paths that define where core artifacts are written should be provided explicitly by invocation.
- Any exception should be command-specific, explicitly documented, and test-covered.

## 4. Error Semantics

### 4.1 Standardize high-frequency errors
- Use a consistent format for file-missing errors.

### 4.2 Error message quality requirements
- Include what failed, where it looked, and what the user can do next.

## 5. Operational Safety Rules

### 5.1 Do not hide skipped stages
- If a downstream stage cannot run due to missing prerequisites, prefer explicit stage failure over silent skip when correctness matters.

### 5.2 Preserve intermediate artifacts on downstream failure
- Keep outputs from successful upstream stages for debugging and retry.

### 5.3 Requirement strictness follows stage criticality
- Dependencies needed to start or produce core outputs are upstream-critical and should be validated fail-fast.
- Dependencies needed only for later delivery or integration are downstream-critical and may be validated at the point of use.

### 5.4 Strategy-dependent prerequisites
- Requirement strictness may depend on the selected execution strategy, not only on command name.
- Strategy-dependent requirement changes should be explicit, documented, and test-covered.

## 6. Test Expectations

### 6.1 Must-have contract tests
- Path precedence tests
- Missing-path failure tests
- Unknown-option tests
- Ignore-unrelated-env tests

### 6.2 Keep tests aligned to current policy
- Remove migration-era tests once transition is complete.
- Prioritize current behavior guarantees over historical compatibility checks.

### 6.3 Policy-alignment tests for output and stage behavior
- Include tests for explicit output path rules, prerequisite behavior, strategy-dependent requirements, and artifact preservation.

## 7. Runtime Diagnostics Policy

### 7.1 Default diagnostics mode
- Default runtime output should remain concise and contract-stable for automation.

### 7.2 Debug diagnostics mode
- Additional diagnostic logs should be gated by explicit opt-in.

### 7.3 Sensitive artifact and log redaction
- Runtime artifacts and diagnostics must not expose secret values or secret file paths.

## 8. Documentation And Change Governance

### 8.1 Example ordering in user-facing docs
- Prefer default-first, advanced-later examples.

### 8.2 Policy change consistency
- When policy changes, update implementation, tests, and user-facing docs together.

## 9. Wrapper And Interface Contract Policy

### 9.1 Thin-wrapper authority model
- If a wrapper layer exists, core backend or CLI remains the source of truth for validation, error semantics, and stage outcomes.

### 9.2 Assistive-input non-enforcement
- Input-assistance features are assistive, not authoritative.
- Manual input must remain available.

### 9.3 Stable wrapper or API interface
- Wrapper-facing endpoints or interfaces should be treated as explicit contracts.

### 9.4 Conditional relevance in wrapper clients
- Wrapper-visible fields and runtime-required fields are different contracts and must not be conflated.

## 10. Test Gate Policy

### 10.1 Complementary test gates
- Unit or integration tests and E2E tests are complementary gates.

### 10.2 Closed-loop local safety gate
- Projects should define an optional closed-loop mode for deterministic local safety.

### 10.3 Baseline end-to-end scenarios
- End-to-end baseline should cover critical user or system flows for the active interface surface.

## 11. Script Contract Policy

### 11.1 Script names as operational interface
- Named automation scripts should be treated as stable operational interfaces for users and CI.

### 11.2 Script-to-doc alignment
- User-facing docs should reference canonical script entrypoints.

### 11.3 Built-artifact freshness for wrapper runtimes
- If a wrapper runtime serves built artifacts, freshness of those artifacts is part of the operational contract.
