# GUI V1 Implementation Workflow (Local-Only)

## Summary
This workflow translates `docs/gui-v1-plan.md` into an execution sequence with clear gates.
Order is designed to reduce rework: contracts first, runtime core second, UI third, then hardening.

## Public Interfaces and Type Targets
Define and freeze these early for V1:
- Bridge APIs:
  - `GET /api/commands`
  - `POST /api/run` (streamed events)
  - `GET /api/history?argKey=...`
  - `POST /api/history`
  - `POST /api/browse-path`
- CLI addition:
  - `browse-path --path <dir>`
- Shared types:
  - `GuiCommandDescriptor`, `GuiArgDescriptor`
  - `GuiRunRequest`, `GuiRunEvent`, `GuiRunResult`
  - `BrowsePathRequest`, `BrowsePathResult`

## Phase 0: Baseline and Guardrails
Implementation mode:
- Mode: from scratch.
- Libraries: none required.

- Confirm current CLI tests are green as baseline.
- Create GUI module boundaries:
  - `src/gui/bridge/*`
  - `src/gui/frontend/*`
  - `src/gui/shared/*`
- Reconfirm V1 constraints:
  - local-only execution
  - non-enforced path picker
  - CLI remains validation authority

Exit gate:
- Contract/type skeleton exists and is documented.

## Phase 1: Command Metadata Source
Implementation mode:
- Mode: from scratch.
- Libraries: none required.

- Extract/centralize CLI command metadata used by GUI.
- Ensure metadata includes command name, args, requiredness, and argument kind.
- Keep existing CLI behavior unchanged.

Exit gate:
- `GET /api/commands` returns complete descriptors for all CLI commands.

## Phase 2: Bridge Core + Local Executor
Implementation mode:
- Mode: mixed.
- From scratch:
  - local executor abstraction and event mapping (`started`, `stdout`, `stderr`, `exited`, `result`)
  - request-to-CLI argument mapping
- Libraries:
  - `express` or `fastify` for local bridge API server
  - `zod` for bridge request/response validation
  - Node built-ins: `child_process` for local CLI execution

- Implement bridge server and core middleware.
- Implement local executor with streamed events:
  - `started`, `stdout`, `stderr`, `exited`, `result`
- Implement `POST /api/run` mapping request to local CLI invocation.

Exit gate:
- Command execution via API returns ordered stream and final status.

## Phase 3: History Subsystem
Implementation mode:
- Mode: from scratch.
- Libraries:
  - no new external library required
  - Node built-ins: `fs/promises` for `.local/gui/history.json`
- Optional library:
  - `zod` for history file shape validation and safe parsing

- Implement `.local/gui/history.json` storage.
- Add dedupe and max-size policy per argument key.
- Implement `GET /api/history` and `POST /api/history`.

Exit gate:
- Repeated runs show stable per-argument recents across restarts.

## Phase 4: Path Browsing Contract
Implementation mode:
- Mode: from scratch.
- Libraries:
  - no new external library required
  - Node built-ins: `fs/promises.readdir` + `Dirent`
- Optional library:
  - `zod` for browse response validation

- Add CLI `browse-path --path <dir>` using `readdir`/`Dirent`.
- Implement bridge `POST /api/browse-path` to call browse command.
- Return minimal entry shape:
  - `name`, `fullPath`, `kind`

Exit gate:
- Browse endpoint returns structured results for valid/missing/denied paths.

## Phase 5: Frontend Command Runner
Implementation mode:
- Mode: mixed.
- From scratch:
  - command-to-form rendering logic
  - run log panel behavior
  - non-enforced path input behavior
- Libraries:
  - `react` + `react-dom` for UI implementation
- Optional libraries:
  - `react-hook-form` for form state handling
  - `@tanstack/react-query` for API state/caching
  - `eventsource-parser` if SSE is used for streaming events

- Build dynamic form from `GET /api/commands`.
- Wire per-argument history dropdowns.
- Add path browse button with manual editable input.
- Wire run action and live output panel.

Exit gate:
- End-to-end GUI flow works locally for representative commands.

## Phase 6: Hardening and Docs
Implementation mode:
- Mode: mostly from scratch.
- Libraries:
  - no new mandatory library
- Optional libraries:
  - `supertest` for bridge API regression/integration tests
  - `playwright` for browser E2E regression tests

- Add consistent error normalization and user-readable states.
- Update README with V1 local GUI usage and V2 note.
- Explicitly document:
  - non-enforced picker behavior
  - CLI as source of truth

Exit gate:
- Tests and docs match shipped behavior.

## Test Cases and Scenarios

### Unit
Implementation mode:
- Mode: from scratch tests using existing test runner.
- Libraries:
  - existing `vitest`

- Descriptor mapping completeness.
- History read/write, dedupe, cap, malformed-file recovery.
- Browse response normalization.

### Integration
Implementation mode:
- Mode: mixed.
- Libraries:
  - `vitest` (existing)
  - optional `supertest` for API-level integration ergonomics

- `POST /api/run` stream ordering and non-zero exit propagation.
- `POST /api/browse-path` for valid/missing/permission-denied paths.
- `GET/POST /api/history` persistence correctness.

### Frontend
Implementation mode:
- Mode: from scratch test cases.
- Libraries:
  - test framework selected with frontend stack; keep minimal in V1

- Dynamic form rendering from descriptors.
- Argument history insertion and overwrite behavior.
- Non-enforced path behavior (manual input always allowed).

### E2E Smoke
Implementation mode:
- Mode: optional in V1 baseline; recommended before release.
- Libraries:
  - optional `playwright`

- Run representative commands (`fetch`, `parse`, `run`) via GUI path.
- Verify expected parity with direct CLI behavior.

## Milestones
1. Milestone A: contracts + bridge run path.
2. Milestone B: history + browse-path.
3. Milestone C: frontend end-to-end local flow.
4. Milestone D: hardening, tests, and docs.

## Assumptions and Defaults
- Same-machine runtime for frontend, bridge, and CLI.
- No remote transport in V1.
- GUI never enforces path existence checks.
- Existing CLI semantics and errors remain unchanged.
- Executor abstraction stays transport-agnostic for V2 SSH extension.
