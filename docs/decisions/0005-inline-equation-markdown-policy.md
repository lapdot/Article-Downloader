# ADR 0005: Preserve Dollar-Delimited Inline Equations In Notion Transform

## Status

Accepted

## Decision

Keep the current `transform-notion` behavior where dollar-delimited inline Markdown spans are preserved as inline equations in the generated Notion block output.

Current accepted behavior:

- the Markdown-to-Notion transform relies on `@tryfabric/martian`
- Martian interprets `$...$` spans as inline equations
- ArticleDownloader currently preserves that interpretation instead of normalizing or escaping dollar-delimited spans before transform
- HTML-to-Markdown source adapters must escape literal dollar signs from ordinary text as `\$` before this transform sees them

This means intentional source math may still use dollar-delimited Markdown, while literal dollar signs from HTML text or plain-text metadata should be protected upstream.

## Why

- Inline-equation support is useful and already present in the current transform path.
- Preserving the library's default interpretation keeps the Notion transform simple and predictable for math-like Markdown inputs.
- A Markdown-to-Notion mitigation for currency-style dollar spans would add custom parsing policy on top of the library and could interfere with intentional equation content.
- Escaping literal dollars during HTML-to-Markdown keeps the source distinction explicit: trusted math conversion emits `$...$`, and ordinary text emits `\$`.

## Implementation Note

There are two Markdown-generation paths that need separate escaping:

- HTML fragments passed to `turndownService.turndown(...)` are handled by Turndown. For this path, ArticleDownloader customizes Turndown's `escape()` hook so ordinary HTML text nodes receive Turndown's normal Markdown escaping plus literal dollar escaping.
- Plain-text fields manually interpolated into Markdown, such as generated headings and author link labels, do not pass through Turndown. These fields must use the shared plain-text Markdown escape helper before interpolation.

This distinction is based on whether text is passed through Turndown, not on whether the original input is a complete HTML document or a fragment.

## Consequences

- Markdown and Notion block output may differ when input Markdown already contains unescaped dollar-delimited spans that Martian interprets as equations.
- In generated Markdown, literal dollars from ordinary HTML text should appear escaped so downstream Notion rich text preserves them as literal `$` characters.
- If product expectations change later, the transform wrapper, tests, and docs should be updated together.
