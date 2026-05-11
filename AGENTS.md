# Agent Guide

This file is intended to be portable across repositories.

For repository-specific machine context, read `CONTEXT.md`.

## Working Model

- Start with the repository-specific machine entrypoint before making assumptions about project structure or behavior.
- Treat the most specific documented contract as the source of truth for runtime behavior, interfaces, and safety expectations.

## General Operating Principles

- Preserve explicit and deterministic behavior unless a requested change updates that contract.
- Keep high-frequency and user-facing errors actionable: state what failed, where the system looked or what input it used, and what the next corrective action is.
- Update tests and docs together when behavior or interfaces change.
- Prefer targeted changes over broad rewrites unless the task clearly calls for structural work.
- Preserve useful upstream artifacts and intermediate outputs when downstream work fails, unless the project explicitly documents a different rule.
- Prefer mature, well-maintained third-party libraries for domain-specific problems by default instead of building from scratch.
- Build from scratch only when a library is a poor fit, too heavy for the need, introduces unacceptable maintenance or security risk, or the problem is genuinely narrow and project-specific.

## Planning Expectations

- For substantial feature plans that introduce a new dependency or materially rely on third-party libraries, include a short libraries section.
- In that libraries section, name the main third-party libraries you plan to use and where each library will be used.
- For substantial multi-phase, multi-batch, or likely multi-session work, write the plan into the repository under `docs/plans/`.
- Update tracked plan docs in `docs/plans/` as phases or batches complete so future sessions can continue from current state.

## Validation

- Run the project's canonical checks when they are relevant to the change.
- Keep wrapper layers aligned with the core runtime or backend contract instead of inventing separate behavior.
