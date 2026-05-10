import { describe, expect, test } from "vitest";
import { detectSubstackContentType } from "../src/adapters/substack.js";

describe("substack adapter detection", () => {
  test("detects post type from publication url", () => {
    const type = detectSubstackContentType(
      new URL("https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026"),
    );
    expect(type).toBe("post");
  });

  test("detects post type from aggregator url", () => {
    const type = detectSubstackContentType(
      new URL("https://substack.com/@michaeljburry/p-196918166"),
    );
    expect(type).toBe("post");
  });

  test("returns null for unsupported substack path", () => {
    const type = detectSubstackContentType(
      new URL("https://substack.com/@michaeljburry/archive"),
    );
    expect(type).toBeNull();
  });
});
