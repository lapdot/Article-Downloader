# Author Platform Configuration Migration Plan

## Goal

Replace the author configuration's source-only model with a platform-capability model. A platform may be a source, a destination, or both. In the current runtime, Notion is a destination only; the schema must allow it to become a source later without another structural migration.

This document is planning-only. It does not change runtime behavior by itself.

## Status

Implemented on 2026-10-19. The platform-capability schema, legacy compatibility reader, migration command, examples, documentation, and validation coverage described below are complete. Notion ingestion remains explicitly out of scope.

## Target Configuration Shape

```json
{
  "authors": [
    {
      "id": "trita-parsi",
      "canonicalName": "Trita Parsi",
      "platforms": {
        "substack": {
          "source": {
            "handles": ["tritaparsi"],
            "names": ["Trita Parsi"],
            "urls": ["https://substack.com/@tritaparsi"]
          }
        },
        "notion": {
          "destination": {
            "name": "Trita Parsi"
          }
        }
      }
    }
  ]
}
```

The `source` and `destination` objects are independent capabilities. A future Notion source can be represented without changing the outer shape:

```json
"notion": {
  "source": { "...": "future source identity" },
  "destination": { "name": "Trita Parsi" }
}
```

`handles` remains a Substack-specific source alias. The matcher derives it from `substack.com/@<handle>` URLs, allowing author identity to remain stable when byline text or publication-host URLs differ.

## Implementation Plan

### 1. Define platform-capability types and validation

Update `src/types.ts` and `src/core/author.ts` to replace `AuthorSourceAliases` and `AuthorWhitelistEntry.sources` with types representing:

- `platforms.<platform>.source`: optional source aliases (`handles`, `names`, `urls`)
- `platforms.<platform>.destination`: optional destination-specific identity

For the initial implementation, validate known source platforms (`substack`, `zhihu`) and the `notion` destination. Keep platform-specific destination fields minimal: Notion needs only `name` today.

Replace `notionName` with `platforms.notion.destination.name` in the canonical configuration. Preserve the current `HtmlCanonicalAuthor` result shape only as needed for downstream Notion upload, resolving its Notion label from the destination capability.

### 2. Preserve matching and upload behavior

Update matching in `src/core/author.ts` to obtain aliases from `entry.platforms[sourceId]?.source`. The current matching semantics must remain unchanged:

- Substack matches normalized names, profile URLs, and handles inferred from source and homepage URLs.
- Zhihu matches normalized names and profile URLs.
- Unsupported source IDs do not match an author.

Resolve the Notion multi-select value from `entry.platforms.notion?.destination?.name` so the upload flow remains destination-driven rather than relying on a root-level Notion field.

### 3. Add a migration command

Add an explicit CLI command, proposed as `migrate-author-config`:

```bash
npx tsx src/cli.ts migrate-author-config \
  --input ./config/authors.json \
  --out ./config/authors.v2.json
```

The command must:

- read and validate the legacy author configuration;
- convert each `sources.<platform>` value to `platforms.<platform>.source`;
- convert `notionName` to `platforms.notion.destination.name`;
- preserve `id`, `canonicalName`, alias arrays, author ordering, and valid unrelated top-level data where the schema permits it;
- validate the converted document against the new schema before writing it;
- refuse to overwrite an existing output file unless `--force` is explicitly supplied;
- produce actionable failures for unreadable input, invalid legacy configuration, invalid output, conflicting fields, and mixed schema entries.

The migration must write to a separate output path by default; it must never modify the input file in place implicitly.

### 4. Provide a one-release compatibility window

Continue accepting a wholly legacy author file for one release. Normalize it in memory through the same conversion function used by the migration command, so legacy and migrated files produce identical author matching and Notion upload behavior.

Reject an author entry that mixes legacy (`sources` or `notionName`) and new (`platforms`) fields. Do not silently merge ambiguous configurations.

When a legacy file is read, emit a deprecation warning that states the config path and gives the migration command. New examples and newly created configurations must use only `platforms`.

At the next major-compatible cleanup point, remove legacy acceptance and the warning while retaining the migration command as a user-facing maintenance tool if it remains useful.

### 5. Update examples, tests, and documentation

Update `config/authors.example.json` to the new structure, including an explicit Notion destination for every example author.

Update types, test fixtures, and assertions in:

- `tests/author.test.ts`
- `tests/parser-zhihu.test.ts`
- `tests/parser-substack.test.ts`
- `tests/pipeline-run-upload.test.ts`
- CLI tests covering the new migration command

Add focused coverage for:

- source matching from the new platform structure;
- destination-only Notion configuration;
- a platform that may contain both source and destination capabilities;
- lossless legacy conversion for Substack and Zhihu aliases;
- migration of `notionName`;
- legacy/new configurations producing identical match and upload outcomes;
- mixed-schema rejection;
- no-overwrite behavior and explicit `--force` behavior;
- errors for malformed legacy input and invalid migrated output.

Update `README.md`, `docs/reference/cli-usage.md`, and `docs/reference/library-api.md` with the new schema, a before/after migration example, compatibility-window behavior, and the migration command.

## Validation

- Run `npm test`.
- Run `npm run test:closed-loop`.
- Manually run the migration command against a copied legacy fixture and confirm the output validates and leaves the input unchanged.
- Confirm the updated `config/authors.example.json` can be loaded when experimental author deduction is enabled.

## Scope Boundaries

This work prepares the configuration model for future Notion ingestion. It does not add a Notion source adapter, Notion article parsing, or a new content-source ID in the current change.
