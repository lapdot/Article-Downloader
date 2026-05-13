# ADR 0007: Escape Plain-Text Fields In Synthetic HTML

## Status

Accepted

## Decision

When an adapter constructs synthetic HTML from plain-text website fields, it must escape those fields before interpolating them into the generated HTML.

Current accepted behavior:

- text inserted into HTML text nodes must escape `&`, `<`, and `>`
- text inserted into HTML attributes must escape `&`, `"`, `<`, and `>`
- fields that the adapter intentionally treats as trusted HTML body content must not be text-escaped

For example, a plain-text title like:

```txt
Markets <b>explode</b> & "risk-on"
```

should be escaped when inserted into a generated heading:

```html
<h1>Markets &lt;b&gt;explode&lt;/b&gt; &amp; "risk-on"</h1>
```

and escaped for attribute context when inserted into generated metadata:

```html
<meta property="og:title" content="Markets &lt;b&gt;explode&lt;/b&gt; &amp; &quot;risk-on&quot;" />
```

By contrast, original source HTML that intentionally contains markup should remain HTML before conversion:

```html
<h1>Markets <b>explode</b> & "risk-on"</h1>
```

The HTML-to-Markdown transform can then preserve that semantic markup as Markdown such as:

```md
# Markets **explode** & "risk-on"
```

## Why

- Synthetic HTML fallbacks may combine raw HTML body content with plain-text metadata from structured data, preload data, API-like responses, or other non-DOM fields.
- Plain-text fields such as titles, subtitles, author names, canonical URLs, and metadata values should not be allowed to change generated HTML structure.
- Escaping by insertion context preserves literal text while still allowing explicitly trusted body HTML, such as Substack `body_html`, to render as HTML.

## Consequences

- This rule applies to any source adapter that constructs HTML from plain-text website fields, not only Substack.
- Adapters that only consume original webpage HTML and pass it through the parser/Turndown path do not need this synthetic-HTML escaping rule for that path.
- If similar synthetic HTML construction is added for another source, the adapter should reuse or extract shared text-node and attribute escaping helpers instead of interpolating plain-text fields directly.
