# Substack Future Work

This note tracks Substack improvements that are intentionally deferred for now.

Current supported baseline:

- detect both supported Substack URL families
- normalize aggregator URLs to publication-host articles when possible
- parse metadata and markdown from publication pages, aggregator pages, and preload fallbacks
- preserve a synthetic article fallback when canonical-page refetch fails after a successful lookup

Deferred improvements:

- broaden fixture coverage for more Substack layout variants such as multi-author bylines and caption-heavy posts
- improve markdown fidelity for captions, embedded media, and other rich-content edge cases
- evaluate whether canonical publication URLs should remain the preferred final article identity for aggregator inputs
- consider more explicit operational guidance for running `cookieproxy` outside restricted sandboxes when DNS resolution is unavailable

This document is planning-only. It does not change the current runtime contract.
