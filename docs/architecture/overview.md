# Architecture Overview

ArticleDownloader has three main surfaces:
- CLI entrypoints in `src/cli.ts`
- core runtime modules in `src/core/`
- GUI bridge and frontend in `src/gui/`

## Flow

Typical content flow:
1. Resolve runtime config and input paths
2. Download HTML and apply any source-owned fetch normalization
3. Parse HTML into metadata or Markdown
4. Optionally transform Markdown into Notion blocks
5. Optionally upload to Notion
6. Preserve artifacts for inspection and retry

## Main Areas

- `src/core/runtime-config.ts`: config resolution and precedence
- `src/core/fetcher.ts`: fetch-stage orchestration and generic transport execution
- `src/core/parser.ts`: parser-stage orchestration and source dispatch
- `src/adapters/`: source-owned detection, fetch normalization, parser, metadata, and source-specific helpers
- `src/core/pipeline.ts`: end-to-end run orchestration
- `src/core/notion*.ts`: Notion transform and upload
- `src/gui/bridge/`: local bridge server, schemas, execution, and history
- `src/gui/frontend-react/`: React frontend

## Parser Stage Architecture

The parser stage is intentionally split between orchestration and source ownership:

- `src/core/parser.ts` validates the source URL and reuses a shared explicit source-resolution helper before dispatching to source-owned capabilities
- source adapters own source-native URL detection, canonical `sourceId/contentType` detection, Markdown parsing, and metadata extraction
- `src/adapters/resolve-source.ts` centralizes static adapter imports and explicit source resolution order without introducing a registry layer
- shared parser helpers may exist for behavior that is truly cross-source, but source-specific DOM and cleanup rules should live with the source adapter
- this phase keeps adapter selection explicit in code rather than introducing a registry layer

Current baseline:

- canonical internal source identity exists for dispatch and future extensibility
- current canonical identities are:
  - Zhihu answer: `sourceId: "zhihu"`, `contentType: "answer"`
  - Zhihu pin: `sourceId: "zhihu"`, `contentType: "pin"`
  - Zhihu post: `sourceId: "zhihu"`, `contentType: "post"` for `zhuanlan.zhihu.com/p/...`
  - Substack post: `sourceId: "substack"`, `contentType: "post"`
- parser and metadata behavior are source-owned
- fetch normalization is now a source-owned capability alongside parser and metadata behavior
- no standalone verification capability is part of the current runtime surface
- current test posture keeps shared orchestration smoke coverage thin while most source-specific behavior is exercised in source-owned Zhihu and Substack suites
- integration coverage includes at least one fetch-plus-parse smoke path for each currently supported source family
- remaining follow-up refactor work is centered on source-logic cleanup outside adapters rather than broad test reorganization

## Fetch Stage Architecture

The fetch stage is also split between orchestration and source ownership:

- `src/core/fetcher.ts` owns generic transport behavior, the effective `downloadMethod` seam, cookieproxy execution, and low-level result shaping
- `src/core/fetcher.ts` reuses the same shared source-resolution helper before invoking any optional source-owned fetch normalization
- source adapters may optionally normalize a fetched result when a supported input URL first returns a shell or wrapper page
- source adapters may normalize from either a shell-level canonical pointer already embedded in the fetched HTML or a source-specific lookup flow when the shell does not expose enough direct information
- this keeps source-specific fetch behavior with the same source module that already owns parsing and metadata logic
- the current concrete transport set contains only `cookieproxy`, but the runtime intentionally keeps explicit effective-method resolution for future extensibility

## Source Of Truth

- Runtime behavior: `docs/policies/runtime-contract.md`
- Testing and safety: `docs/policies/testing-and-safety.md`
- GUI and bridge behavior: `docs/policies/gui-contract.md`
