# Architecture Overview

ArticleDownloader has three main surfaces:
- CLI entrypoints in `src/cli.ts`
- core runtime modules in `src/core/`
- GUI bridge and frontend in `src/gui/`

## Flow

Typical content flow:
1. Resolve runtime config and input paths
2. Download or ingest HTML
3. Parse HTML into metadata or Markdown
4. Optionally transform Markdown into Notion blocks
5. Optionally upload to Notion
6. Preserve artifacts for inspection and retry

## Main Areas

- `src/core/runtime-config.ts`: config resolution and precedence
- `src/core/fetcher.ts`: HTML acquisition
- `src/core/parser.ts`: HTML to metadata and Markdown parsing
- `src/core/ingest.ts`: fixture ingest workflow
- `src/core/capture-fixture.ts`: fetch-plus-ingest fixture workflow
- `src/core/pipeline.ts`: end-to-end run orchestration
- `src/core/notion*.ts`: Notion transform and upload
- `src/gui/bridge/`: local bridge server, schemas, execution, and history
- `src/gui/frontend-react/`: React frontend

## Source Of Truth

- Runtime behavior: `docs/policies/runtime-contract.md`
- Testing and safety: `docs/policies/testing-and-safety.md`
- GUI and bridge behavior: `docs/policies/gui-contract.md`
