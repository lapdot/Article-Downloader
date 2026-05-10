# ADR 0004: Canonical URL Policy For Substack Aggregator Inputs

## Status

Accepted

## Decision

For supported Substack aggregator inputs like `https://substack.com/@<author>/p-<id>`, runtime currently prefers the publication-host canonical article URL as `download.finalUrl` when it can be resolved reliably.

Current accepted behavior:

- aggregator URLs are supported inputs
- runtime may resolve the publication-host canonical article URL through the fetched shell plus a Substack posts lookup
- when canonical resolution succeeds, runtime prefers that publication-host article URL as `download.finalUrl`
- if canonical refetch fails but the lookup payload includes sufficient article content, runtime may continue with synthetic article HTML while still reporting the canonical article URL

This is a current policy choice, not a permanent invariant. It may be revisited later if product expectations change.

## Why

- Aggregator URLs and publication URLs can represent the same post while returning different fetched HTML shapes.
- The publication-host canonical URL is currently the more stable article identity for metadata and downstream artifacts.
- Keeping one preferred final article identity reduces ambiguity when parser outputs and metadata are compared across runs.

## Consequences

- Fetch support for Substack may include normalization beyond the original input URL.
- `download.finalUrl` may differ from the original aggregator input even when `cookieproxy` is the effective download method.
- The runtime contract should state the behavior briefly, while this ADR carries the rationale and tradeoff.
- If the policy changes later, README, workflow docs, tests, and runtime-contract wording must be updated together.
