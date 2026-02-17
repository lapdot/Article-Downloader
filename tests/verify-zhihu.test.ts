import { beforeEach, describe, expect, test, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("undici", () => ({
  fetch: fetchMock,
}));

import { verifyZhihuCookies } from "../src/adapters/zhihu.js";

describe("verifyZhihuCookies", () => {
  const DEFAULT_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("uses account settings page and returns ok for 200", async () => {
    fetchMock.mockResolvedValue({
      status: 200,
      text: vi.fn().mockResolvedValue("<html><body>账号 settings 123 页面</body></html>"),
    });

    const result = await verifyZhihuCookies([{ name: "z_c0", value: "abc" }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.zhihu.com/settings/account",
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
        headers: expect.objectContaining({
          "user-agent": DEFAULT_UA,
        }),
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.diagnostics?.verificationType).toBe("verified");
  });

  test("returns invalid/expired cookies for 301/302", async () => {
    fetchMock.mockResolvedValue({ status: 302 });

    const result = await verifyZhihuCookies([{ name: "z_c0", value: "abc" }]);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_COOKIE_INVALID");
    expect(result.reason).toContain("invalid or expired");
  });

  test("returns network/other issue for non-200/non-301/non-302", async () => {
    fetchMock.mockResolvedValue({ status: 500 });

    const result = await verifyZhihuCookies([{ name: "z_c0", value: "abc" }]);

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_FETCH_HTTP");
    expect(result.reason).toContain("network or other issue");
  });

  test("uses custom user agent when provided", async () => {
    fetchMock.mockResolvedValue({ status: 200 });

    const result = await verifyZhihuCookies([{ name: "z_c0", value: "abc" }], "UA_CUSTOM");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.zhihu.com/settings/account",
      expect.objectContaining({
        headers: expect.objectContaining({
          "user-agent": "UA_CUSTOM",
        }),
      }),
    );
    expect(result.ok).toBe(true);
  });
});
