# ArticleDownloader Agent Guide

## Project

ArticleDownloader is a Node.js + TypeScript project for downloading article pages, parsing them into Markdown, and optionally uploading the result to Notion.

Primary surfaces:
- CLI: `src/cli.ts`
- Core runtime: `src/core/`
- GUI bridge/frontend: `src/gui/`

## Canonical Commands

- `npm test`
- `npm run test:closed-loop`
- `npm run gui:test:e2e`

## Source Of Truth

- Runtime contract: `docs/policies/runtime-contract.md`
- Testing and safety: `docs/policies/testing-and-safety.md`
- GUI contract: `docs/policies/gui-contract.md`
- Human onboarding: `README.md`

## Working Rules

- Treat CLI/runtime behavior as the source of truth; the GUI is a thin wrapper.
- Preserve explicit, deterministic error behavior.
- Update tests and docs together with contract changes.
- Preserve upstream artifacts when downstream stages fail.
- Prefer targeted changes over broad rewrites unless the task explicitly calls for structural work.
