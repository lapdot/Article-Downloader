# Next Session Refactor Plan

This plan is a handoff note for the next refactoring session after:

- parser-stage source ownership moved into `src/adapters/`
- fetch-stage source ownership moved into `src/adapters/`
- shared source resolution moved into `src/adapters/resolve-source.ts`
- Substack aggregator normalization was expanded to support newer reader-shell preload shapes
- canonical internal source identity was standardized across code, tests, and current docs

This document is planning-only. It does not change the current runtime contract by itself.

## Current Baseline

The codebase now has a workable source-owned structure for two stages:

- `src/core/parser.ts` is an orchestrator that resolves a source through the shared helper and dispatches to source-owned capabilities
- `src/core/fetcher.ts` is an orchestrator that handles transport and optional source normalization
- `src/adapters/resolve-source.ts` centralizes explicit adapter imports and resolution order
- `src/adapters/zhihu.ts` and `src/adapters/substack.ts` own source detection, parser behavior, metadata behavior, and any source-specific fetch normalization
- supported-source runtime results may now carry canonical `sourceId/contentType` identity when the input URL resolves cleanly

The main remaining problems are:

- canonical internal naming is established, but deeper coverage and residual-logic cleanup are still incomplete
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

### Note On Verification

Zhihu verification was removed from the product rather than migrated into the adapter capability model. Future refactor work should not assume a verification capability exists unless the feature is intentionally reintroduced under a new contract.

### Phase 5: Strengthen canonical internal source modeling

Status:
- completed

Goal:
- make internal naming more explicit and consistent for multi-source growth

Motivation:
- terms like `answer`, `pin`, and `post` can still be misread as flat global concepts when they are really source-aware identities
- future sources will make this ambiguity worse

Proposed work:
- standardize on the current canonical map:
  - Zhihu answer -> `sourceId: "zhihu"`, `contentType: "answer"`
  - Zhihu pin -> `sourceId: "zhihu"`, `contentType: "pin"`
  - Zhihu post (`zhuanlan.zhihu.com/p/...`) -> `sourceId: "zhihu"`, `contentType: "post"`
  - Substack post -> `sourceId: "substack"`, `contentType: "post"`

Completed work:
- updated `src/types.ts` so Zhihu zhuanlan content uses canonical `contentType: "post"`
- updated the Zhihu adapter, shared parser/fetcher orchestration, and result typing to carry canonical source identity consistently
- added `source` identity coverage to relevant fetch, parser, and orchestrator tests
- aligned README, architecture, workflow, and runtime-contract docs with the canonical source map
- kept route examples explicit while unifying internal and documented content naming

Constraints:
- keep CLI output and existing artifact meaning stable
- preserve current parser and fetch behavior while finishing the naming alignment

Exit criteria:
- internal typing consistently reflects source-aware content identity
- fewer ambiguous content-type assumptions remain in shared code
- docs and tests use the canonical Zhihu `post` naming consistently

Outcome:
- the codebase now has a stable canonical identity model that can support broader source-parallel refactor work
- future sessions can assume `sourceId/contentType` is the baseline shared vocabulary

### Phase 6: Broaden source-parallel test coverage

Status:
- completed

Goal:
- make the test suite more clearly source-oriented and more resilient as new sources are added

Completed work:
- kept `tests/parser-orchestrator.test.ts` as a thin shared dispatch smoke suite
- expanded source-owned parser coverage so Substack-specific and Zhihu-specific behavior lives primarily in source-focused suites
- added higher-value Substack fixture coverage for:
  - multi-author byline handling
  - caption-heavy content with wrapper-noise cleanup expectations
- added another brittle-shape Zhihu answer variant covering alternate title and content containers
- added a Substack fetch-and-parse integration smoke so integration coverage is no longer effectively Zhihu-only

Remaining guidance:
- review remaining mixed tests and split them when source ownership is clearer
- identify missing fixture coverage for:
  - Zhihu page variants that still rely on fragile selectors
- keep at least one integration-style path per stage that exercises shared orchestration

Constraints:
- do not replace all integration tests with unit-style adapter tests
- prefer targeted fixtures over massive snapshot churn

Exit criteria:
- source-specific failures are easier to localize from the test suite
- adding a new source has a clearer test template

Outcome:
- source-owned test coverage is broader and easier to localize across Zhihu and Substack
- one thin cross-source orchestration layer remains, but source behavior now lives mostly with source-focused suites

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

Initial audit findings after Phase 6:
- `src/core/cookies.ts` still hard-codes `DEFAULT_COOKIE_URL = "https://www.zhihu.com/"` for hostless cookie-jar context; decide whether that is justified shared behavior or a Zhihu-specific leak that should move behind a clearer shared policy
- CLI and runtime flows are mostly source-neutral now, but some tests and operational examples still skew Zhihu-first; prefer keeping future smoke coverage source-parallel when adding examples or wrappers
- `tests/integration-fetch-parse.test.ts` now covers both supported source families, but any future source-specific integration branches should stay narrow and avoid growing the shared orchestration layer back into a mixed behavior suite

## Suggested First Task For The Next Session

Start with Phase 7: remaining source-logic audit.

Why this is the best next step:

- shared source resolution, canonical identity modeling, and broader source-parallel test coverage are now in place
- the highest-value remaining gap is identifying source-specific assumptions that still live outside adapters
- the current test posture is strong enough to support a narrower audit-and-cleanup session without broad exploratory fixture work first

## Suggested Scope For The Next Session

- audit `src/core/`, `src/cli.ts`, and wrapper-facing code for source-specific branching that no longer belongs outside adapters
- begin with `src/core/cookies.ts`, especially the hard-coded Zhihu default cookie context, and decide whether it is justified shared behavior or a boundary leak
- review operational examples and smoke-test posture for remaining Zhihu-first bias, but keep changes narrow and source-neutral
- preserve the current thin shared orchestration test layer while avoiding new mixed behavior suites unless a true shared behavior requires them
- queue any runtime-affecting cleanup that would change contract semantics into a dedicated follow-up session instead of mixing it into a low-risk audit pass

## Validation Checklist For The Next Session

For the Phase 7 audit and any follow-up cleanup:

- run `npm test`
- run `npm run test:closed-loop`
- update relevant docs when ownership boundaries or active follow-up guidance change
- preserve current CLI behavior unless the session explicitly aims to change contract
- prefer readable explicit source handling over hidden indirection
