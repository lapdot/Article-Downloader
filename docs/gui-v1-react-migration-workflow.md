# GUI V1 React Migration Workflow (Local-Only)

## Summary
This workflow is the execution guide for the upcoming GUI migration from static frontend assets to a React + Vite + MUI frontend, while keeping the existing bridge API contract stable.

Primary constraints:
- V1 remains local-only.
- CLI remains the behavior and validation authority.
- Path picker remains non-enforced (manual input is always allowed).
- Existing bridge routes remain unchanged:
  - `GET /api/commands`
  - `GET /api/history?argKey=...`
  - `POST /api/history`
  - `POST /api/browse-path`
  - `POST /api/run`

## Phase 0: Baseline and Freeze

### Steps
1. Confirm baseline tests pass (`npm test`).
2. Snapshot current GUI behavior and note parity targets:
- command selection
- dynamic args rendering
- per-arg history loading/saving
- run stream rendering
3. Freeze contract assumptions:
- no bridge API shape changes
- no CLI contract changes
- no filesystem mutation features in picker

### Exit gate
- Baseline behavior and non-goals are documented for parity checks.

## Phase 1: Frontend Tooling Bootstrap

### Steps
1. Add frontend toolchain:
- `react`, `react-dom`
- `vite`, `@vitejs/plugin-react`
- `@mui/material`, `@emotion/react`, `@emotion/styled`
2. Create frontend app structure (example):
- `src/gui/frontend-react/main.tsx`
- `src/gui/frontend-react/App.tsx`
- `src/gui/frontend-react/theme.ts`
- `src/gui/frontend-react/api/*`
- `src/gui/frontend-react/components/*`
3. Add frontend scripts to package commands:
- `gui:dev`
- `gui:build`
- `gui:test:e2e` (placeholder until Playwright phase)
4. Keep bridge runtime as API server authority (`npm run gui` remains server entrypoint).

### Exit gate
- React app can run in dev mode and build static assets successfully.

## Phase 2: Bridge Static Serving Integration

### Steps
1. Update bridge static serving strategy in `src/gui/bridge/server.ts`:
- keep `handleApi` precedence unchanged
- serve built frontend assets for non-API routes
- keep `/api/*` behavior unchanged
2. Add SPA fallback for non-API GET requests to frontend `index.html`.
3. Validate compatibility with current local options:
- `--workspace-dir`
- `--history-dir`
- `--logs-dir`
- `--output-dir`

### Exit gate
- Bridge serves new frontend assets without API regressions.

## Phase 3: Descriptor Contract Extension

### Steps
1. Extend GUI arg descriptor types:
- `pathMode?: "file" | "dir"`
- `inputMode?: "name" | "text"`
2. Update descriptor inference rules in shared metadata:
- map path flags to `file`/`dir` modes
- map `--fixture` to `inputMode: name` and non-path behavior
3. Validate downstream usage in frontend form renderer.

### Exit gate
- Descriptor payload is explicit enough to drive picker behavior with no ambiguous flag inference in UI.

## Phase 4: App Shell and Core Parity

### Steps
1. Implement React app shell:
- command selector
- description/help area
- args form container
- run output panel
2. Port command loading and argument rendering from current frontend logic.
3. Port run flow and NDJSON stream handling.
4. Port history load/save behavior for string args.

### Exit gate
- React UI matches current non-picker behavior and run output parity.

## Phase 5: Path Picker Overhaul (Critical UX)

### Steps
1. Remove prompt-based picker flow from UI behavior.
2. Implement modal-primary picker using MUI Dialog:
- current path display
- up navigation
- directory/file entry list
- selection state
- apply/cancel actions
- inline error rendering
3. Implement inline fallback picker panel for constrained contexts.
4. Enforce mode-aware selection:
- `pathMode=file`: select files; directories navigate
- `pathMode=dir`: select directories
5. Preserve non-enforced policy:
- manual text entry always editable
- execution never blocked by picker-side existence checks
6. Hide browse affordance for non-path inputs (notably `--fixture`).

### Exit gate
- Picker is usable without browser prompts and supports modal + inline fallback with manual override.

## Phase 6: Accessibility and Interaction Quality

### Steps
1. Add keyboard behavior:
- `Esc` closes modal
- `Enter` confirms valid selection / navigates focused directory
- arrow key list navigation
2. Ensure focus management:
- focus trap in modal
- predictable return focus to triggering input
3. Add visible focus states and clear selected-row styling.
4. Verify mobile/narrow viewport behavior for inline fallback.

### Exit gate
- Picker interaction is keyboard-usable and stable on desktop/mobile widths.

## Phase 7: Playwright Regression Baseline

### Steps
1. Add Playwright test setup and scripts.
2. Add baseline E2E specs:
- app load and command list render
- argument form rerender on command change
- modal picker open/navigate/select/apply
- inline fallback behavior on narrow viewport
- run stream visibility and completion summary
3. Add negative picker scenario:
- browse-path error shown inline
- manual path can still be applied

### Exit gate
- Playwright baseline passes reliably in local CI flow.

## Phase 8: Documentation and Cleanup

### Steps
1. Ensure README GUI section matches shipped commands and behavior.
2. Ensure V1 docs remain aligned:
- plan
- libraries
- workflow files
3. Remove obsolete frontend assets only after parity and tests pass.
4. Keep V2 remote notes untouched.

### Exit gate
- Docs and implementation are consistent; obsolete assets removed only after verified replacement.

## Acceptance Criteria
- GUI frontend is React + Vite + MUI.
- Bridge API contract remains unchanged.
- Prompt-based path picker is removed.
- Modal-primary picker with inline fallback is shipped.
- Manual path entry is always allowed and non-enforced.
- `--fixture` is treated as non-path input in UI.
- Playwright baseline covers critical GUI behavior.

## Suggested Delivery Milestones
1. Milestone A: Phases 0-2 complete (tooling + bridge serving).
2. Milestone B: Phases 3-4 complete (descriptor + app parity).
3. Milestone C: Phases 5-6 complete (picker UX + accessibility).
4. Milestone D: Phases 7-8 complete (E2E baseline + docs cleanup).
