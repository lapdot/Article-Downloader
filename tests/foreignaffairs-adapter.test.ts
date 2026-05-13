import { describe, expect, test } from "vitest";
import {
  detectForeignAffairsContentType,
  detectForeignAffairsSource,
  extractForeignAffairsPdfUrl,
  getForeignAffairsPdfFilename,
} from "../src/adapters/foreignaffairs.js";

describe("foreignaffairs adapter", () => {
  test("detects arbitrary article section paths as post candidates", () => {
    expect(
      detectForeignAffairsSource(
        new URL("https://www.foreignaffairs.com/united-states/example-article"),
      ),
    ).toEqual({ sourceId: "foreignaffairs", contentType: "post" });
    expect(
      detectForeignAffairsSource(
        new URL("https://foreignaffairs.com/asia/example-article"),
      ),
    ).toEqual({ sourceId: "foreignaffairs", contentType: "post" });
  });

  test("detects podcasts by path", () => {
    expect(
      detectForeignAffairsContentType(
        new URL("https://www.foreignaffairs.com/podcasts/example-episode"),
      ),
    ).toBe("podcast");
  });

  test("ignores pdf file urls as source pages", () => {
    expect(
      detectForeignAffairsSource(
        new URL("https://www.foreignaffairs.com/system/files/pdf/2026/105301.pdf"),
      ),
    ).toBeNull();
  });

  test("extracts numeric magazine pdf links", () => {
    const html = `<!doctype html>
<html><body><a href="/system/files/pdf/2026/105301.pdf">PDF</a></body></html>`;

    expect(extractForeignAffairsPdfUrl(html)).toBe(
      "https://www.foreignaffairs.com/system/files/pdf/2026/105301.pdf",
    );
  });

  test("extracts slug/date pdf links from embedded text", () => {
    const html = `window.settings = {"pdf":"https:\\/\\/foreignaffairs.com\\/system\\/files\\/pdf\\/2026\\/the-dangers-of-a-weak-iran-2026-03-12-10-17.pdf"}`;

    expect(extractForeignAffairsPdfUrl(html)).toBe(
      "https://foreignaffairs.com/system/files/pdf/2026/the-dangers-of-a-weak-iran-2026-03-12-10-17.pdf",
    );
  });

  test("keeps the original pdf basename", () => {
    expect(
      getForeignAffairsPdfFilename(
        "https://www.foreignaffairs.com/system/files/pdf/2026/105301.pdf",
      ),
    ).toBe("105301.pdf");
  });
});
