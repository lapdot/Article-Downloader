# Docs Index

This directory now uses a simple split between active reference docs and historical planning docs.

## Active Reference Docs

Use these first:

- `policies/`
  - authoritative repo contracts
- `workflows/`
  - current operating procedures
- `architecture/`
  - current system structure
- `decisions/`
  - accepted design decisions and rationale

## Archive

These files are useful background, but they are not the current source of truth unless a newer active doc explicitly points back to them:

- `archive/gui-v1-plan.md`
- `archive/gui-v1-workflow.md`
- `archive/gui-v1-libraries.md`
- `archive/gui-v1-react-migration-workflow.md`
- `archive/gui-v2-plan.md`
- `archive/bridge-mature-library-plan.md`
- `archive/bridge-mature-library-workflow.md`

## Reading Order

For current project behavior:
1. `policies/`
2. `workflows/`
3. `architecture/`
4. `decisions/`

For implementation history and planning context:
1. archived plan and workflow docs in `archive/`

## Maintenance Rule

- Put current rules in `policies/`.
- Put current procedures in `workflows/`.
- Put stable structural explanation in `architecture/`.
- Put accepted rationale in `decisions/`.
- Avoid creating new root-level `docs/*.md` files for active policy unless they are clearly temporary planning material.
