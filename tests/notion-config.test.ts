import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import { writeTextFile } from "../src/utils/fs.js";
import { readNotionConfig } from "../src/core/notion-config.js";

describe("readNotionConfig", () => {
  test("reads valid config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "notion-config-test-"));
    const configPath = path.join(root, "notion.json");

    await writeTextFile(
      configPath,
      JSON.stringify(
        {
          notionToken: "secret_x",
          databaseId: "db_x",
        },
        null,
        2,
      ),
    );

    const config = await readNotionConfig(configPath);
    expect(config.notionToken).toBe("secret_x");
    expect(config.databaseId).toBe("db_x");
  });

  test("throws for invalid config", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "notion-config-test-"));
    const configPath = path.join(root, "notion-invalid.json");

    await writeTextFile(configPath, JSON.stringify({ databaseId: "db_x" }, null, 2));

    await expect(readNotionConfig(configPath)).rejects.toThrowError("notionToken is required");
  });
});
