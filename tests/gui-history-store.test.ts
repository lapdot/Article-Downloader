import path from "node:path";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { buildHistoryFilePath, getHistoryValues, putHistoryValue } from "../src/gui/bridge/history-store.js";

describe("gui history store", () => {
  it("trims, deduplicates, and caps history values", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gui-history-store-"));
    const historyPath = buildHistoryFilePath(root);

    await putHistoryValue(historyPath, "fetch.url", "  https://example.com/a  ");
    await putHistoryValue(historyPath, "fetch.url", "https://example.com/b");
    await putHistoryValue(historyPath, "fetch.url", "https://example.com/a");
    for (let index = 0; index < 10; index += 1) {
      await putHistoryValue(historyPath, "fetch.url", `https://example.com/${index}`);
    }

    const values = await getHistoryValues(historyPath, "fetch.url");
    expect(values).toHaveLength(8);
    expect(values[0]).toBe("https://example.com/9");
    expect(values.includes("https://example.com/a")).toBe(false);
  });

  it("falls back to empty history for malformed content", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gui-history-store-"));
    const historyPath = buildHistoryFilePath(root);
    await writeFile(historyPath, "{ not-json", "utf8");

    const values = await getHistoryValues(historyPath, "fetch.url");
    expect(values).toEqual([]);
  });

  it("ignores invalid record entries and keeps valid string values", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "gui-history-store-"));
    const historyPath = buildHistoryFilePath(root);
    await writeFile(
      historyPath,
      JSON.stringify(
        {
          records: {
            "fetch.url": ["ok-1", 123, "ok-2"],
            "fetch.out": "not-an-array",
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const urlValues = await getHistoryValues(historyPath, "fetch.url");
    const outValues = await getHistoryValues(historyPath, "fetch.out");
    expect(urlValues).toEqual(["ok-1", "ok-2"]);
    expect(outValues).toEqual([]);
  });
});

