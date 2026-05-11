# CLI Runtime

The CLI is the primary execution surface for ArticleDownloader and remains the source of truth for validation and failure semantics.

## Responsibilities

- Resolve config, secret paths, and runtime selectors
- Validate command-specific inputs
- Run the selected pipeline stage
- Emit JSON results on stdout
- Preserve relevant artifacts for debugging

## Key Modules

- `src/cli.ts`: command definitions and option parsing
- `src/core/runtime-config.ts`: effective runtime config resolution
- `src/core/pipeline.ts`: end-to-end orchestration
- `src/core/fetcher.ts`: HTML download strategies
- `src/core/parser.ts`: parser-stage orchestration
- `src/adapters/`: source-owned content extraction and metadata logic

## Contract Notes

- Core execution inputs come from explicit CLI parameters.
- Unknown flags fail fast.
- Strategy-dependent prerequisites are resolved from the effective runtime config.
- Parser-stage source selection is explicit in `src/core/parser.ts`; source-specific DOM parsing and metadata extraction stay in `src/adapters/`.

See `docs/policies/runtime-contract.md` for the authoritative contract.
