import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const FORBIDDEN_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i,
  /\bntn_[A-Za-z0-9._-]{8,}\b/i,
  /\bsecret[-_][A-Za-z0-9._-]{8,}\b/i,
  /cookies\.secrets\.local\.json/i,
  /notion\.secrets\.local\.json/i,
  /"notionToken"\s*:/i,
  /\bz_c0["'\s:=]{1,}["']?[A-Za-z0-9._-]{16,}/i,
];

describe("fixture safety", () => {
  test("fixtures do not contain obvious secret markers", () => {
    const fixtureDir = path.join("tests", "fixtures");
    const fixtureFiles = readdirSync(fixtureDir).filter((name) => name.endsWith(".html"));
    const violations: string[] = [];

    for (const fileName of fixtureFiles) {
      const filePath = path.join(fixtureDir, fileName);
      const content = readFileSync(filePath, "utf8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${filePath}: ${pattern}`);
          break;
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
