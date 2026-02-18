# Bridge Mature Library Workflow

## Summary
This workflow translates `docs/bridge-mature-library-plan.md` into an implementation sequence with explicit gates.
Order is designed to minimize regression risk: contract freeze first, server migration second, persistence/logging migration third, then hardening and docs.

## Public Interfaces and Type Targets
Freeze these as non-breaking in this migration:
- Bridge APIs:
  - `GET /api/commands`
  - `GET /api/history?argKey=...`
  - `POST /api/history`
  - `POST /api/browse-path`
  - `POST /api/run`
- Run event stream:
  - `started`, `stdout`, `stderr`, `exited`, `result`
- Startup flags:
  - `--port`
  - `--workspace-dir`
  - `--history-dir`
  - `--logs-dir`
  - `--output-dir`

## Milestone A: Contract Freeze
### Phase A1: Baseline Capture
Implementation mode:
- Mode: non-mutating verification + contract snapshots.
- Libraries: none required.

Steps:
1. Capture current response shapes for each `/api/*` endpoint.
2. Capture `/api/run` NDJSON event ordering and payload examples.
3. Capture history behavior rules: trim, dedupe, cap(8), malformed-file fallback.

Exit gate:
- Baseline contract checklist is documented and used as migration parity target.

### Phase A2: Schema Baseline
Implementation mode:
- Mode: additive contract typing.
- Libraries:
  - `zod` (already in repo)

Steps:
1. Introduce bridge schema module for route payloads/results.
2. Align schema types with `src/gui/shared/types.ts`.
3. Mark any intentional tolerance (for backward compatibility) explicitly in schema comments.

Exit gate:
- All bridge routes have schema definitions and no unresolved contract ambiguity.

## Milestone B: Fastify Server Migration
### Phase B1: Server Bootstrap and API Routing
Implementation mode:
- Mode: mixed (framework migration + route parity).
- Libraries:
  - `fastify`
  - `zod`

Steps:
1. Replace custom `node:http` app with Fastify bootstrap.
2. Port existing API handlers to Fastify routes with schema-backed validation.
3. Preserve status codes and payload shape semantics.
4. Preserve NDJSON streaming behavior for `/api/run`.

Exit gate:
- Existing frontend can run against migrated server with no API contract changes.

### Phase B2: Static Assets and SPA Fallback
Implementation mode:
- Mode: framework plugin migration.
- Libraries:
  - `@fastify/static`

Steps:
1. Register static serving for `dist-gui`.
2. Keep API route precedence over static routes.
3. Implement SPA fallback for non-API GET routes.
4. Preserve current actionable error when built frontend assets are missing.

Exit gate:
- GUI static serving behavior is equivalent to current bridge behavior.

## Milestone C: Logger + History Store Refinement
### Phase C1: Logger Migration
Implementation mode:
- Mode: internal implementation swap.
- Libraries:
  - `pino`

Steps:
1. Replace custom append-file logger internals with `pino`.
2. Preserve file location contract: `<logsDir>/gui-server.log`.
3. Keep existing log call sites and severity intent (`info` / `error`).

Exit gate:
- Logs are emitted to expected path and bridge runtime behavior is unchanged.

### Phase C2: History Store Hardening (JSON + Zod Only)
Implementation mode:
- Mode: internal data-shape hardening.
- Libraries:
  - `zod`
  - Node built-ins (`fs/promises`, `path`)

Steps:
1. Keep JSON-file persistence (`history.json`) and remove ad-hoc shape assumptions.
2. Validate loaded file shape with Zod and recover safely to empty records on invalid content.
3. Preserve trim/dedupe/cap logic and write format compatibility.
4. Ensure malformed or partially-invalid files do not crash the bridge.

Exit gate:
- History behavior from user perspective is unchanged; reliability is improved.

## Milestone D: Test Hardening and Documentation
### Phase D1: Automated Tests
Implementation mode:
- Mode: regression and contract tests.
- Libraries:
  - existing `vitest`
  - existing `@playwright/test`

Steps:
1. Add integration tests for all bridge API routes.
2. Add stream tests for `/api/run` event ordering and final result delivery.
3. Add history-store tests for malformed JSON, dedupe, cap, and trim behavior.
4. Run Playwright GUI smoke to verify bridge/frontend integration.

Exit gate:
- Bridge contract tests and GUI smoke tests pass.

### Phase D2: Docs and Cleanup
Implementation mode:
- Mode: documentation alignment.
- Libraries: none required.

Steps:
1. Update docs with bridge stack decisions (Fastify, `@fastify/static`, `pino`, JSON+Zod history).
2. Remove obsolete implementation notes that reference replaced custom server internals.
3. Ensure docs reflect unchanged API contract and NDJSON run stream policy.

Exit gate:
- Documentation and implementation are consistent and review-ready.

## Test Cases and Scenarios
1. `GET /api/commands` returns `ok: true` and command list.
2. `GET /api/history`:
- missing `argKey` returns `400`
- valid `argKey` returns stable ordered values
3. `POST /api/history`:
- invalid payload returns `400`
- valid payload persists value with trim/dedupe/cap(8)
4. `POST /api/browse-path`:
- invalid payload returns `400`
- valid payload returns browse result parity
5. `POST /api/run`:
- invalid payload returns `400`
- valid payload streams expected NDJSON event sequence and final `result`
6. Static serving:
- existing assets served
- unknown non-API route falls back to `index.html`
- missing `dist-gui` emits actionable error response

## Assumptions and Defaults
- Fastify is the bridge server framework.
- History persistence remains JSON-file based; no database introduced.
- Zod is the only added validation layer for history store hardening.
- NDJSON transport for `/api/run` remains unchanged in this migration.
- Frontend behavior and API contracts are non-breaking constraints.
