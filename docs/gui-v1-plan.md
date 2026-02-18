# GUI Wrapper V1 Plan (Local-Only)

## 1. Overview

This V1 plan is intentionally small: GUI and CLI run on the same computer.

Primary objective:
- Improve human input efficiency compared with direct CLI usage.

Key UX priorities:
- Per-argument recent input history.
- Path selection assistance.

Scope strategy:
- Deliver local-only execution now.
- Preserve basic interfaces so remote execution can be added in V2.

## 2. Final Decisions (Locked)

### 2.1 Command scope
- V1 covers the full existing CLI command suite.

### 2.2 Frontend technology
- Frontend is HTML-based.
- V1 runtime is a web UI.

### 2.3 Runtime topology
- Frontend and bridge are separated modules but both run locally.
- No remote backend in V1.

### 2.4 Execution model
- GUI remains a thin wrapper.
- Commands are executed by local CLI process, not reimplemented in GUI.

### 2.5 Argument history
- History granularity is per argument (not per full command string).
- History applies uniformly to command arguments.
- Secret policy: never store secret values; path strings are allowed.

### 2.6 Path picker policy
- Path pickers are non-enforced for all path argument types.
- GUI never blocks execution based on path existence.
- CLI remains source of truth for validation/errors.

### 2.7 Path browsing contract
- Use a backend JSON browse contract to support path listing.
- Implementation uses Node.js `readdir`/`Dirent`.
- V1 browse payload uses minimal entry shape:
  - `name`
  - `fullPath`
  - `kind` (`file | dir | symlink | other`)

## 3. High-Level Architecture

### 3.1 Components
1. Frontend (HTML UI)
- Dynamic command form rendering.
- Per-argument history dropdowns.
- Local path browse UI.
- Execution log and result display.

2. Local Bridge
- Provides frontend-facing API.
- Calls local CLI executor.
- Exposes browse/history/command metadata APIs.

3. Local CLI Executor
- Spawns local CLI command process.
- Streams stdout/stderr and exit status.

4. Backend CLI (local host)
- Existing commands remain authoritative.
- Adds JSON browse subcommand for path listing.

### 3.2 Logical flow
- Frontend -> Local Bridge API -> Local CLI -> Bridge -> Frontend.

## 4. Interface Contracts

### 4.1 Bridge API (frontend-facing)
- `GET /api/commands`
  - returns command descriptors for dynamic forms.
- `GET /api/history?argKey=<key>`
  - returns recent values.
- `POST /api/history`
  - updates recent values.
- `POST /api/run`
  - executes selected command locally.
  - returns streamed run events.
- `POST /api/browse-path`
  - returns directory entries from backend browse command.

### 4.2 Backend browse command
Proposed command:
- `browse-path --path <dir>`

Result shape:
- `ok`
- `path`
- `entries[]` where each entry has:
  - `name`
  - `fullPath`
  - `kind`
- `error` (if failed)

### 4.3 V2 extension point
- Keep executor interface transport-agnostic so V2 can add SSH without frontend API break.

## 5. Implementation Steps

1. Extract shared command metadata from CLI definitions.
- Keep current CLI behavior unchanged.
- Provide metadata output suitable for GUI rendering.

2. Build local bridge service.
- Implement command catalog, history, run endpoints.
- Implement streamed execution events.

3. Implement local CLI executor.
- Spawn CLI locally.
- Preserve stdout/stderr and exit code.
- Normalize runtime errors for GUI.

4. Add backend CLI browse subcommand.
- Implement with `readdir`/`Dirent`.
- Return stable JSON contract.
- Include error mapping for missing/denied paths.

5. Implement frontend command runner UI.
- Command selector + dynamic argument form.
- Per-argument recents for command arguments.
- Non-enforced path input and browse affordance.
- Run result/log panels.

6. Wire local path browsing.
- Frontend browse action calls bridge `browse-path` endpoint.
- Bridge executes local browse command.
- Frontend displays entries and writes selected path into input.

7. Persist history locally.
- Store in `.local/gui/history.json`.
- Deduplicate and cap count per argument.

8. Documentation updates.
- Add local GUI usage to README.
- Mention V2 remote plan as next phase.

## 6. Testing Strategy

### 6.1 Unit tests
- Command metadata mapping.
- History store behavior (dedupe, cap, read/write).
- Browse response normalization.

### 6.2 Integration tests
- Bridge endpoints contract tests.
- Run command success/failure and stream sequencing.
- Browse-path endpoint behavior on valid/invalid paths.

### 6.3 Frontend tests
- Dynamic form render from command descriptors.
- Per-argument history interaction.
- Non-enforced path UX (manual text always allowed).
- Browse picker insert behavior.

### 6.4 End-to-end smoke
- Execute representative commands through GUI bridge (local mode).
- Confirm parity with direct CLI behavior.

## 7. Acceptance Criteria

- All existing CLI commands are runnable from GUI locally.
- Browse-path works locally via JSON browse command.
- Path picker never hard-blocks execution.
- Per-argument history persists across sessions.
- Existing CLI contract behavior remains unchanged.

## 8. Risks and Mitigations

1. Drift between CLI options and GUI forms.
- Mitigation: shared command metadata source from CLI definitions.

2. Path browsing failures (permission denied/nonexistent path).
- Mitigation: structured error responses and fallback to manual input.

3. Secret leakage through logs/history.
- Mitigation: never store secret payloads; sanitize UI logging where needed.

## 9. Non-Goals (V1)

- SSH or any remote transport.
- HTTP remote backend transport.
- Desktop app packaging.
- Stat-heavy file browser metadata.
