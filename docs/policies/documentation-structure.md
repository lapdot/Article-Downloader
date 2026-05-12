# Documentation Structure

This document defines the authoritative documentation-structure contract for ArticleDownloader.

If documentation entrypoints and this policy diverge, align the entrypoints to this document unless a newer repo decision supersedes it.

## 1. Goals

### 1.1 Primary goals
- Keep agent-first and human-first entrypoints distinct.
- Make repository navigation explicit for both agents and humans.
- Keep authoritative detail in canonical docs instead of duplicated top-level summaries.

### 1.2 Non-goals
- Defining a broad writing-style guide for all project documentation.
- Replacing runtime, testing, GUI, architecture, workflow, reference, or decision documents.

## 2. Top-Level Documentation Roles

### 2.1 `AGENTS.md`
- `AGENTS.md` is the portable cross-project agent guide.
- It should contain reusable agent working rules and one repository-specific handoff to `CONTEXT.md`.
- It is the preferred home for portable operating principles that can be reused across repositories.
- It must not carry repository-specific operational detail beyond that handoff.

### 2.2 `CONTEXT.md`
- `CONTEXT.md` is the top-level agent-first repository entrypoint.
- It should summarize repository purpose, primary surfaces, canonical commands, source-of-truth docs, reading order, and key repository-specific operating notes.
- It should stay concise and route readers to canonical docs rather than duplicating their full contents.

### 2.3 `README.md`
- `README.md` is the top-level human-first onboarding and usage entrypoint.
- It should explain what the project does, how to use it, and how to navigate deeper docs.
- It remains human-first even when it includes a documentation map.

### 2.4 `docs/README.md`
- `docs/README.md` is the index and taxonomy for the `docs/` tree.
- It should organize active reference docs, archive material, and recommended reading order inside `docs/`.
- It is not the top-level agent-first repository entrypoint.

## 3. Docs Tree Roles

### 3.1 `docs/reference/`
- `docs/reference/` is the home for command and API lookup material.
- It is the preferred home for human-first reference docs that are not themselves source-of-truth contracts.
- It should contain concise usage-oriented material and link to policies or workflows when those own deeper behavior.

### 3.2 `docs/workflows/`
- `docs/workflows/` is the home for current operating procedures.
- Workflow docs should describe repeatable processes and link to reference or policy docs instead of absorbing every command detail.

### 3.3 `docs/policies/`
- `docs/policies/` is the home for shared authoritative contracts.
- Policy docs define behavioral truth and should be the main owner of stable rules.

### 3.4 `docs/architecture/`
- `docs/architecture/` is the home for shared structural explanation.

### 3.5 `docs/decisions/`
- `docs/decisions/` is the home for accepted rationale and design choices.

## 4. Reference Contract

### 4.1 Required reference flow
- `AGENTS.md` points to `CONTEXT.md`.
- `CONTEXT.md` points to `README.md`, key canonical docs, and `docs/README.md`.
- `docs/README.md` routes readers deeper within `docs/`.

### 4.2 Handoff rule
- `AGENTS.md` should keep a single repository-specific handoff.
- The required handoff target is `CONTEXT.md`.

### 4.3 Canonical-doc routing rule
- `CONTEXT.md` should link directly to high-value canonical docs when they define current project behavior.
- `docs/README.md` may also be linked as the broader docs index, but it should not be the only route to core contracts.

### 4.4 Anti-duplication rule
- Top-level entrypoints should not each maintain their own competing navigation logic.
- Structural explanation should be centralized in this policy.
- Detailed behavioral truth should remain in the specific canonical policy, workflow, architecture, reference, or decision doc that owns it.

## 5. Content Boundaries

### 5.1 Portable vs repository-specific content
- Portable agent rules belong in `AGENTS.md`.
- Portable operating principles that are intended to survive reuse across repositories should also live in `AGENTS.md`.
- Repository-specific agent-first context belongs in `CONTEXT.md`.
- Human-first onboarding and usage content belongs in `README.md`.
- Internal docs-tree organization belongs in `docs/README.md`.

### 5.2 Summary boundary
- Top-level entrypoints may contain short summaries that help orientation.
- They should not duplicate detailed contracts already defined elsewhere.

### 5.3 Source-of-truth boundary
- Runtime behavior belongs in runtime policy docs.
- Testing and safety requirements belong in testing policy docs.
- GUI and bridge behavior belongs in GUI policy docs.
- Structural explanation belongs in architecture docs.
- Command and API lookup belongs in reference docs unless a policy or workflow owns that detail more specifically.
- Accepted rationale belongs in decision records.

## 6. Maintenance Rules

### 6.1 Coordinated updates
- When documentation structure changes, update all affected entrypoints together.
- If the structure contract changes, update this policy and every top-level file whose role or references are affected.

### 6.2 New root-level Markdown files
- New root-level Markdown files are discouraged by default.
- Add one only when its role cannot fit `README.md`, `CONTEXT.md`, or `docs/`.
- Any new root-level Markdown file should have an explicit, non-overlapping purpose and a brief justification in the change that introduces it.

### 6.3 Prefer canonical detail over duplicated summaries
- When a detailed rule already has a canonical home, top-level docs should link to it instead of restating it at length.
- If a summary becomes misleading or stale, reduce it and keep the canonical reference.

### 6.4 Tracked planning artifacts
- Substantial implementation work that is split into phases, batches, or likely sessions should have a tracked plan document in this repository's canonical planning location.
- For this repository, `docs/plans/` is the canonical location for active in-repo planning artifacts that support execution continuity across sessions.
- Tracked plan documents in `docs/plans/` should be updated as phases or batches complete so the stored plan reflects current status.

## 7. Validation Scenarios

### 7.1 Agent entry
- A new agent should be able to start at `AGENTS.md`, reach `CONTEXT.md`, and then find the key canonical docs needed for implementation work.

### 7.2 Human entry
- A human should be able to start at `README.md`, understand the project at a high level, and find deeper docs without using `AGENTS.md`.

### 7.3 Docs-tree navigation
- A reader entering through `docs/README.md` should understand that it is the index for `docs/`, not the top-level agent-first repository entrypoint.

### 7.4 Future maintenance
- A contributor should be able to decide whether a new document belongs in `README.md`, `CONTEXT.md`, `docs/reference/`, `docs/workflows/`, `docs/policies/`, `docs/architecture/`, `docs/decisions/`, or a rare new root-level file by using this policy alone.
