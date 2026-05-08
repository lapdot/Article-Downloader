# ADR 0001: Config And Secrets Model

## Status

Accepted

## Decision

Store non-sensitive runtime configuration separately from secret material.

- Public config is committable.
- Secret values live in local secret files.
- Environment variables select paths, not secret payloads.

## Why

- Keeps repo-safe defaults easy to share.
- Reduces accidental secret leakage through shell history and logs.
- Makes path precedence explicit and testable.

## Consequences

- Commands must resolve both public and secret paths explicitly.
- Missing required paths fail clearly.
- README and tests must stay aligned with the path-resolution contract.
