# ADR 0005: Preserve Dollar-Delimited Inline Equations In Notion Transform

## Status

Accepted

## Decision

Keep the current `transform-notion` behavior where dollar-delimited inline Markdown spans are preserved as inline equations in the generated Notion block output.

Current accepted behavior:

- the Markdown-to-Notion transform relies on `@tryfabric/martian`
- Martian interprets `$...$` spans as inline equations
- ArticleDownloader currently preserves that interpretation instead of normalizing or escaping dollar-delimited spans before transform

This includes cases where a source Markdown string may look like currency or another non-math phrase but still matches dollar-delimited inline-equation syntax.

## Why

- Inline-equation support is useful and already present in the current transform path.
- Preserving the library's default interpretation keeps the Notion transform simple and predictable for math-like Markdown inputs.
- A local mitigation for currency-style dollar spans would add custom parsing policy on top of the library and could interfere with intentional equation content.

## Consequences

- Markdown and Notion block output may differ when Markdown contains dollar-delimited spans that Martian interprets as equations.
- This behavior is currently treated as a feature of inline-equation support, not as a transform bug.
- If product expectations change later, the transform wrapper, tests, and docs should be updated together.
