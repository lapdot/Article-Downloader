import { cleanEnv, str } from "envalid";
import { z, ZodError } from "zod";
import type {
  Cookie,
  CookiesSecretsConfig,
  NotionSecretsConfig,
  PublicConfig,
  ResolvedRuntimeConfig,
} from "../types.js";
import { formatMissingFileError, isNotFoundError, readJsonFile } from "../utils/fs.js";
import { assertValidCookies } from "./cookies.js";

const DEFAULT_COOKIES_SECRETS_PATH = "config/cookies.secrets.local.json";
const DEFAULT_NOTION_SECRETS_PATH = "config/notion.secrets.local.json";

const sameSiteSchema = z.enum(["Strict", "Lax", "None", "unspecified", "no_restriction"]);

const publicCookieEntrySchema = z.object({
  name: z.string().trim().min(1),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: sameSiteSchema.optional(),
});

const publicConfigSchema = z.object({
  pipeline: z
    .object({
      outDir: z.string().trim().min(1).optional(),
      useHtmlStyleForImage: z.boolean().optional(),
      userAgent: z.string().trim().min(1).optional(),
    })
    .optional(),
  cookies: z
    .object({
      publicEntries: z.array(publicCookieEntrySchema).optional(),
    })
    .optional(),
});

const notionSecretsSchema = z.object({
  notionToken: z.string().trim().min(1),
  databaseId: z.string().trim().min(1),
});

export interface ResolveRuntimeConfigInput {
  configPath?: string;
  cookiesSecretsPath?: string;
  notionSecretsPath?: string;
  requireCookies?: boolean;
  requireNotion?: boolean;
}

interface PathsFromEnv {
  publicConfigPath?: string;
  cookiesSecretsPath?: string;
  notionSecretsPath?: string;
}

interface ResolvedSecretsPaths {
  cookiesSecretsPath: string;
  notionSecretsPath: string;
}

function isRuntimeConfigDebugEnabled(): boolean {
  return process.env.ARTICLE_DOWNLOADER_DEBUG_CONFIG === "1";
}

function logRuntimeConfigDebug(message: string): void {
  if (isRuntimeConfigDebugEnabled()) {
    console.error(`[runtime-config] ${message}`);
  }
}

function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const where = issue.path.length > 0 ? issue.path.join(".") : "<root>";
    return `${where}: ${issue.message}`;
  });
  return issues.join("; ");
}

function normalizeCookieDomain(domain?: string): string {
  if (!domain) {
    return "";
  }
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
}

function normalizeCookiePath(value?: string): string {
  if (!value || !value.trim()) {
    return "/";
  }
  return value.startsWith("/") ? value : `/${value}`;
}

export async function readPublicConfig(filePath: string): Promise<PublicConfig> {
  let raw: unknown;
  try {
    raw = await readJsonFile<unknown>(filePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError("public config", filePath);
    }
    throw error;
  }
  try {
    return publicConfigSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`invalid public config: ${formatZodError(error)}`);
    }
    throw error;
  }
}

export async function readCookiesSecretsConfig(filePath: string): Promise<CookiesSecretsConfig> {
  let raw: unknown;
  logRuntimeConfigDebug(`reading cookies secrets file: ${filePath}`);
  try {
    raw = await readJsonFile<unknown>(filePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError("cookies secrets", filePath);
    }
    throw error;
  }
  if (!Array.isArray(raw)) {
    logRuntimeConfigDebug(
      `cookies secrets root type is not array (type=${typeof raw}); validation will fail with E_COOKIE_INVALID`,
    );
  } else {
    logRuntimeConfigDebug(`cookies secrets raw item count: ${raw.length}`);
  }
  if (Array.isArray(raw) && raw.length === 0) {
    logRuntimeConfigDebug("cookies secrets list is empty");
    return { cookies: [] };
  }
  const cookies = assertValidCookies(raw);
  logRuntimeConfigDebug(`cookies secrets parsed cookie count: ${cookies.length}`);
  return { cookies };
}

export async function readNotionSecretsConfig(filePath: string): Promise<NotionSecretsConfig> {
  let raw: unknown;
  try {
    raw = await readJsonFile<unknown>(filePath);
  } catch (error) {
    if (isNotFoundError(error)) {
      throw formatMissingFileError("notion secrets", filePath);
    }
    throw error;
  }
  try {
    return notionSecretsSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`invalid notion secrets config: ${formatZodError(error)}`);
    }
    throw error;
  }
}

function readPathsFromEnv(): PathsFromEnv {
  const env = cleanEnv(process.env, {
    ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH: str({ default: "" }),
    ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH: str({ default: "" }),
    ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH: str({ default: "" }),
  });

  return {
    publicConfigPath: env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH || undefined,
    cookiesSecretsPath: env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH || undefined,
    notionSecretsPath: env.ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH || undefined,
  };
}

