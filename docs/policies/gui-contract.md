# GUI Contract

This document defines the authoritative GUI and bridge contract for the local-only V1 surface.

## 1. Runtime And Topology

- GUI V1 is a first-class local runtime:
  - frontend, bridge, and CLI run on the same machine
- Bridge API is the GUI contract surface for V1:
  - `GET /api/commands`
  - `GET /api/history?argKey=...`
  - `POST /api/history`
  - `POST /api/browse-path`
  - `POST /api/run`
- Frontend assets are served by the bridge from built output artifacts.
- Bridge server implementation is Fastify-based, using `fastify` and `@fastify/static`.
- Default bridge directories are:
  - output artifacts: `artifacts/runtime/`
  - local history: `.local/gui/history/`
  - local logs: `.local/gui/logs/`
- GUI may help users trigger the same URL-to-artifact flow as the CLI, but CLI/runtime artifact meanings remain the source of truth.

## 2. GUI Execution Model

- GUI remains a thin wrapper over existing CLI behavior.
- CLI remains the source of truth for validation and failure semantics.
- GUI-side input assistance must not add local enforcement that changes CLI contract outcomes.

## 3. GUI Argument Metadata

- GUI argument descriptors carry UI semantics beyond CLI option shape:
  - `valueHint`
  - `pathMode` with values `file | dir`
  - `inputMode` with values `name | text`
- Explicitly non-path arguments, for example `--fixture`, must not expose path-browse affordances.
- Static GUI descriptor metadata must not imply stronger runtime requirements than the CLI and runtime actually enforce.
- Dynamic GUI hint contracts are allowed when effective config changes useful runtime context.
- `downloadMethod` remains a GUI-visible selector even though the current allowed value set is only `cookieproxy`.
- GUI-visible fields and runtime-required fields are different contracts and must be treated separately.

## 4. Path Picker Interaction

- Path picker is modal-first with inline fallback for constrained contexts.
- Manual path input must remain available at all times.
- Path picker is non-enforced:
  - GUI must never block execution based on local path existence checks.
- Prompt-based browser dialogs are not part of the shipped V1 picker interaction model.

## 5. GUI Tooling And Script Contract

- V1 GUI frontend stack is:
  - React
  - Vite
  - MUI with Emotion
- GUI script contracts in `package.json` are policy-level entrypoints:
  - `gui`
  - `gui:server`
  - `gui:dev`
  - `gui:build`
  - `gui:test:e2e`
- Documentation and CI or test guidance must stay aligned with these script names.
- The canonical built-GUI startup path must ensure both backend bridge artifacts in `dist/` and frontend assets in `dist-gui/` are fresh before serving.
- Stale built artifacts are treated as an operational contract risk.

## 6. GUI Testing Baseline

- GUI behavior coverage includes both unit or integration and browser E2E layers.
- Bridge contract regression tests are required in `npm test` for:
  - API route contracts
  - dynamic hint behavior when config resolution changes effective runtime context
  - history persistence behavior, including trim, dedupe, cap, and malformed-file fallback
- Browser E2E baseline is maintained via Playwright and exercised through:
  - `npm run gui:test:e2e`
- Baseline GUI E2E scenarios must cover at least:
  - command rendering and switching
  - path picker modal interaction
  - inline fallback behavior
  - browse error visibility with manual-path fallback
  - run-flow output smoke
- Browser E2E and bridge tests should avoid unintentionally reusing stale servers or stale built assets.
- `npm test` and GUI E2E are complementary gates; one does not replace the other.

## 7. Bridge Request And Response Validation

- Bridge route boundaries are schema-validated with Zod.
- Invalid request payloads must fail with explicit `400` responses and stable error shapes.

## 8. Bridge Run-Stream Transport

- `POST /api/run` transport is NDJSON:
  - `Content-Type: application/x-ndjson; charset=utf-8`
  - line-delimited JSON event records
- Event contract remains:
  - `started`
  - `stdout`
  - `stderr`
  - `exited`
  - `result`
- Transport format changes require explicit versioning and migration documentation.

## 9. Bridge Logging And History Persistence

- Bridge logging backend uses `pino` with file sink at:
  - `<logsDir>/gui-server.log`
- Persisted GUI logs and bridge-surfaced diagnostics must not expose secret values or secret file paths.
- GUI history persistence remains file-based through `history.json`, not database-backed.
- History file loading must be schema-guarded with Zod and fall back safely to empty records on malformed content.
- By default, GUI operational state stays under `.local/gui/`, while user-facing generated artifacts belong under `artifacts/runtime/`.
