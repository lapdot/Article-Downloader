import { cleanEnv, str } from "envalid";
import { z, ZodError } from "zod";
import type {
  DownloadMethodOverrideInput,
  NotionSecretsConfig,
  PublicConfig,
  ResolvedRuntimeConfig,
} from "../types.js";
import { formatMissingFileError, isNotFoundError, readJsonFile } from "../utils/fs.js";

const DEFAULT_NOTION_SECRETS_PATH = "config/notion.secrets.local.json";
const DEFAULT_COOKIEPROXY_PATH = "/Users/lapdot/Documents/projects/runnable/cookieproxy";

const publicConfigSchema = z.object({
  pipeline: z
    .object({
      outDir: z.string().trim().min(1).optional(),
      useHtmlStyleForImage: z.boolean().optional(),
      userAgent: z.string().trim().min(1).optional(),
      downloadMethod: z.literal("cookieproxy").optional(),
    })
    .optional(),
});

const notionSecretsSchema = z.object({
  notionToken: z.string().trim().min(1),
  databaseId: z.string().trim().min(1),
});

export interface ResolveRuntimeConfigInput extends DownloadMethodOverrideInput {
  configPath?: string;
  notionSecretsPath?: string;
  requireNotion?: boolean;
}

export interface ResolveDownloadMethodInput extends DownloadMethodOverrideInput {
  configPath?: string;
}

interface PathsFromEnv {
  publicConfigPath?: string;
  notionSecretsPath?: string;
  cookieproxyPath?: string;
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
    ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH: str({ default: "" }),
    ARTICLE_DOWNLOADER_COOKIEPROXY_PATH: str({ default: "" }),
  });

  return {
    publicConfigPath: env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH || undefined,
    notionSecretsPath: env.ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH || undefined,
    cookieproxyPath: env.ARTICLE_DOWNLOADER_COOKIEPROXY_PATH || undefined,
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

function resolveDownloadMethod(
  publicConfig: PublicConfig,
  input: DownloadMethodOverrideInput,
): "cookieproxy" {
  return input.downloadMethodOverride ?? publicConfig.pipeline?.downloadMethod ?? "cookieproxy";
}

export async function resolveRuntimeConfig(
  input: ResolveRuntimeConfigInput,
): Promise<ResolvedRuntimeConfig> {
  const envPaths = readPathsFromEnv();
  const publicConfigPath = resolvePublicConfigPath(input, envPaths);
  logRuntimeConfigDebug(`loading public config from: ${publicConfigPath}`);
  const publicConfig = await readPublicConfig(publicConfigPath);
  const notionSecretsPath =
    input.notionSecretsPath ?? envPaths.notionSecretsPath ?? DEFAULT_NOTION_SECRETS_PATH;
  logRuntimeConfigDebug(`resolved notion secrets path: ${notionSecretsPath}`);

  const notionIsRequired = Boolean(input.requireNotion);

  let notionToken: string | undefined;
  let databaseId: string | undefined;
  if (notionIsRequired) {
    const notionSecrets = await readNotionSecretsConfig(notionSecretsPath);
    notionToken = notionSecrets.notionToken;
    databaseId = notionSecrets.databaseId;
  }

  return {
    pipeline: {
      outDir: publicConfig.pipeline?.outDir ?? "artifacts/runtime",
      useHtmlStyleForImage: publicConfig.pipeline?.useHtmlStyleForImage ?? false,
      userAgent: publicConfig.pipeline?.userAgent,
      downloadMethod: resolveDownloadMethod(publicConfig, input),
      cookieproxyPath: envPaths.cookieproxyPath ?? DEFAULT_COOKIEPROXY_PATH,
    },
    notion: {
      notionToken,
      databaseId,
    },
  };
}

export async function resolveEffectiveDownloadMethod(
  input: ResolveDownloadMethodInput,
): Promise<"cookieproxy"> {
  const envPaths = readPathsFromEnv();
  const publicConfigPath = resolvePublicConfigPath(
    {
      configPath: input.configPath,
    },
    envPaths,
  );
  const publicConfig = await readPublicConfig(publicConfigPath);
  return resolveDownloadMethod(publicConfig, input);
}
