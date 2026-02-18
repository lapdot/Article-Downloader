import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { browsePath } from "../src/core/browse-path.js";

describe("browsePath", () => {
  it("lists entries with minimal shape", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "article-downloader-browse-"));
    const filePath = path.join(tempDir, "sample.txt");
    await writeFile(filePath, "hello", "utf8");

    const result = await browsePath(tempDir);
    expect(result.ok).toBe(true);
    expect(result.path).toBe(path.resolve(tempDir));
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.entries?.some((entry) => entry.name === "sample.txt" && entry.kind === "file")).toBe(true);
  });

  it("returns structured error for missing path", async () => {
    const missing = path.join(os.tmpdir(), `missing-${Date.now()}`);
    const result = await browsePath(missing);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBeTruthy();
  });
});
