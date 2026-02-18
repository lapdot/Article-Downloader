# Bridge-Only Mature Library Replacement Plan

## 1. Plan

### 1.1 Goal
Replace custom bridge infrastructure code with mature libraries while keeping GUI-visible behavior and CLI contract parity unchanged.

### 1.2 Scope
In scope:
1. `src/gui/bridge/server.ts`
2. `src/gui/bridge/history-store.ts`
3. `src/gui/bridge/logger.ts`
4. Bridge-related tests and docs

Out of scope:
1. Frontend architecture changes
2. Core parser/fetch/pipeline changes
3. CLI command contract changes

### 1.3 Current State (from code)
1. Custom `node:http` router and body parsing.
2. Manual static file serving and MIME mapping.
3. Manual NDJSON event writing for `/api/run`.
4. Manual JSON file history parsing/normalization.
5. Custom append-file logger.

### 1.4 Target Architecture
1. HTTP server: Fastify app + pluginized route modules.
2. Static serving: `@fastify/static` + SPA fallback for non-API GET routes.
3. Validation: Zod schemas for request/response boundaries.
4. Logging: `pino` file logger for structured bridge logs.
5. History store: JSON file persistence with Zod-only shape guard (no DB layer).

### 1.5 Contract Rules (must preserve)
1. API paths stay unchanged:
- `GET /api/commands`
- `GET /api/history?argKey=...`
- `POST /api/history`
- `POST /api/browse-path`
- `POST /api/run`
2. `/api/run` event semantics stay unchanged:
- event types: `started`, `stdout`, `stderr`, `exited`, `result`
3. History behavior stays unchanged:
- trim input
- dedupe per key
- max 8 records
4. GUI remains thin wrapper; CLI remains validation authority.

### 1.6 Implementation Notes
1. Keep NDJSON response format for `/api/run` in this bridge-only migration to avoid frontend changes.
2. Keep the same startup flags (`--port`, `--workspace-dir`, `--history-dir`, `--logs-dir`, `--output-dir`).
3. Preserve current error payload style where practical (`{ ok: false, error: ... }` for bridge-level failures).

## 2. External Libraries Summary

1. `fastify`
- Role: replace custom router/server lifecycle.
- Why: mature plugin model, typed handlers, strong TypeScript ergonomics.
- Reference: https://fastify.dev/
- Example:
```ts
const app = Fastify();
app.get("/api/commands", async () => ({ ok: true, commands }));
```

2. `@fastify/static`
- Role: static asset serving for `dist-gui`.
- Why: mature static serving plugin with predictable behavior.
- Reference: https://github.com/fastify/fastify-static
- Example:
```ts
await app.register(fastifyStatic, { root: FRONTEND_DIST_ROOT });
```

3. `zod`
- Role: bridge request/response schema validation.
- Why: already used in repo; reuse-first and contract-focused.
- Reference: https://zod.dev/
- Example:
```ts
const RunReq = z.object({ command: z.string(), args: z.record(z.unknown()) });
```

4. `pino`
- Role: replace manual logger implementation.
- Why: structured logging, mature ecosystem, low overhead.
- Reference: https://getpino.io/
- Example:
```ts
const logger = pino(pino.destination(path.join(logsDir, "gui-server.log")));
```

5. JSON file + `zod` (history persistence policy)
- Role: keep file-based history storage and replace manual parsing/normalization with schema-validated load/save.
- Why: matches current requirements, minimal dependency surface, keeps behavior deterministic.
- Reference: https://zod.dev/
- Example:
```ts
const HistorySchema = z.object({
  records: z.record(z.array(z.string())).default({}),
});
const parsed = HistorySchema.safeParse(JSON.parse(raw));
```

## 3. Workflow (Milestones -> Phases -> Steps)

### Milestone A: Bridge Contract Freeze
Phase A1: Contract inventory
1. Capture current response shapes for all `/api/*` routes.
2. Capture `/api/run` stream event sequence and payload examples.
3. Capture history persistence rules (dedupe/cap/trim).

Phase A2: Type/scheme baseline
1. Add bridge schema module (`src/gui/bridge/schemas.ts`) using Zod.
2. Map schemas to existing `src/gui/shared/types.ts`.

Exit gate:
1. Contract snapshot doc/tests exist and reflect current behavior.

### Milestone B: Fastify Server Migration
Phase B1: App bootstrap and routing
1. Introduce Fastify app factory in bridge server module.
2. Port `/api/commands`, `/api/history`, `/api/browse-path`, `/api/run` routes.
3. Keep existing status codes and payload semantics.

Phase B2: Static serving migration
1. Register `@fastify/static` for `dist-gui`.
2. Implement SPA fallback for non-API GET routes.
3. Preserve existing “frontend assets not found” behavior.

Exit gate:
1. Bridge runs with Fastify and existing frontend works without changes.

### Milestone C: Logger and History Store Migration
Phase C1: Logger
1. Replace custom `createGuiLogger` internals with `pino`.
2. Keep log file path contract (`<logsDir>/gui-server.log`).

Phase C2: History store
1. Keep JSON file storage and refactor load/save with Zod validation.
2. Keep normalization behavior and failure fallback semantics.
3. Add Zod validation for loaded data shape.

Exit gate:
1. History behavior and logging paths are unchanged from user perspective.

### Milestone D: Test Hardening and Docs
Phase D1: Tests
1. Add bridge integration tests for each route contract.
2. Add history behavior tests (trim/dedupe/cap/malformed file).
3. Keep Playwright bridge-related smoke passing.

Phase D2: Documentation
1. Update README bridge notes with new library stack.
2. Add migration notes and rationale in `docs/`.

Exit gate:
1. Tests pass and docs match shipped bridge behavior.

## 4. Test Cases and Scenarios
1. `GET /api/commands` returns complete descriptors and `ok: true`.
2. `GET /api/history`:
- missing `argKey` -> `400`
- valid key -> ordered values
3. `POST /api/history`:
- invalid body -> `400`
- valid body -> value persisted with dedupe+cap
4. `POST /api/browse-path`:
- invalid body -> `400`
- valid path -> structured browse result
- invalid path -> failure payload shape remains compatible
5. `POST /api/run`:
- invalid request -> `400`
- valid request -> NDJSON stream with expected event ordering and final `result`
6. Static routes:
- existing asset -> served
- missing asset route -> SPA fallback
- no built assets -> actionable error response

## 5. Assumptions and Defaults
1. Fastify is the bridge server choice.
2. JSON file + Zod-only validation is the history store choice.
3. NDJSON transport remains for this migration phase.
4. No frontend contract changes are allowed in this bridge-only scope.
