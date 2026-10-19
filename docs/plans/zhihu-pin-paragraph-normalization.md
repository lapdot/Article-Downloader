# Zhihu Pin Paragraph Normalization Plan

## Status

Implemented on 2026-10-19. The parser converts Turndown's Zhihu-pin Markdown
hard-break representation into paragraph breaks after Markdown conversion.

## Problem

Zhihu pin pages commonly place the pin body in `span.RichText.ztext` and use
direct-child `<br>` elements between visually distinct paragraphs. The generic
Turndown conversion correctly renders `<br>` as a Markdown hard line break
(`"  \\n"`), but the resulting Markdown represents the entire pin as one logical
paragraph instead of several paragraphs.

Example source shape:

```html
<span class="RichText ztext">
  First pin paragraph.<br>
  Second pin paragraph.<br>
  Third pin paragraph.
</span>
```

Desired Markdown body:

```md
First pin paragraph.

Second pin paragraph.

Third pin paragraph.
```

## Scope and Contract

- Apply this normalization only while parsing a detected Zhihu `pin` source
  (`https://www.zhihu.com/pin/<id>`).
- Convert the hard-line-break sequence emitted by Turndown (`two spaces +
  newline`) into a Markdown paragraph boundary (`two newlines`).
- Preserve existing HTML extraction and generic Turndown conversion, including
  links, inline math, sticker emoji, images, and ordinary text.
- Retain standard Turndown hard-line-break behavior for all non-pin content.
- Do not alter source detection, metadata extraction, titles, the Markdown
  document wrapper, or Notion upload behavior.

The source restriction is intentional: it keeps the output-stage conversion
limited to the Zhihu pin content type rather than globally redefining Markdown
hard line breaks.

## Implementation Plan

### Phase 1: Add a pin-only Markdown normalization marker

Status: complete.

Targets: `src/adapters/zhihu.ts` and `src/adapters/parser-support.ts`.

1. Mark the extracted Zhihu pin context for output-stage hard-break conversion.
2. After the existing Turndown conversion, replace each `two spaces + newline`
   sequence in that marked body with two newlines.
3. Keep the source HTML untouched and do not add a global Turndown rule for
   `<br>`.

### Phase 2: Add focused parser coverage

Status: complete.

Target: `tests/fixtures/zhihu-pin.html` and
`tests/parser-zhihu.test.ts`.

1. Update or add a sanitized pin fixture with `<br>`-separated segments,
   including existing inline math and an image to verify that rich inline
   content survives the transform.
2. Assert the generated Markdown contains `\n\n` between consecutive pin
   segments.
3. Assert that the same boundary is not emitted as Turndown's hard-break form
   (`two spaces + \n`).
4. Add a regression case showing that a non-pin Zhihu answer with `<br>` keeps
   normal hard-break semantics, proving this feature cannot leak into other
   content types.

### Phase 3: Validate the runtime contract

Status: complete. Focused Zhihu parser tests, `npm test`, and
`npm run test:closed-loop` passed on 2026-10-19. The reported saved pin capture
was also re-parsed and now has blank-line-separated Markdown paragraphs at each
of its observed top-level `<br>` boundaries.

1. Run the focused Zhihu parser tests during development.
2. Run `npm test` after the changes.
3. Run `npm run test:closed-loop` as the final repository safety gate.
4. Manually compare the generated Markdown for the reported local capture
   against `page.html`: each observed top-level `<br>` should correspond to one
   blank line in `article.md`, while title, author, timestamp, math, and images
   remain unchanged.

## Files Expected to Change

- `src/adapters/zhihu.ts` — marks pin Markdown for output-stage normalization.
- `src/adapters/parser-support.ts` — performs the marked output-stage
  conversion after Turndown.
- `tests/fixtures/zhihu-pin.html` — sanitized fixture coverage if the current
  fixture is extended.
- `tests/parser-zhihu.test.ts` — precise paragraph-boundary and non-regression
  assertions.

No dependency is needed: Cheerio and Turndown already provide the DOM
selection, serialization, and Markdown conversion used by this parser.

## Acceptance Criteria

- A Zhihu pin with Turndown hard-break output yields blank-line-separated
  Markdown paragraphs.
- Pin inline content is preserved exactly through the existing Turndown rules.
- `<br>` conversion for answers/posts is unchanged.
- The complete test and closed-loop checks pass.
