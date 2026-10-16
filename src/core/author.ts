import { z, ZodError } from "zod";
import type {
  AuthorSourceAliases,
  AuthorWhitelist,
  AuthorWhitelistEntry,
  HtmlCanonicalAuthor,
  HtmlMetadata,
  SourceId,
  SourceIdentity,
} from "../types.js";
import { formatMissingFileError, isNotFoundError, readJsonFile } from "../utils/fs.js";

const authorAliasesSchema = z.object({
  handles: z.array(z.string().trim().min(1)).optional(),
  names: z.array(z.string().trim().min(1)).optional(),
  urls: z.array(z.string().trim().min(1)).optional(),
});

const authorWhitelistSchema = z.object({
  authors: z.array(
    z.object({
      id: z.string().trim().min(1),
      canonicalName: z.string().trim().min(1),
      notionName: z.string().trim().min(1),
      sources: z.object({
        substack: authorAliasesSchema.optional(),
        zhihu: authorAliasesSchema.optional(),
      }).optional(),
    }),
  ),
});

interface AuthorMatchInput {
  metadata: HtmlMetadata;
  sourceUrl: string;
  source?: SourceIdentity;
  whitelist: AuthorWhitelist;
}

function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    return `${where}: ${issue.message}`;
  });
  return issues.join("; ");
}

function normalizeName(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeHandle(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^@/u, "").toLocaleLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value.trim());
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLocaleLowerCase();
    const pathname = url.pathname.replace(/\/+$/u, "");
    return `${url.protocol}//${url.hostname}${pathname}`;
  } catch {
    return undefined;
  }
}

function inferSourceId(sourceUrl: string): SourceId | undefined {
  try {
    const url = new URL(sourceUrl);
    if (url.hostname === "substack.com" || url.hostname.endsWith(".substack.com")) {
      return "substack";
    }
    if (url.hostname === "www.zhihu.com" || url.hostname === "zhuanlan.zhihu.com") {
      return "zhihu";
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function substackHandleFromUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    if (url.hostname !== "substack.com") {
      return undefined;
    }
    const match = /^\/@([^/]+)/u.exec(url.pathname);
    return normalizeHandle(match?.[1]);
  } catch {
    return undefined;
  }
}

function normalizedValues(
  values: string[] | undefined,
  normalize: (value: string) => string | undefined,
): Set<string> {
  return new Set(
    (values ?? [])
      .map((value) => normalize(value))
      .filter((value): value is string => Boolean(value)),
  );
}

function aliasesForSource(
  entry: AuthorWhitelistEntry,
  sourceId: SourceId,
): AuthorSourceAliases | undefined {
  if (sourceId !== "substack" && sourceId !== "zhihu") {
    return undefined;
  }
  return entry.sources?.[sourceId];
}

function aliasNames(entry: AuthorWhitelistEntry, aliases: AuthorSourceAliases): Set<string> {
  return normalizedValues(
    [...(aliases.names ?? []), entry.canonicalName, entry.notionName],
    normalizeName,
  );
}

export async function readAuthorWhitelist(filePath: string): Promise<AuthorWhitelist> {
  let raw: unknown;
  try {
    raw = await readJsonFile<unknown>(filePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError("author whitelist", filePath);
    }
    throw error;
  }

  try {
    return authorWhitelistSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`invalid author whitelist: ${formatZodError(error)}`);
    }
    throw error;
  }
}

export function matchAuthor(input: AuthorMatchInput): HtmlCanonicalAuthor | undefined {
  const sourceId = input.source?.sourceId ?? inferSourceId(input.sourceUrl);
  if (sourceId !== "substack" && sourceId !== "zhihu") {
    return undefined;
  }

  const candidateName = normalizeName(input.metadata.authorId);
  const candidateUrl = normalizeUrl(input.metadata.authorHomepage);
  const candidateHandles = new Set<string>();
  const sourceHandle = substackHandleFromUrl(input.sourceUrl);
  const homepageHandle = substackHandleFromUrl(input.metadata.authorHomepage);
  if (sourceHandle) {
    candidateHandles.add(sourceHandle);
  }
  if (homepageHandle) {
    candidateHandles.add(homepageHandle);
  }

  for (const entry of input.whitelist.authors) {
    const aliases = aliasesForSource(entry, sourceId);
    if (!aliases) {
      continue;
    }

    const names = aliasNames(entry, aliases);
    const urls = normalizedValues(aliases.urls, normalizeUrl);
    const handles = normalizedValues(aliases.handles, normalizeHandle);

    const nameMatched = candidateName ? names.has(candidateName) : false;
    const urlMatched = candidateUrl ? urls.has(candidateUrl) : false;
    const handleMatched = [...candidateHandles].some((handle) => handles.has(handle));
    if (nameMatched || urlMatched || handleMatched) {
      return {
        id: entry.id,
        name: entry.canonicalName,
        notionName: entry.notionName,
      };
    }
  }

  return undefined;
}

export function enrichMetadataWithAuthor(input: AuthorMatchInput): HtmlMetadata {
  const author = matchAuthor(input);
  return author ? { ...input.metadata, author } : input.metadata;
}
