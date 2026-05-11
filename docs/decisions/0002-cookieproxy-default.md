# ADR 0002: Cookieproxy As Default Download Method

## Status

Superseded by [0006-cookieproxy-only-download-method.md](./0006-cookieproxy-only-download-method.md)

This ADR is retained only as historical context for the earlier transition to a cookieproxy-default runtime.

## Decision

Use `cookieproxy` as the built-in default `downloadMethod`.

## Why

- Keeps the default acquisition path aligned with the current local toolchain.
- Allows some flows to avoid direct cookie loading in the Node runtime.
- Matches the current operational expectation of the repo.

## Consequences

- Strategy-dependent prerequisite rules must remain explicit.
- README, tests, GUI behavior, and policy docs must stay aligned when download strategy behavior changes.
