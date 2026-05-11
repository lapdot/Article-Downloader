import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { resolveEffectiveDownloadMethod, resolveRuntimeConfig } from "../src/core/runtime-config.js";
import { writeTextFile } from "../src/utils/fs.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeTextFile(filePath, JSON.stringify(value, null, 2));
}

describe("runtime config", () => {
  test("resolves cookieproxy from config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
        userAgent: "UA_TEST",
      },
    });

    const runtimeConfig = await resolveRuntimeConfig({ configPath });

    expect(runtimeConfig.pipeline.userAgent).toBe("UA_TEST");
    expect(runtimeConfig.pipeline.downloadMethod).toBe("cookieproxy");
  });

  test("supports env override for public config path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.from-env.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
        outDir: "custom-output",
      },
    });

    process.env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH = configPath;

    const runtimeConfig = await resolveRuntimeConfig({});

    expect(runtimeConfig.pipeline.outDir).toBe("custom-output");
    expect(runtimeConfig.pipeline.downloadMethod).toBe("cookieproxy");
  });

  test("explicit config path overrides env public config path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const envConfigPath = path.join(root, "public.from-env.json");
    const explicitConfigPath = path.join(root, "public.explicit.json");

    await writeJson(envConfigPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
        outDir: "env-output",
      },
    });
    await writeJson(explicitConfigPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
        outDir: "explicit-output",
      },
    });

    process.env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH = envConfigPath;

    const runtimeConfig = await resolveRuntimeConfig({
      configPath: explicitConfigPath,
    });

    expect(runtimeConfig.pipeline.outDir).toBe("explicit-output");
  });

  test("uses env override for cookieproxy path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
      },
    });
    process.env.ARTICLE_DOWNLOADER_COOKIEPROXY_PATH = "/tmp/custom-cookieproxy";

    const runtimeConfig = await resolveRuntimeConfig({ configPath });

    expect(runtimeConfig.pipeline.cookieproxyPath).toBe("/tmp/custom-cookieproxy");
  });

  test("loads notion secrets when required", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const notionSecretsPath = path.join(root, "notion.alt.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
      },
    });
    await writeJson(notionSecretsPath, {
      notionToken: "secret_token",
      databaseId: "database_x",
    });

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      notionSecretsPath,
      requireNotion: true,
    });

    expect(runtimeConfig.notion.notionToken).toBe("secret_token");
    expect(runtimeConfig.notion.databaseId).toBe("database_x");
  });

  test("ignores notion secrets env path when notion is not required", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
      },
    });
    process.env.ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH = path.join(root, "missing-notion.json");

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      requireNotion: false,
    });

    expect(runtimeConfig.notion.notionToken).toBeUndefined();
    expect(runtimeConfig.notion.databaseId).toBeUndefined();
  });

  test("fails when public config file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "missing-public.config.json");

    await expect(resolveRuntimeConfig({ configPath })).rejects.toThrowError(
      `E_FILE_NOT_FOUND: public config: ${configPath}`,
    );
  });

  test("fails when public config path is missing in both arg and env", async () => {
    await expect(resolveRuntimeConfig({})).rejects.toThrowError(
      "missing public config path: provide --config or ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH",
    );
  });

  test("fails when notion secrets file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const notionSecretsPath = path.join(root, "missing-notion.secrets.local.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
      },
    });

    await expect(
      resolveRuntimeConfig({
        configPath,
        notionSecretsPath,
        requireNotion: true,
      }),
    ).rejects.toThrowError(`E_FILE_NOT_FOUND: notion secrets: ${notionSecretsPath}`);
  });

  test("fails when config sets removed http download method", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "http",
      },
    });

    await expect(resolveRuntimeConfig({ configPath })).rejects.toThrowError(
      'invalid public config: pipeline.downloadMethod: Invalid literal value, expected "cookieproxy"',
    );
  });

  test("resolveEffectiveDownloadMethod keeps selection logic and resolves cookieproxy from config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
      },
    });

    await expect(resolveEffectiveDownloadMethod({ configPath })).resolves.toBe("cookieproxy");
  });

  test("explicit cookieproxy override still resolves through the selection path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {
      pipeline: {
        downloadMethod: "cookieproxy",
      },
    });

    await expect(
      resolveEffectiveDownloadMethod({ configPath, downloadMethodOverride: "cookieproxy" }),
    ).resolves.toBe("cookieproxy");
  });
});
