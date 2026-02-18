# GUI Wrapper V2 Plan (Remote-Capable)

## 1. Overview

This V2 plan extends the local V1 GUI to support remote backend execution while preserving V1 interfaces.

Primary objective:
- Support frontend/bridge and backend CLI on different machines.

Key UX priorities:
- Keep V1 interaction model stable.
- Add target-aware execution and browsing for remote backends.

Transport direction:
- SSH is the first remote transport.

## 2. Final Decisions (Locked)

### 2.1 Command scope
- V2 covers the full existing CLI command suite.

### 2.2 Frontend technology
- Frontend remains HTML-based web UI.

### 2.3 Frontend/backend relation
- Frontend/backend boundary remains protocol-agnostic.
- V2 concrete deployment:
  - Frontend (browser UI)
  - Local bridge process
  - SSH transport
  - Remote backend CLI execution

### 2.4 Execution model
- GUI remains a thin wrapper.
- Commands are executed by backend CLI, not reimplemented in GUI.

### 2.5 Argument history
- History granularity is per argument.
- History policy from V1 remains unchanged.

### 2.6 Path picker policy
- Path pickers remain non-enforced.
- GUI still never blocks execution by local existence checks.

### 2.7 Remote path browsing
- Do not parse raw `ls` output.
- Use backend CLI JSON browse command over SSH.
- Browse payload remains minimal:
  - `name`
  - `fullPath`
  - `kind` (`file | dir | symlink | other`)

## 3. High-Level Architecture

### 3.1 Components
1. Frontend (HTML UI)
- Dynamic command form rendering.
- Per-argument history dropdowns.
- Target selector (local vs remote profiles).
- Target-aware browse UI and run output.

2. Local Bridge
- Provides frontend-facing API.
- Stores target profiles.
- Calls pluggable executor (local/SSH).

3. Executor Adapters
- `LocalExecutor` (from V1).
- `SshExecutor` (new in V2).

4. Backend CLI (remote host)
- Existing commands remain authoritative.
- `browse-path` command used for remote listing.

### 3.2 Logical flow
- Frontend -> Local Bridge API -> SSH Executor -> Remote CLI -> Bridge -> Frontend.

## 4. Interface Contracts

### 4.1 Bridge API (frontend-facing)
- `GET /api/commands`
- `GET /api/history?argKey=<key>`
- `POST /api/history`
- `POST /api/run`
  - accepts optional target selection.
  - returns streamed run events.
- `POST /api/browse-path`
  - target-aware browse operation.
- `GET /api/targets`
- `POST /api/targets`
- `PATCH /api/targets/:id`
- `POST /api/targets/:id/activate`

### 4.2 Backend browse command
- `browse-path --path <dir>`
- Same JSON result contract as V1.

### 4.3 Types
- `TargetProfile`
- `ExecutorPort`
- `RunRequest` with optional `targetId`
- `BrowsePathRequest` with optional `targetId`

## 5. Implementation Steps

1. Introduce transport-agnostic executor port in bridge.
2. Keep V1 local executor under the new port (no behavior change).
3. Implement SSH executor for run and browse command paths.
4. Add target profile storage and activation APIs.
5. Extend frontend with target management and selection UX.
6. Wire run and browse calls to selected target.
7. Add robust SSH error classification and user messages.
8. Update documentation with SSH prerequisites and remote setup.

## 6. Testing Strategy

### 6.1 Unit tests
- SSH command assembly and escaping.
- Target profile validation/defaulting.
- Executor port behavior and error mapping.

### 6.2 Integration tests
- Target CRUD/activation endpoints.
- Remote run success/failure propagation.
- Remote browse-path behavior for normal and permission-denied paths.

### 6.3 Frontend tests
- Target selector behavior.
- Target switch impact on run/browse requests.
- Remote error messaging UX.

### 6.4 End-to-end smoke
- Local target regression checks (V1 parity).
- SSH target run and browse flow checks.

## 7. Acceptance Criteria

- Remote execution over SSH works end-to-end.
- Remote browse-path works via backend JSON command.
- Local mode remains functional and backward-compatible with V1 behavior.
- Frontend APIs remain stable with optional target extension.

## 8. Risks and Mitigations

1. SSH environment variability (host keys, auth, runtime path).
- Mitigation: explicit target config + clear diagnostics + setup docs.

2. Drift between CLI and GUI forms.
- Mitigation: shared command metadata source.

3. Remote browse errors (permissions/nonexistent paths).
- Mitigation: structured errors and manual-entry fallback.

## 9. Non-Goals (V2)

- Switching primary transport to HTTP.
- Desktop packaging as default runtime.
- Stat-heavy metadata browsing by default.
