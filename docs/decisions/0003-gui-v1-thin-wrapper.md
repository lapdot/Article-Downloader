# ADR 0003: GUI V1 As Thin Wrapper

## Status

Accepted

## Decision

Keep the GUI as a thin local wrapper over the CLI.

## Why

- Preserves a single source of truth for validation and failure semantics.
- Reduces drift between terminal and browser flows.
- Lets the frontend focus on usability rather than reimplementing backend rules.

## Consequences

- Bridge APIs expose metadata and execution, not alternate business rules.
- Path browsing remains assistive and non-enforcing.
- Contract changes should land in the CLI and runtime first, then flow into the GUI.
