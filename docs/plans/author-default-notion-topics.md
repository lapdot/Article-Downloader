# Author Default Notion Topics Plan

## Goal

Extend the experimental author-to-Notion enrichment flow so a whitelisted author can supply one or more default Notion topics. When that author is matched and Notion author upload is enabled, the created page should receive both its existing `Author` multi-select value and the author's configured default values in the `Topics` multi-select property.

The first configured example is `saechia`, whose default topic is `Thailand`. The configuration and upload payload must support more than one topic for any single author.

This document is planning-only. It does not change runtime behavior by itself.

## Status

Implemented on 2026-10-19. The author whitelist accepts ordered default topics, the pipeline emits them to the configurable `Topics` multi-select property, and examples, documentation, and regression coverage are updated. Legacy whitelist compatibility remains unchanged.

## Current Baseline

- `src/core/author.ts` validates the public author whitelist and resolves a matched entry to `HtmlCanonicalAuthor`.
- `src/core/pipeline.ts` uses that match to construct the `Author` multi-select Notion page property when both `experimental.author.enabled` and `experimental.author.notionUpload.enabled` are true.
- The current whitelist's Notion destination is `platforms.notion.destination.name`.
- The page-property transport in `src/core/notion-upload.ts` already accepts multiple arbitrary Notion properties and forwards them unchanged to the Notion API.

## Proposed Configuration Contract

Add an optional `topics` array to an author's Notion destination capability:

```json
{
  "id": "saechia",
  "canonicalName": "Saechia",
  "platforms": {
    "zhihu": {
      "source": {
        "names": ["Saechia"],
        "urls": ["https://www.zhihu.com/people/xielida"]
      }
    },
    "notion": {
      "destination": {
        "name": "saechia",
        "topics": ["Thailand"]
      }
    }
  }
}
```

`topics` is optional. When supplied, it must be a non-empty array of non-blank strings. Its values retain their configured order and are emitted as individual Notion `multi_select` entries. This supports, for example, `"topics": ["Thailand", "Southeast Asia"]` without any additional schema changes.

Add `experimental.author.notionUpload.topicsPropertyName` to public runtime configuration. It is optional and resolves to `Topics`; like the existing author property, its target must be a pre-existing Notion multi-select property. Topic injection uses the existing `notionUpload.enabled` gate—there is no separate gate—so disabled author enrichment continues to leave all page properties unchanged.

## Implementation Plan

### 1. Carry configured topics through the author domain model

Update `src/types.ts` so `AuthorPlatformDestination` can hold `topics?: string[]`, and so `HtmlCanonicalAuthor` includes the resolved default topics needed by the upload stage.

Update the Zod schemas in `src/core/author.ts` to validate the optional array at `platforms.notion.destination.topics`. Keep current source alias matching unchanged. When an entry matches, return the configured topics together with the existing canonical and Notion author names.

Keep legacy compatibility behavior unchanged: legacy entries do not have topics and therefore normalize with no default topics. Do not add topics to the legacy schema or migration command; users add them after migrating into the current platform-capability format.

### 2. Configure the Notion Topics property name

Extend `ExperimentalAuthorPublicConfig`, `ResolvedExperimentalAuthorConfig`, `publicConfigSchema`, and `resolveRuntimeConfig` with `notionUpload.topicsPropertyName`.

Use `Topics` as the resolved default, while preserving the existing `Author` default and `multi_select` type. Continue rejecting unsupported property types before pipeline execution. Update the disabled fallback configuration in `src/core/pipeline.ts` so it contains the resolved topics property default too.

### 3. Build one combined Notion page-property payload

Refactor the author-specific property helper in `src/core/pipeline.ts` into a small, explicit builder that receives the resolved author-upload config and matched author metadata.

The builder should:

- return `undefined` when no whitelisted author was matched;
- preserve the existing `Author: { multi_select: [{ name }] }` property when a Notion author name is available;
- add `Topics: { multi_select: [{ name: topic1 }, { name: topic2 }] }` when the matched author has one or more default topics, using `topicsPropertyName` as the property key;
- omit only the absent property when an author has a name but no topics (or vice versa in a future schema evolution), rather than suppressing the whole payload.

Pass this combined payload through the existing `uploadNotionBlocksToNotion` call. No changes are needed to Notion API retrying, block appending, or failure handling: a rejected property payload must continue to surface as the existing Notion upload failure.

### 4. Update examples and behavioral documentation

Update `config/authors.example.json` so the existing `saechia` entry declares `"topics": ["Thailand"]` in its Notion destination.

Update `config/public.config.example.json` to show `topicsPropertyName: "Topics"` next to the current author property configuration.

Update the experimental-author policy in `docs/policies/runtime-contract.md`, the `run` behavior in `docs/reference/cli-usage.md`, and the concise setup explanation in `README.md` to state:

- topics come from a matched whitelist author's Notion destination;
- Topics is a multi-select property and defaults to the name `Topics`;
- multiple default topics are supported;
- the Notion database must already contain matching multi-select properties;
- unmatched authors and authors without configured topics leave the Topics property unset.

Update `docs/reference/library-api.md` if public type descriptions enumerate `HtmlCanonicalAuthor` or the author-destination fields in enough detail to require the new field.

### 5. Add focused regression coverage

Update `tests/author.test.ts` to verify validation and matching preserve a multiple-topic list in order, alongside the existing no-topic behavior and legacy normalization.

Update `tests/runtime-config.test.ts` to cover the default `Topics` property name, an explicit override, and schema rejection for invalid topic-property configuration as applicable.

Update `tests/pipeline-run-upload.test.ts` to assert the Notion page creation input for:

- `saechia` produces both `Author: [{ name: "saechia" }]` and `Topics: [{ name: "Thailand" }]`;
- an author with two configured defaults produces both topic entries in the `Topics` multi-select array;
- a matched author without topics continues to send only the current Author property;
- an unmatched author continues to send no author/topic page properties.

Retain the existing `tests/notion-upload.test.ts` forwarding coverage; add a direct two-property payload assertion there only if it improves confidence that neither property is transformed by the upload boundary.

## Validation

- Run `npm test`.
- Run `npm run test:closed-loop`.
- Load the updated example public config and author whitelist through the normal runtime-config and author-whitelist readers.
- Inspect the mocked Notion `pages.create` payloads to confirm the `Author` and `Topics` keys use independent `multi_select` arrays and preserve configured multi-topic order.

## Scope Boundaries

- This feature assigns configured defaults only; it does not infer topics from article content.
- It does not create, rename, or validate Notion database property definitions remotely.
- It does not alter author matching logic, source adapters, or the existing default-off experimental feature gate.
- It does not retrofit topics into legacy whitelist format; legacy files remain readable without topic defaults during the existing compatibility window.
