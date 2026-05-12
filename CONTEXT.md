# Repository Context

ArticleDownloader is a Node.js + TypeScript project for downloading article pages, parsing them into Markdown, and optionally uploading the result to Notion. This file is the top-level agent-first repository context entrypoint for ArticleDownloader.

## Primary Surfaces

- CLI: `src/cli.ts`
- Core runtime: `src/core/`
- GUI bridge/frontend: `src/gui/`

## Canonical Commands

- `npm test`
- `npm run test:closed-loop`
- `npm run gui:test:e2e`

## Source Of Truth

- Documentation structure: `docs/policies/documentation-structure.md`
- Runtime contract: `docs/policies/runtime-contract.md`
- Testing and safety: `docs/policies/testing-and-safety.md`
- GUI contract: `docs/policies/gui-contract.md`
- Architecture overview: `docs/architecture/overview.md`
- Docs index: `docs/README.md`
- Human-first quickstart: `README.md`
- CLI reference: `docs/reference/cli-usage.md`
- Library API reference: `docs/reference/library-api.md`

## Reading Order

- For documentation structure and entrypoint roles, start with `docs/policies/documentation-structure.md`.
- For runtime behavior and error semantics, start with `docs/policies/runtime-contract.md`.
- For test expectations and operational safety, read `docs/policies/testing-and-safety.md`.
- For GUI and bridge behavior, read `docs/policies/gui-contract.md`.
- For system structure and flow, read `docs/architecture/overview.md`.
- For broader doc navigation, use `docs/README.md`.

## Repo-Specific Operating Notes

- Treat CLI and core runtime behavior as the source of truth; the GUI is a thin wrapper.
- Preserve upstream artifacts when downstream stages fail.
