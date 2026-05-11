# Next Session Refactor Plan

This note is a handoff for the next refactoring session from the current repo baseline.

It assumes the following work is already complete:

- parser-stage source ownership lives in `src/adapters/`
- fetch-stage source normalization lives in `src/adapters/`
- shared source resolution is centralized in `src/adapters/resolve-source.ts`
- canonical internal source identity uses `sourceId/contentType`
- the runtime is now cookieproxy-only, while intentionally preserving `downloadMethod` selection logic and public selectors under [ADR 0006](../decisions/0006-cookieproxy-only-download-method.md)

This document is planning-only. It does not change the runtime contract by itself.

## Current Baseline

The codebase now has a stable split between shared orchestration and source-owned behavior:

- `src/core/parser.ts` dispatches to source-owned parsing and metadata logic
- `src/core/fetcher.ts` owns shared transport orchestration and calls optional source-owned fetch normalization
- `src/adapters/zhihu.ts` and `src/adapters/substack.ts` own source detection plus source-specific fetch, parse, and metadata behavior
- runtime, CLI, GUI, tests, and docs now agree that `downloadMethod` remains selectable but currently allows only `"cookieproxy"`

The most meaningful remaining refactor work is no longer transport cleanup. It is boundary-hardening:

- identify source-specific assumptions that still live outside adapters
- keep wrapper-facing code source-neutral unless a shared policy truly belongs there
- reduce lingering Zhihu-first examples or mixed-test posture where they no longer reflect the multi-source baseline

## Recommended Next Goal

Run a narrow audit of shared runtime and wrapper layers for source-owned decisions that still live too high in the stack.

This should stay focused on cleanup that clarifies ownership boundaries, not on broad rewrites or new capability design.

## Suggested Task Order

### Task 1: Audit shared orchestration for residual source-specific behavior

Primary targets:

- `src/core/`
- `src/cli.ts`
- `src/gui/bridge/`

Questions to ask during the audit:

- does this branch exist because sources differ?
- if yes, can the decision move behind an adapter-owned capability instead?
- if no, is it clearly named and documented as shared orchestration or shared policy?

Recommended bias:

- keep shared orchestration explicit and readable
- avoid introducing registry-style abstraction just to hide a small number of branches

Exit criteria:

- high-confidence source-specific branches outside adapters are either moved, justified, or explicitly deferred
- the shared/core layer is easier to explain without source-by-source caveats

### Task 2: Review CLI and GUI wrapper surfaces for source-neutrality

Primary targets:

- CLI command wiring
- GUI bridge request shaping and hints
- GUI-visible examples and descriptors

Focus:

- prevent future source-specific runtime choices from drifting upward into wrapper code
- keep `downloadMethod` selector behavior aligned across CLI, config, and GUI without re-opening transport design work
- confirm wrapper logic is about orchestration and contract enforcement, not source behavior

Exit criteria:

- wrapper code remains thin and runtime-driven
- any source-specific wrapper logic is either removed or justified as a true shared UX policy

### Task 3: Tighten source-parallel examples and test posture

Primary targets:

- mixed orchestration tests
- CLI smoke coverage
- workflow and example docs

Focus:

- keep at least one CLI-level smoke path for each supported source family
- avoid teaching contributors that shared behavior implicitly means Zhihu behavior
- keep shared orchestration suites thin while leaving behavior-heavy assertions in source-focused tests

Exit criteria:

- source-specific failures are easier to localize
- examples and test posture feel source-parallel rather than Zhihu-first

## Explicit Deferrals

Unless the audit uncovers a stronger issue, defer these to later sessions:

- any new `DownloadMethod` addition or transport redesign
- any runtime contract change that would alter user-visible fetch behavior
- any new adapter capability surface beyond the current fetch/markdown/metadata ownership
- any broad GUI reshaping that is not required by a validated runtime-boundary issue
- any registry-style adapter generalization

## Validation Checklist

For the next continuation pass:

- run `npm test`
- run `npm run test:closed-loop`
- update touched docs when ownership boundaries or wrapper responsibilities become clearer
- preserve current CLI and GUI contract behavior unless the session explicitly aims to change contract
- prefer small, explicit findings over broad structural churn

## Expected Outcome

The next session should count as complete when:

- residual source-specific shared-code assumptions have been audited in the agreed areas
- any obvious misplaced logic is cleaned up or deliberately deferred
- wrapper code remains thin and source-neutral
- the follow-up note after that session is shorter and more decision-oriented than this one