function resolvePublicConfigPath(input: ResolveRuntimeConfigInput, envPaths: PathsFromEnv): string {
  const resolved = input.configPath ?? envPaths.publicConfigPath;
  if (!resolved) {
    throw new Error(
      "missing public config path: provide --config or ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH",
    );
  }
  return resolved;
}

function resolveSecretsPaths(input: ResolveRuntimeConfigInput, envPaths: PathsFromEnv): ResolvedSecretsPaths {
  return {
    cookiesSecretsPath:
      input.cookiesSecretsPath ?? envPaths.cookiesSecretsPath ?? DEFAULT_COOKIES_SECRETS_PATH,
    notionSecretsPath:
      input.notionSecretsPath ?? envPaths.notionSecretsPath ?? DEFAULT_NOTION_SECRETS_PATH,
  };
}

function resolveCookies(cookiesConfig: PublicConfig["cookies"], cookiesSecrets: CookiesSecretsConfig): Cookie[] {
  const publicEntries = cookiesConfig?.publicEntries ?? [];
  const validatedPublicEntries =
    publicEntries.length === 0 ? [] : assertValidCookies(publicEntries);
  const secretEntries = cookiesSecrets.cookies;

  logRuntimeConfigDebug(
    `resolving cookies: public entries=${validatedPublicEntries.length}, secret entries=${secretEntries.length}`,
  );

  const seen = new Map<string, "public" | "secrets">();
  function addWithDuplicateCheck(entries: Cookie[], source: "public" | "secrets"): void {
    for (const entry of entries) {
      const tuple = `${entry.name}|${normalizeCookieDomain(entry.domain)}|${normalizeCookiePath(entry.path)}`;
      const existingSource = seen.get(tuple);
      if (existingSource) {
        if (existingSource !== source) {
          throw new Error(
            `invalid cookies config: duplicate cookie tuple "${tuple}" found across public/secrets sources`,
          );
        }
        throw new Error(
          `invalid cookies config: duplicate cookie tuple "${tuple}" found within ${source} source`,
        );
      }
      seen.set(tuple, source);
      logRuntimeConfigDebug(`cookie tuple ${tuple}: source=${source}`);
    }
  }

  addWithDuplicateCheck(validatedPublicEntries, "public");
  addWithDuplicateCheck(secretEntries, "secrets");

  const mergedCookies: Cookie[] = [...validatedPublicEntries, ...secretEntries];
  if (mergedCookies.length > 0) {
    const validatedMergedCookies = assertValidCookies(mergedCookies);
    logRuntimeConfigDebug(`merged cookie count: ${validatedMergedCookies.length}`);
    return validatedMergedCookies;
  }
  logRuntimeConfigDebug("merged cookie count: 0");
  return [];
}

export async function resolveRuntimeConfig(
  input: ResolveRuntimeConfigInput,
): Promise<ResolvedRuntimeConfig> {
  const envPaths = readPathsFromEnv();
  const publicConfigPath = resolvePublicConfigPath(input, envPaths);
  logRuntimeConfigDebug(`loading public config from: ${publicConfigPath}`);
  const publicConfig = await readPublicConfig(publicConfigPath);
  const secretsPaths = resolveSecretsPaths(input, envPaths);
  logRuntimeConfigDebug(
    `resolved secrets paths: cookies=${secretsPaths.cookiesSecretsPath}, notion=${secretsPaths.notionSecretsPath}`,
  );

  const cookiesAreRequired = input.requireCookies ?? true;
  logRuntimeConfigDebug(`cookies required: ${cookiesAreRequired}`);
  const cookies = cookiesAreRequired
    ? resolveCookies(publicConfig.cookies, await readCookiesSecretsConfig(secretsPaths.cookiesSecretsPath))
    : [];

  const notionIsRequired = Boolean(input.requireNotion);

  let notionToken: string | undefined;
  let databaseId: string | undefined;
  if (notionIsRequired) {
    const notionSecrets = await readNotionSecretsConfig(secretsPaths.notionSecretsPath);
    notionToken = notionSecrets.notionToken;
    databaseId = notionSecrets.databaseId;
  }

  return {
    cookies,
    pipeline: {
      outDir: publicConfig.pipeline?.outDir ?? "output",
      useHtmlStyleForImage: publicConfig.pipeline?.useHtmlStyleForImage ?? false,
      userAgent: publicConfig.pipeline?.userAgent,
    },
    notion: {
      notionToken,
      databaseId,
    },
  };
}
