import { describe, expect, test } from "vitest";
import {
  detectForeignPolicyContentType,
  detectForeignPolicySource,
  getForeignPolicyPdfFilename,
  getForeignPolicyPdfUrl,
} from "../src/adapters/foreignpolicy.js";

describe("foreignpolicy adapter", () => {
  test("detects article paths as post candidates", () => {
    expect(
      detectForeignPolicySource(
        new URL("https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid/"),
      ),
    ).toEqual({ sourceId: "foreignpolicy", contentType: "post" });
    expect(
      detectForeignPolicySource(
        new URL("https://www.foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid"),
      ),
    ).toEqual({ sourceId: "foreignpolicy", contentType: "post" });
  });

  test("ignores root and direct pdf urls", () => {
    expect(detectForeignPolicyContentType(new URL("https://foreignpolicy.com/"))).toBeNull();
    expect(
      detectForeignPolicySource(
        new URL("https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid.pdf"),
      ),
    ).toBeNull();
  });

  test("generates deterministic pdf urls while accepting optional trailing slash", () => {
    expect(
      getForeignPolicyPdfUrl(
        "https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid/",
      ),
    ).toBe(
      "https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid/?download_pdf=true",
    );
    expect(
      getForeignPolicyPdfUrl(
        "https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid?utm_source=test#top",
      ),
    ).toBe(
      "https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid/?download_pdf=true",
    );
  });

  test("generates slug-based pdf filenames", () => {
    expect(
      getForeignPolicyPdfFilename(
        "https://foreignpolicy.com/2026/05/12/trump-china-hawk-xi-jinping-covid/",
      ),
    ).toBe("trump-china-hawk-xi-jinping-covid.pdf");
  });
});
