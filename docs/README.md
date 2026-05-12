# Docs Index

This directory uses a simple split between active reference docs and historical planning docs.

Top-level repository context for agent readers lives in `../CONTEXT.md`. Use this file as the index once you are already navigating within `docs/`.

Documentation structure and role boundaries are governed by `policies/documentation-structure.md`.

## Active Reference Docs

Use these first:

- `reference/`
  - human-first command and API lookup
  - `cli-usage.md`: CLI command reference and examples
  - `library-api.md`: exported package surface and public types
- `workflows/`
  - primarily human-first operating procedures
  - `url-driven-iteration.md`: primary URL-to-artifacts review and refinement loop
  - `add-a-new-source.md`: workflow for onboarding a new supported source
  - `local-dev.md`: local setup, test, and GUI operating loops
- `policies/`
  - shared authoritative contracts
- `architecture/`
  - shared structural explanation
- `decisions/`
  - shared rationale and accepted design choices

## Archive

These files are useful background, but they are not the current source of truth unless a newer active doc explicitly points back to them:

- `archive/gui-v1-workflow.md`
- `archive/gui-v1-react-migration-workflow.md`
- `archive/bridge-mature-library-workflow.md`

## Reading Order

For current project behavior:
1. `policies/`
2. `workflows/`
3. `reference/`
4. `architecture/`
5. `decisions/`

Recommended additions for this repo's current source work:
- read `reference/cli-usage.md` for command-by-command CLI usage
- read `reference/library-api.md` for exported package surface
- read `workflows/add-a-new-source.md` when onboarding a supported source
- read `architecture/overview.md` for the current parser-stage orchestration and source-adapter structure
- read `decisions/0006-cookieproxy-only-download-method.md` for the current download-method policy
- read `decisions/0004-substack-canonical-url-policy.md` for the current Substack canonical-URL choice
- read `decisions/0005-inline-equation-markdown-policy.md` for the current Markdown-to-Notion inline-equation behavior

For implementation history and planning context:
1. archived plan and workflow docs in `archive/`

## Maintenance Rule

- Put command and API lookup docs in `reference/`.
- Put current procedures in `workflows/`.
- Put current rules in `policies/`.
- Put stable structural explanation in `architecture/`.
- Put accepted rationale in `decisions/`.
- Avoid creating new root-level `docs/*.md` files for active policy unless they are clearly temporary planning material.
