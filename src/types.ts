export type ErrorCode =
  | "E_FETCH_EXEC"
  | "E_PARSE_SELECTOR"
  | "E_PARSE_UNSUPPORTED_SITE"
  | "E_NOTION_API";

export type DownloadMethod = "cookieproxy";

export interface DownloadInput {
  url: string;
  userAgent?: string;
  timeoutMs?: number;
  downloadMethod?: DownloadMethod;
  cookieproxyPath?: string;
}

export interface DownloadResult {
  ok: boolean;
  url: string;
  downloadMethod: DownloadMethod;
  source?: SourceIdentity;
  finalUrl?: string;
  statusCode?: number;
  html?: string;
  fetchedAt: string;
  reason?: string;
  errorCode?: ErrorCode;
  diagnostics?: Record<string, string | number | boolean>;
}

export interface ParseInput {
  html: string;
  sourceUrl: string;
  useHtmlStyleForImage?: boolean;
}

export interface ParseResult {
  ok: boolean;
  source?: SourceIdentity;
  title?: string;
  markdown?: string;
  stats?: {
    removedNodes: number;
    selectedNodes: number;
  };
  warnings?: string[];
  reason?: string;
  errorCode?: ErrorCode;
}

export interface MetadataInput {
  html: string;
  sourceUrl: string;
}

export interface HtmlMetadata {
  articleUrl: string;
  authorId?: string;
  authorHomepage?: string;
  publishTime?: string;
  editTime?: string;
}

export interface MetadataResult {
  ok: boolean;
  source?: SourceIdentity;
  metadata?: HtmlMetadata;
  warnings?: string[];
  reason?: string;
  errorCode?: ErrorCode;
}

export interface UploadInput {
  markdown: string;
  notionToken: string;
  databaseId: string;
}

export interface UploadResult {
  ok: boolean;
  pageId?: string;
  blocksAppended?: number;
  reason?: string;
  errorCode?: ErrorCode;
}

export interface PublicConfig {
  pipeline?: {
    outDir?: string;
    useHtmlStyleForImage?: boolean;
    userAgent?: string;
    downloadMethod?: DownloadMethod;
  };
}

export interface NotionSecretsConfig {
  notionToken: string;
  databaseId: string;
}

export interface ResolvedRuntimeConfig {
  pipeline: {
    outDir: string;
    useHtmlStyleForImage: boolean;
    userAgent?: string;
    downloadMethod: DownloadMethod;
    cookieproxyPath: string;
  };
  notion: {
    notionToken?: string;
    databaseId?: string;
  };
}

export interface DownloadMethodOverrideInput {
  downloadMethodOverride?: DownloadMethod;
}

export interface PipelineInput {
  url: string;
  runtimeConfig: ResolvedRuntimeConfig;
  outDir?: string;
  useHtmlStyleForImage?: boolean;
  notionSetupError?: string;
}

export interface PipelineResult {
  ok: boolean;
  outputDir?: string;
  htmlPath?: string;
  metadataPath?: string;
  markdownPath?: string;
  notionBlocksPath?: string;
  metaPath?: string;
  download?: DownloadResult;
  metadata?: MetadataResult;
  parse?: ParseResult;
  upload?: UploadResult;
  reason?: string;
}

export type ZhihuContentType = "answer" | "pin" | "post";
export type SubstackContentType = "post";
export type ForeignAffairsContentType = "post" | "podcast";
export type SourceId = "zhihu" | "substack" | "foreignaffairs";

export interface SourceIdentityBase<TSourceId extends SourceId, TContentType extends string> {
  sourceId: TSourceId;
  contentType: TContentType;
}

export type ZhihuSourceIdentity = SourceIdentityBase<"zhihu", ZhihuContentType>;
export type SubstackSourceIdentity = SourceIdentityBase<"substack", SubstackContentType>;
export type ForeignAffairsSourceIdentity = SourceIdentityBase<
  "foreignaffairs",
  ForeignAffairsContentType
>;
export type SourceIdentity =
  | ZhihuSourceIdentity
  | SubstackSourceIdentity
  | ForeignAffairsSourceIdentity;

export interface PdfDownloadInput extends DownloadInput {
  outDir: string;
  filename?: string;
}

export interface PdfDownloadResult {
  ok: boolean;
  url: string;
  downloadMethod: DownloadMethod;
  source?: SourceIdentity;
  finalUrl?: string;
  fetchedAt: string;
  pdfPath?: string;
  bytes?: number;
  reason?: string;
  errorCode?: ErrorCode;
  diagnostics?: Record<string, string | number | boolean>;
}

export interface SelectorSet {
  title: string;
  content: string;
  remove: string[];
  authorMetaContainer: string;
  timeContainer: string;
  timeLink: string;
}
