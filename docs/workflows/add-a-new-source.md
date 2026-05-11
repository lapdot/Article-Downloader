# Add A New Source Workflow

This document describes the recommended workflow for adding support for a new article source.

Use this when the project already has the basic URL-to-artifacts pipeline, but a new site or source family needs to be supported end to end.

For authoritative contracts, use:
- `docs/policies/runtime-contract.md`
- `docs/policies/testing-and-safety.md`

## Goal

Add support for a new source in a way that keeps fetch, parse, test, and documentation behavior aligned.

## Source-Onboarding Checklist

1. Identify the supported URL families.
   - List the real input URL shapes the source uses.
   - Decide which URL families count as supported inputs and which should remain unsupported.

2. Confirm the default fetch strategy first.
   - Use `cookieproxy` as the default acquisition path unless there is a concrete reason to choose another method.
   - Do not redesign fetch policy just because a new source is being added.

3. Collect real HTML artifacts through the normal URL-driven workflow.
   - Start from a real source URL.
   - Generate local `page.html`, `metadata.json`, `article.md`, and `notion-blocks.json` artifacts where possible.
   - Inspect the fetched HTML before assuming parser changes are needed.

4. Decide whether the source needs parser-only support or fetch-time normalization too.
   - Parser-only support is enough when the fetched HTML already contains the real article document.
   - Fetch-time normalization is needed when a supported input URL fetches an intermediate shell, reader page, or other non-article wrapper.
   - If the shell already contains a canonical post payload, prefer normalizing from that payload before adding a second network lookup.

5. Add runtime support in the narrowest layer that solves the problem.
   - Add URL-family detection for the source.
   - Define a canonical internal source identity as a `sourceId/contentType` pair before spreading source-specific branching across the runtime.
   - Add parser and metadata behavior for the actual article document shape in a source-owned adapter under `src/adapters/`.
   - Only add fetch-time normalization if parser support alone is not enough.
   - Keep `src/core/parser.ts` focused on orchestration and dispatch rather than source-native DOM logic.
   - Keep `src/core/fetcher.ts` focused on generic transport execution; source-specific normalization should live with the source adapter.

6. Add tests before considering the source complete.
   - Cover URL detection.
   - Cover markdown parsing and metadata extraction.
   - Cover any fetch-time normalization or fallback behavior introduced for the source.
   - Prefer source-focused parser tests over expanding a single mixed cross-source parser fixture suite.
   - Keep at least one CLI-level smoke test when the source becomes a real supported surface.

7. Run the full validation loop and update docs together.
   - Run `npm test`
   - Run `npm run test:closed-loop`
   - Update README, workflow docs, and policy docs together with the final behavior.

## Stage Diagnosis

Use the generated artifacts to locate the real problem before changing code.

- If `page.html` is wrong:
  - treat it as a fetch-stage issue
  - inspect the download method, network path, cookies, redirects, and shell-vs-article behavior

- If `page.html` is usable but `metadata.json` or `article.md` is wrong:
  - treat it as a parser-stage issue
  - inspect source detection, selectors, cleanup rules, and structured-data fallbacks inside the relevant source adapter

- If Markdown is correct but Notion blocks are wrong:
  - treat it as a transform-stage issue
  - inspect Markdown-to-block conversion rather than fetch or parser logic

## Substack Example

Substack was added by following this pattern:

- support both aggregator and publication URL families
- keep `cookieproxy` as the default fetch method
- inspect fetched HTML artifacts first
- add fetch-time normalization because some aggregator URLs returned a reader shell instead of article HTML
- prefer a preloaded canonical post payload when the shell already exposes it
- prefer the publication-host canonical article URL when normalization succeeds
- add parser, fetcher, adapter, and CLI-level tests before updating docs

## Parser Refactor Note

The current parser-stage architecture uses explicit source adapters instead of a registry. When adding a source:

- define source detection and parser-stage capabilities in `src/adapters/`
- keep canonical identity naming source-aware so content kinds are not treated as global labels across unrelated sources
- keep source-specific helpers with that source whenever possible
- add source-focused tests rather than extending a single cross-source parser test file indefinitely
- keep parser-stage changes narrow; only move into fetch-time normalization when parser-only support is insufficient
- keep naming compatibility unless the change is an intentional contract update
