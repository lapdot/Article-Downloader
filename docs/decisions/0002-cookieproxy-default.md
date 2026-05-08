# ADR 0002: Cookieproxy As Default Download Method

## Status

Accepted

## Decision

Use `cookieproxy` as the built-in default `downloadMethod`.

## Why

- Keeps the default acquisition path aligned with the current local toolchain.
- Allows some flows to avoid direct cookie loading in the Node runtime.
- Matches the current operational expectation of the repo.

## Consequences

- Strategy-dependent prerequisite rules must remain explicit.
- README, tests, GUI behavior, and policy docs must stay aligned when download strategy behavior changes.
