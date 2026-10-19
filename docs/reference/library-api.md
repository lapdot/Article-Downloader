# Library API

This document is the exported package surface reference for ArticleDownloader.

The package entrypoint re-exports runtime helpers, Notion helpers, config readers, and public types from `src/index.ts`.

For runtime behavior that must stay aligned with CLI behavior, see `../policies/runtime-contract.md`.

## Import

```ts
import {
  downloadHtml,
  downloadPdf,
  parseHtmlToMarkdown,
  parseHtmlToMetadata,
  markdownToNotionBlocks,
  uploadNotionBlocksToNotion,
  runPipeline,
  fetchYoutubeTranscript,
  resolveRuntimeConfig,
} from "article-downloader";
```

## Exported Functions

- `downloadHtml`: fetch HTML for a supported URL with the effective download method.
- `downloadPdf`: fetch a PDF through the same cookieproxy transport core and save it to a caller-provided output directory.
- `parseHtmlToMarkdown`: parse fetched HTML into Markdown for a supported source URL.
- `parseHtmlToMetadata`: extract article metadata from fetched HTML.
- `markdownToNotionBlocks`: convert Markdown into Notion block JSON.
- `markdownToNotionBlocksMartian`: lower-level Markdown-to-Notion conversion helper.
- `uploadNotionBlocksToNotion`: upload generated Notion block JSON to a Notion database.
- `resolveRuntimeConfig`: load and resolve public config, secrets config, and effective runtime selectors.
- `readPublicConfig`: read public config JSON directly.
- `readNotionSecretsConfig`: read Notion secrets JSON directly.
- `readAuthorWhitelist`: read a current or legacy author whitelist; legacy files are normalized and emit a deprecation warning.
- `parseAuthorWhitelist`: validate a current or legacy author whitelist already held in memory.
- `migrateLegacyAuthorWhitelist`: convert a validated legacy author whitelist to the platform-capability schema.
- `runPipeline`: run the end-to-end URL-to-artifacts pipeline with downstream Notion upload.
- `fetchYoutubeTranscript`: fetch a YouTube transcript through the production Python helper and write Markdown/runtime artifacts using fixed Node-facing defaults.

## Exported Public Types

Key exported types include:

- config and runtime types:
  - `PublicConfig`
  - `NotionSecretsConfig`
  - `ResolvedRuntimeConfig`
  - `DownloadMethod`
- stage input and result types:
  - `DownloadInput`
  - `DownloadResult`
  - `PdfDownloadInput`
  - `PdfDownloadResult`
  - `ParseInput`
  - `ParseResult`
  - `MetadataInput`
  - `MetadataResult`
  - `UploadInput`
  - `UploadResult`
  - `PipelineInput`
  - `PipelineResult`
  - `YoutubeTranscriptInput`
  - `YoutubeTranscriptMetadata`
  - `YoutubeTranscriptResult`
  - `YoutubeTranscriptSnippet`
- metadata and source identity types:
  - `HtmlMetadata`
  - `HtmlCanonicalAuthor`
  - `AuthorWhitelist`
  - `AuthorWhitelistEntry`
  - `AuthorPlatform`
  - `AuthorPlatformDestination`
  - `AuthorPlatforms`
  - `SourceIdentity`
  - `SourceId`
  - `ZhihuContentType`
  - `ZhihuSourceIdentity`
  - `SubstackSourceIdentity`
  - `ForeignAffairsContentType`
  - `ForeignAffairsSourceIdentity`
  - `SelectorSet`

## Usage Notes

- Treat CLI/runtime contract docs as the authority for config precedence and failure semantics.
- Treat source-specific parsing behavior as adapter-owned and subject to the current supported-source set.
- When changing exported behavior, keep library, CLI, GUI wrapper, tests, and docs aligned.
