export type ErrorCode =
  | "E_COOKIE_INVALID"
  | "E_FETCH_HTTP"
  | "E_PARSE_SELECTOR"
  | "E_PARSE_UNSUPPORTED_SITE"
  | "E_NOTION_API";

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | "unspecified" | "no_restriction";
}

export interface VerifyResult {
  ok: boolean;
  statusCode?: number;
  reason?: string;
  errorCode?: ErrorCode;
  diagnostics?: Record<string, string | number | boolean>;
}

export interface DownloadInput {
  url: string;
  cookies: Cookie[];
  userAgent?: string;
  timeoutMs?: number;
}

export interface DownloadResult {
  ok: boolean;
  url: string;
  finalUrl?: string;
  statusCode?: number;
  html?: string;
  fetchedAt: string;
  reason?: string;
  errorCode?: ErrorCode;
}

export interface ParseInput {
  html: string;
  sourceUrl: string;
  useHtmlStyleForImage?: boolean;
}

export interface ParseResult {
  ok: boolean;
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

export interface PublicCookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | "unspecified" | "no_restriction";
}

export interface PublicConfig {
  pipeline?: {
    outDir?: string;
    useHtmlStyleForImage?: boolean;
    userAgent?: string;
  };
  cookies?: {
    publicEntries?: PublicCookieEntry[];
  };
}

export interface CookiesSecretsConfig {
  cookies: Cookie[];
}

export interface NotionSecretsConfig {
  notionToken: string;
  databaseId: string;
}

export interface ResolvedRuntimeConfig {
  cookies: Cookie[];
  pipeline: {
    outDir: string;
    useHtmlStyleForImage: boolean;
    userAgent?: string;
  };
  notion: {
    notionToken?: string;
    databaseId?: string;
  };
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
  verify: VerifyResult;
  download?: DownloadResult;
  metadata?: MetadataResult;
  parse?: ParseResult;
  upload?: UploadResult;
  reason?: string;
}

export type ZhihuContentType = "answer" | "pin" | "zhuanlan_article";

export interface SelectorSet {
  title: string;
  content: string;
  remove: string[];
  authorMetaContainer: string;
  timeContainer: string;
  timeLink: string;
}
