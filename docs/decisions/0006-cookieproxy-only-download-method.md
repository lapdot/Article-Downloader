# ADR 0006: Cookieproxy As The Only Supported Download Method For Now

## Status

Accepted

## Supersedes

- [0002-cookieproxy-default.md](./0002-cookieproxy-default.md)

## Decision

`DownloadMethod` remains a first-class runtime concept, and runtime still resolves an effective download method from public inputs.

The currently supported concrete method set is exactly:

- `"cookieproxy"`

The project intentionally preserves both:

- the internal logic that resolves the effective `DownloadMethod`
- the current user-facing selectors that feed that logic, including CLI, public config, and GUI surfaces

This preserved choice logic is future-facing design, not leftover transition code.

## Why

- The runtime still benefits from one explicit place that resolves download behavior.
- The public contract should continue to expose `downloadMethod` consistently across CLI, config, and GUI.
- Future download methods are still plausible, and keeping the selection seam makes that extension deliberate instead of disruptive.
- The old `http` implementation and its cookie-only support were dead operational paths and should not remain as dormant complexity.

## Consequences

- `downloadMethod` remains part of the public contract, but only `"cookieproxy"` is valid today.
- `"http"` is removed as a supported method and must fail validation early and explicitly.
- The `http` transport implementation and cookie-only support surfaces are removed.
- Future methods must be introduced through a new ADR plus coordinated code, test, GUI, and documentation updates.
