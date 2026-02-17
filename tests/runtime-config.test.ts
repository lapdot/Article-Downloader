import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, test } from "vitest";
import { resolveRuntimeConfig } from "../src/core/runtime-config.js";
import { writeTextFile } from "../src/utils/fs.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeTextFile(filePath, JSON.stringify(value, null, 2));
}

describe("runtime config", () => {
  test("merges publicEntries and secrets cookies", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {
      pipeline: {
        userAgent: "UA_TEST",
      },
      cookies: {
        publicEntries: [
          { name: "_ga", value: "GA1.2.example", domain: ".zhihu.com", path: "/" },
        ],
      },
    });
    await writeJson(cookieSecretsPath, [
      {
        name: "z_c0",
        value: "secret-z-c0",
        domain: ".zhihu.com",
        path: "/",
      },
    ]);

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      cookiesSecretsPath: cookieSecretsPath,
      requireCookies: true,
    });

    expect(runtimeConfig.cookies).toEqual([
      { name: "_ga", value: "GA1.2.example", domain: ".zhihu.com", path: "/" },
      { name: "z_c0", value: "secret-z-c0", domain: ".zhihu.com", path: "/" },
    ]);
    expect(runtimeConfig.pipeline.userAgent).toBe("UA_TEST");
  });

  test("works when only secrets cookies are provided", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {});
    await writeJson(cookieSecretsPath, [
      { name: "z_c0", value: "secret-z-c0", domain: ".zhihu.com", path: "/" },
    ]);

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      cookiesSecretsPath: cookieSecretsPath,
      requireCookies: true,
    });

    expect(runtimeConfig.cookies).toEqual([
      { name: "z_c0", value: "secret-z-c0", domain: ".zhihu.com", path: "/" },
    ]);
  });

  test("works when only publicEntries cookies are provided", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {
      cookies: {
        publicEntries: [{ name: "z_c0", value: "public-z-c0", domain: ".zhihu.com", path: "/" }],
      },
    });
    await writeJson(cookieSecretsPath, []);

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      cookiesSecretsPath: cookieSecretsPath,
      requireCookies: true,
    });

    expect(runtimeConfig.cookies).toEqual([
      { name: "z_c0", value: "public-z-c0", domain: ".zhihu.com", path: "/" },
    ]);
  });

  test("fails when duplicate tuple exists across public and secrets sources", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {
      cookies: {
        publicEntries: [{ name: "z_c0", value: "public-v", domain: ".zhihu.com", path: "/" }],
      },
    });
    await writeJson(cookieSecretsPath, [
      { name: "z_c0", value: "secret-v", domain: "zhihu.com", path: "/" },
    ]);

    await expect(
      resolveRuntimeConfig({
        configPath,
        cookiesSecretsPath: cookieSecretsPath,
        requireCookies: true,
      }),
    ).rejects.toThrowError(
      'invalid cookies config: duplicate cookie tuple "z_c0|zhihu.com|/" found across public/secrets sources',
    );
  });

  test("fails when duplicate tuple exists within one source", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {
      cookies: {
        publicEntries: [
          { name: "z_c0", value: "v1", domain: ".zhihu.com", path: "/" },
          { name: "z_c0", value: "v2", domain: "zhihu.com", path: "/" },
        ],
      },
    });
    await writeJson(cookieSecretsPath, []);

    await expect(
      resolveRuntimeConfig({
        configPath,
        cookiesSecretsPath: cookieSecretsPath,
        requireCookies: true,
      }),
    ).rejects.toThrowError(
      'invalid cookies config: duplicate cookie tuple "z_c0|zhihu.com|/" found within public source',
    );
  });

  test("allows empty merged cookies when cookies are required", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {});
    await writeJson(cookieSecretsPath, []);

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      cookiesSecretsPath: cookieSecretsPath,
      requireCookies: true,
    });
    expect(runtimeConfig.cookies).toEqual([]);
  });

  test("supports env override for secrets file paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.alt.json");
    const notionSecretsPath = path.join(root, "notion.alt.json");

    await writeJson(configPath, {});
    await writeJson(cookieSecretsPath, [
      {
        name: "z_c0",
        value: "secret-z-c0",
        domain: ".zhihu.com",
        path: "/",
      },
    ]);
    await writeJson(notionSecretsPath, {
      notionToken: "secret_token",
      databaseId: "database_x",
    });

    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = cookieSecretsPath;
    process.env.ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH = notionSecretsPath;

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      requireCookies: true,
      requireNotion: true,
    });

    expect(runtimeConfig.cookies[0]?.value).toBe("secret-z-c0");
    expect(runtimeConfig.notion.notionToken).toBe("secret_token");
    expect(runtimeConfig.notion.databaseId).toBe("database_x");
  });

  test("supports env override for public config path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.from-env.json");
    const cookieSecretsPath = path.join(root, "cookies.alt.json");

    await writeJson(configPath, {
      cookies: {
        publicEntries: [{ name: "z_c0", value: "public-v", domain: ".zhihu.com", path: "/" }],
      },
    });
    await writeJson(cookieSecretsPath, []);

    process.env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH = configPath;
    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = cookieSecretsPath;

    const runtimeConfig = await resolveRuntimeConfig({
      requireCookies: true,
    });

    expect(runtimeConfig.cookies).toEqual([
      { name: "z_c0", value: "public-v", domain: ".zhihu.com", path: "/" },
    ]);
  });

  test("explicit config path overrides env public config path", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const envConfigPath = path.join(root, "public.from-env.json");
    const explicitConfigPath = path.join(root, "public.explicit.json");
    const cookieSecretsPath = path.join(root, "cookies.json");

    await writeJson(envConfigPath, {
      cookies: {
        publicEntries: [{ name: "z_c0", value: "env", domain: ".zhihu.com", path: "/" }],
      },
    });
    await writeJson(explicitConfigPath, {
      cookies: {
        publicEntries: [{ name: "z_c0", value: "explicit", domain: ".zhihu.com", path: "/" }],
      },
    });
    await writeJson(cookieSecretsPath, []);
    process.env.ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH = envConfigPath;
    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = cookieSecretsPath;

    const runtimeConfig = await resolveRuntimeConfig({
      configPath: explicitConfigPath,
      requireCookies: true,
    });

    expect(runtimeConfig.cookies[0]?.value).toBe("explicit");
  });

  test("explicit secret path arguments override environment variables", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.explicit.json");
    const notionSecretsPath = path.join(root, "notion.explicit.json");

    await writeJson(configPath, {});
    await writeJson(cookieSecretsPath, [
      {
        name: "z_c0",
        value: "secret-from-explicit-arg",
        domain: ".zhihu.com",
        path: "/",
      },
    ]);
    await writeJson(notionSecretsPath, {
      notionToken: "token_from_explicit_arg",
      databaseId: "database_from_explicit_arg",
    });

    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = path.join(root, "missing.cookies.json");
    process.env.ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH = path.join(root, "missing.notion.json");

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      cookiesSecretsPath: cookieSecretsPath,
      notionSecretsPath,
      requireCookies: true,
      requireNotion: true,
    });

    expect(runtimeConfig.cookies[0]?.value).toBe("secret-from-explicit-arg");
    expect(runtimeConfig.notion.notionToken).toBe("token_from_explicit_arg");
    expect(runtimeConfig.notion.databaseId).toBe("database_from_explicit_arg");
  });

  test("ignores notion secrets env path when notion is not required", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");

    await writeJson(configPath, {});
    await writeJson(cookieSecretsPath, [
      {
        name: "z_c0",
        value: "cookie-ok",
        domain: ".zhihu.com",
        path: "/",
      },
    ]);
    process.env.ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH = path.join(
      root,
      "missing-notion-ignored.json",
    );

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      cookiesSecretsPath: cookieSecretsPath,
      requireCookies: true,
      requireNotion: false,
    });

    expect(runtimeConfig.cookies).toHaveLength(1);
    expect(runtimeConfig.notion.notionToken).toBeUndefined();
    expect(runtimeConfig.notion.databaseId).toBeUndefined();
  });

  test("ignores cookies secrets env path when cookies are not required", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const notionSecretsPath = path.join(root, "notion.secrets.local.json");

    await writeJson(configPath, {});
    await writeJson(notionSecretsPath, {
      notionToken: "token",
      databaseId: "database",
    });
    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = path.join(
      root,
      "missing-cookies-ignored.json",
    );

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      notionSecretsPath,
      requireCookies: false,
      requireNotion: true,
    });

    expect(runtimeConfig.cookies).toEqual([]);
    expect(runtimeConfig.notion.notionToken).toBe("token");
    expect(runtimeConfig.notion.databaseId).toBe("database");
  });

  test("fails with clear error when public config file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "missing-public.config.json");

    await expect(resolveRuntimeConfig({ configPath, requireCookies: false })).rejects.toThrowError(
      `E_FILE_NOT_FOUND: public config: ${configPath}`,
    );
  });

  test("fails when public config path is missing in both arg and env", async () => {
    await expect(resolveRuntimeConfig({ requireCookies: false })).rejects.toThrowError(
      "missing public config path: provide --config or ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH",
    );
  });

  test("fails with clear error when explicit cookies secrets file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "missing-cookies.secrets.local.json");

    await writeJson(configPath, {});

    await expect(
      resolveRuntimeConfig({ configPath, cookiesSecretsPath: cookieSecretsPath, requireCookies: true }),
    ).rejects.toThrowError(`E_FILE_NOT_FOUND: cookies secrets: ${cookieSecretsPath}`);
  });

  test("fails with clear error when env cookies secrets file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const missingCookiesPath = path.join(root, "missing-cookies.from-env.json");

    await writeJson(configPath, {});
    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = missingCookiesPath;

    await expect(resolveRuntimeConfig({ configPath, requireCookies: true })).rejects.toThrowError(
      `E_FILE_NOT_FOUND: cookies secrets: ${missingCookiesPath}`,
    );
  });

  test("fails with clear error when default cookies secrets file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");

    await writeJson(configPath, {});

    const cwd = process.cwd();
    process.chdir(root);
    try {
      await expect(resolveRuntimeConfig({ configPath, requireCookies: true })).rejects.toThrowError(
        "E_FILE_NOT_FOUND: cookies secrets: config/cookies.secrets.local.json",
      );
    } finally {
      process.chdir(cwd);
    }
  });

  test("does not read cookies secrets file when cookies are not required", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const missingCookiesPath = path.join(root, "missing-cookies.json");

    await writeJson(configPath, {});
    process.env.ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH = missingCookiesPath;

    const runtimeConfig = await resolveRuntimeConfig({
      configPath,
      requireCookies: false,
    });
    expect(runtimeConfig.cookies).toEqual([]);
  });

  test("fails with clear error when notion secrets file is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "runtime-config-test-"));
    const configPath = path.join(root, "public.config.json");
    const cookieSecretsPath = path.join(root, "cookies.secrets.local.json");
    const notionSecretsPath = path.join(root, "missing-notion.secrets.local.json");

    await writeJson(configPath, {});
    await writeJson(cookieSecretsPath, [
      {
        name: "z_c0",
        value: "secret-z-c0",
        domain: ".zhihu.com",
        path: "/",
      },
    ]);

    await expect(
      resolveRuntimeConfig({
        configPath,
        cookiesSecretsPath: cookieSecretsPath,
        notionSecretsPath,
        requireCookies: true,
        requireNotion: true,
      }),
    ).rejects.toThrowError(`E_FILE_NOT_FOUND: notion secrets: ${notionSecretsPath}`);
  });
});
