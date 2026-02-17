import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const CLOSED_LOOP_ENV = "ARTICLE_DOWNLOADER_CLOSED_LOOP";
const runWhenClosedLoop = process.env[CLOSED_LOOP_ENV] === "1" ? test : test.skip;

const PATH_ENV_KEYS = [
  "ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH",
  "ARTICLE_DOWNLOADER_COOKIES_SECRETS_PATH",
  "ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH",
] as const;

const FORBIDDEN_SECRET_ENV_KEYS = [
  "NOTION_TOKEN",
  "ARTICLE_DOWNLOADER_NOTION_TOKEN",
  "ZHIHU_COOKIE",
  "ARTICLE_DOWNLOADER_COOKIE_VALUE",
  "Z_C0",
] as const;

const FORBIDDEN_FIXTURE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i,
  /\bntn_[A-Za-z0-9._-]{8,}\b/i,
  /\bsecret[-_][A-Za-z0-9._-]{8,}\b/i,
  /cookies\.secrets\.local\.json/i,
  /notion\.secrets\.local\.json/i,
  /"notionToken"\s*:/i,
  /\bz_c0["'\s:=]{1,}["']?[A-Za-z0-9._-]{16,}/i,
];

function normalizePath(value: string): string {
  return path.normalize(value).replaceAll("\\", "/");
}

function looksLikeInlineSecretPayload(value: string): boolean {
  return /[\r\n]/.test(value) || /^[\[{]/.test(value.trim()) || /"notionToken"\s*:/.test(value);
}

describe("closed-loop preflight", () => {
  runWhenClosedLoop("rejects known secret env vars", () => {
    const leakedKeys = FORBIDDEN_SECRET_ENV_KEYS.filter((key) => (process.env[key] ?? "").trim().length > 0);
    expect(leakedKeys).toEqual([]);
  });

  runWhenClosedLoop("ensures path env vars do not contain inline secret payloads", () => {
    for (const key of PATH_ENV_KEYS) {
      const raw = process.env[key];
      if (!raw) {
        continue;
      }

      expect(looksLikeInlineSecretPayload(raw)).toBe(false);
      const normalized = normalizePath(raw);
      const pointsToLocalSecret = /\.secrets\.local\.json$/i.test(normalized);
      if (pointsToLocalSecret) {
        expect(normalized.includes("/tests/") || normalized.endsWith(".example.json")).toBe(true);
      }
    }
  });

  runWhenClosedLoop("ensures committed fixtures do not contain obvious secret markers", () => {
    const fixtureDir = path.join("tests", "fixtures");
    const fixtureFiles = readdirSync(fixtureDir).filter(
      (name) => name.endsWith(".html") || name.endsWith(".map.json"),
    );
    const violations: string[] = [];

    for (const fileName of fixtureFiles) {
      const filePath = path.join(fixtureDir, fileName);
      const content = readFileSync(filePath, "utf8");
      for (const pattern of FORBIDDEN_FIXTURE_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${filePath}: ${pattern}`);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
