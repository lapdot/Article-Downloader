import type {
  DownloadInput,
  DownloadResult,
  MetadataInput,
  MetadataResult,
  ParseInput,
  ParseResult,
  SourceIdentity,
} from "../types.js";

export interface SourceMarkdownCapability<TIdentity extends SourceIdentity> {
  parseMarkdown: (input: ParseInput & { source: TIdentity }) => Promise<ParseResult> | ParseResult;
}

export interface SourceMetadataCapability<TIdentity extends SourceIdentity> {
  parseMetadata: (input: MetadataInput & { source: TIdentity }) => Promise<MetadataResult> | MetadataResult;
}

export interface FetchNormalizationContext<TIdentity extends SourceIdentity> {
  source: TIdentity;
  input: DownloadInput;
  initial: DownloadResult;
  fetchedAt: string;
  runTransport: (input: DownloadInput) => Promise<DownloadResult>;
}

export interface SourceFetchCapability<TIdentity extends SourceIdentity> {
  normalizeDownload: (
    context: FetchNormalizationContext<TIdentity>,
  ) => Promise<DownloadResult> | DownloadResult;
}

export interface SourceAdapter<TIdentity extends SourceIdentity> {
  sourceId: TIdentity["sourceId"];
  detect: (url: URL) => TIdentity | null;
  fetch?: SourceFetchCapability<TIdentity>;
  markdown?: SourceMarkdownCapability<TIdentity>;
  metadata?: SourceMetadataCapability<TIdentity>;
}
