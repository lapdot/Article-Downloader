# Architecture Overview

ArticleDownloader has three main surfaces:
- CLI entrypoints in `src/cli.ts`
- core runtime modules in `src/core/`
- GUI bridge and frontend in `src/gui/`

## Flow

Typical content flow:
1. Resolve runtime config and input paths
2. Download HTML
3. Parse HTML into metadata or Markdown
4. Optionally transform Markdown into Notion blocks
5. Optionally upload to Notion
6. Preserve artifacts for inspection and retry

## Main Areas

- `src/core/runtime-config.ts`: config resolution and precedence
- `src/core/fetcher.ts`: HTML acquisition
- `src/core/parser.ts`: parser-stage orchestration and source dispatch
- `src/adapters/`: source-owned detection, parser, metadata, and source-specific helpers
- `src/core/pipeline.ts`: end-to-end run orchestration
- `src/core/notion*.ts`: Notion transform and upload
- `src/gui/bridge/`: local bridge server, schemas, execution, and history
- `src/gui/frontend-react/`: React frontend

## Parser Stage Architecture

The parser stage is intentionally split between orchestration and source ownership:

- `src/core/parser.ts` validates the source URL and dispatches to a known source adapter in explicit order
- source adapters own source-native URL detection, content-kind detection, Markdown parsing, and metadata extraction
- shared parser helpers may exist for behavior that is truly cross-source, but source-specific DOM and cleanup rules should live with the source adapter
- this phase keeps adapter selection explicit in code rather than introducing a registry layer

Current phase-1 scope:

- canonical internal source identity exists for dispatch and future extensibility
- parser and metadata behavior are source-owned
- fetch normalization and verification remain source-specific concerns outside this parser-stage refactor unless a concrete source requires them
- naming unification, broad fetch capabilities, and broader source symmetry are follow-up work rather than part of this phase

## Source Of Truth

- Runtime behavior: `docs/policies/runtime-contract.md`
- Testing and safety: `docs/policies/testing-and-safety.md`
- GUI and bridge behavior: `docs/policies/gui-contract.md`
