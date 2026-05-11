import type {
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

export interface SourceAdapter<TIdentity extends SourceIdentity> {
  sourceId: TIdentity["sourceId"];
  detect: (url: URL) => TIdentity | null;
  markdown?: SourceMarkdownCapability<TIdentity>;
  metadata?: SourceMetadataCapability<TIdentity>;
}
