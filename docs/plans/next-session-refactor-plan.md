# Next Session Refactor Plan

This plan is a handoff note for the next refactoring session after:

- parser-stage source ownership moved into `src/adapters/`
- fetch-stage source ownership moved into `src/adapters/`
- shared source resolution moved into `src/adapters/resolve-source.ts`
- Substack aggregator normalization was expanded to support newer reader-shell preload shapes

This document is planning-only. It does not change the current runtime contract by itself.

## Current Baseline

The codebase now has a workable source-owned structure for two stages:

- `src/core/parser.ts` is an orchestrator that resolves a source through the shared helper and dispatches to source-owned capabilities
- `src/core/fetcher.ts` is an orchestrator that handles transport and optional source normalization
- `src/adapters/resolve-source.ts` centralizes explicit adapter imports and resolution order
- `src/adapters/zhihu.ts` and `src/adapters/substack.ts` own source detection, parser behavior, metadata behavior, and any source-specific fetch normalization

The main remaining problems are:

- verification is still outside the adapter capability model
- canonical internal naming is only partially introduced
- test organization has improved for parser and fetch, but broader source symmetry is still incomplete
- source-specific logic may still remain in non-adapter areas such as CLI-level workflows, policies, or future runtime helpers

## Recommended Refactor Order

### Phase 3: Shared source resolution utility

Status:
- completed

Goal:
- remove duplicated explicit source dispatch logic while keeping readability and without introducing a registry pattern

Completed work:
- added `src/adapters/resolve-source.ts`
- kept adapter imports explicit and ordered in one place
- returned a resolved `{ adapter, source }` pair for a parsed URL
- updated `src/core/parser.ts` and `src/core/fetcher.ts` to reuse that helper

Constraints:
- do not add dynamic registration
- do not hide control flow behind a complex abstraction
- keep unsupported-site behavior unchanged

Outcome:
- parser and fetcher no longer maintain separate copies of source resolution logic
- tests pass with unchanged public behavior

### Phase 4: Verification capability refactor

Goal:
- make verification a source-owned optional capability in the same style as parser and fetch normalization

Why this next:
- Zhihu verification is the next obvious source-specific behavior that still sits outside the adapter capability model
- this will complete the main architectural pattern for source-specific runtime behaviors

Proposed work:
- extend `src/adapters/contracts.ts` with an optional verification capability
- move Zhihu verification behavior behind the Zhihu adapter
- keep the CLI command shape and current error semantics stable
- make it easy for future sources to opt into verification without forcing no-op implementations

Constraints:
- do not redesign verification policy in the same step
- preserve `verify-zhihu` behavior and diagnostics
- do not force Substack to implement verification if it does not need it

Exit criteria:
- source verification is adapter-owned where applicable
- CLI/runtime behavior remains stable
- docs and tests reflect the new ownership boundary

### Phase 5: Strengthen canonical internal source modeling

Goal:
- make internal naming more explicit for multi-source growth without breaking user-facing terminology yet

Motivation:
- terms like `answer`, `pin`, `post`, and `zhuanlan article` are still partly treated as flat concepts
- future sources will make this ambiguity worse

Proposed work:
- audit `src/types.ts`, adapters, runtime outputs, and tests for places where source-native content kinds are treated too globally
- prefer structured identity consistently:
  - `sourceId`
  - source-native `contentType`
- add helper types where useful for source-aware branching and diagnostics
- defer any user-facing renaming unless a contract change is intentionally approved

Constraints:
- keep CLI output and existing artifact meaning stable
- avoid renaming content kinds in README or runtime JSON unless explicitly planned

Exit criteria:
- internal typing consistently reflects source-aware content identity
- fewer ambiguous content-type assumptions remain in shared code

### Phase 6: Broaden source-parallel test coverage

Goal:
- make the test suite more clearly source-oriented and more resilient as new sources are added

Proposed work:
- review remaining mixed tests and split them when source ownership is clearer
- add more real-world Substack and Zhihu fixtures for edge cases
- identify missing fixture coverage for:
  - Substack multi-author bylines
  - caption-heavy or embed-heavy Substack posts
  - Zhihu page variants that still rely on fragile selectors
- keep at least one integration-style path per stage that exercises shared orchestration

Constraints:
- do not replace all integration tests with unit-style adapter tests
- prefer targeted fixtures over massive snapshot churn

Exit criteria:
- source-specific failures are easier to localize from the test suite
- adding a new source has a clearer test template

### Phase 7: Remaining source-logic audit

Goal:
- find and move any residual source-specific assumptions that still live outside adapters without good reason

Suggested audit targets:
- `src/core/`
- `src/cli.ts`
- GUI bridge/runtime wrappers
- docs and policy language that still assumes Zhihu-first or parser-core ownership

Questions to ask during the audit:
- does this branch exist because sources differ?
- if yes, should that decision live with a source adapter instead?
- if no, is it truly shared behavior and named clearly as shared behavior?

Exit criteria:
- fewer source-specific conditionals remain outside adapters
- the boundary between core orchestration and source-owned behavior is easier to explain

## Suggested First Task For The Next Session

Start with Phase 4: move verification into the adapter capability model.

Why this is the best next step:

- shared source resolution is already in place, so the next architectural gap is clearer
- Zhihu verification is still the most obvious source-specific behavior outside the adapter capability model
- this continues the same source-owned runtime direction without broad contract churn

## Validation Checklist For The Next Session

For any of the phases above:

- run `npm test`
- run `npm run test:closed-loop`
- update relevant docs when ownership boundaries change
- preserve current CLI behavior unless the session explicitly aims to change contract
- prefer readable explicit source handling over hidden indirection
