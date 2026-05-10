# Local Development Workflow

This document describes the recommended local development loops for ArticleDownloader.

For the primary URL-to-artifacts review and refinement loop, see:
- `docs/workflows/url-driven-iteration.md`

For authoritative contracts, use:
- `docs/policies/runtime-contract.md`
- `docs/policies/testing-and-safety.md`
- `docs/policies/gui-contract.md`

## CLI Development

Install dependencies:

```bash
npm install
```

Run the default test suite:

```bash
npm test
```

Run the closed safety gate when you want a stricter local validation pass:

```bash
npm run test:closed-loop
```

Use the closed loop before merging changes that touch:
- runtime config resolution
- secrets handling
- networked flows

## GUI Development

Start the full GUI flow:

```bash
npm run gui
```

Start the built bridge only:

```bash
npm run build
npm run gui:build
npm run gui:server
```

Use custom directories when you want stronger separation for workspace, logs, history, or outputs:

```bash
npm run gui:build
npm run gui:server -- \
  --workspace-dir=/secure/workspace \
  --history-dir=/secure/gui-history \
  --logs-dir=/secure/gui-logs \
  --output-dir=/secure/artifacts/runtime
```

Directory controls:
- `--workspace-dir`: working directory for CLI subprocesses launched from the GUI
- `--history-dir`: where GUI history is stored as `history.json`
- `--logs-dir`: where GUI server logs are written as `gui-server.log`
- `--output-dir`: default output base for commands with `--out` when the form does not provide one

Recommended local artifact layout:
- `artifacts/runtime/`: program-generated runtime artifacts
- `artifacts/llm/sources/`: local source material for LLM-assisted workflows
- `artifacts/llm/work/`: temporary LLM scratch space
- `artifacts/llm/exports/`: final LLM-produced exports you want to keep outside runtime runs

Keep `.local/` for local operational state only:
- `.local/gui/history/`: GUI history storage
- `.local/gui/logs/`: GUI bridge logs

Open:

```text
http://localhost:8787
```

## Frontend Iteration Loop

For frontend work, use two terminals:

1. Start the bridge server:

```bash
npm run build && npm run gui:server
```

2. Start the Vite dev server:

```bash
npm run gui:dev
```

## GUI Script Entry Points

```bash
npm run gui
npm run gui:server
npm run gui:dev
npm run gui:build
npm run gui:test:e2e
```

## Notes

- The GUI is a thin wrapper over the CLI.
- Manual path input must always remain available.
- GUI path browsing is assistive, not authoritative.
- Use `npm run gui:test:e2e` for browser-level GUI validation.
