import { describe, expect, test } from "vitest";
import {
  assertValidCookies,
  toCookieHeader,
  toCookieHeaderForUrl,
  validateCookies,
} from "../src/core/cookies.js";

describe("cookies", () => {
  test("serializes JSON cookies into cookie header", () => {
    const cookies = [
      { name: "z_c0", value: "abc" },
      { name: "d_c0", value: "def" },
    ];

    expect(validateCookies(cookies)).toBe(true);
    expect(toCookieHeader(cookies)).toContain("z_c0=abc");
    expect(toCookieHeader(cookies)).toContain("d_c0=def");
  });

  test("throws on invalid cookies shape", () => {
    expect(() => assertValidCookies([])).toThrowError("E_COOKIE_INVALID");
    expect(() => assertValidCookies([{ name: "x" }])).toThrowError("E_COOKIE_INVALID");
    expect(() => assertValidCookies([{ name: "x", value: "y", secure: "true" }])).toThrowError(
      "E_COOKIE_INVALID",
    );
  });

  test("resolves duplicate names using URL-aware cookie semantics", () => {
    const cookies = [
      { name: "session", value: "root", domain: "www.zhihu.com", path: "/" },
      { name: "session", value: "nested", domain: "www.zhihu.com", path: "/settings" },
    ];

    const header = toCookieHeaderForUrl(cookies, "https://www.zhihu.com/settings/account");
    expect(header).toContain("session=nested");
    expect(header).toContain("session=root");
  });

  test("sends secure cookies only for https", () => {
    const cookies = [
      { name: "secure_cookie", value: "yes", domain: "www.zhihu.com", path: "/", secure: true },
    ];

    expect(toCookieHeaderForUrl(cookies, "https://www.zhihu.com/")).toContain("secure_cookie=yes");
    expect(toCookieHeaderForUrl(cookies, "http://www.zhihu.com/")).toBe("");
  });

  test("excludes expired cookies", () => {
    const cookies = [
      {
        name: "expired_cookie",
        value: "old",
        domain: "www.zhihu.com",
        path: "/",
        expires: Date.now() - 60_000,
      },
    ];

    expect(toCookieHeaderForUrl(cookies, "https://www.zhihu.com/")).toBe("");
  });

  test("throws on invalid request URL", () => {
    const cookies = [{ name: "z_c0", value: "abc" }];
    expect(() => toCookieHeaderForUrl(cookies, "not-a-url")).toThrowError("E_COOKIE_INVALID");
  });

  test("compatibility wrapper uses default zhihu URL", () => {
    const cookies = [
      { name: "z_c0", value: "abc", domain: "www.zhihu.com", path: "/" },
      { name: "api", value: "hidden", domain: "api.zhihu.com", path: "/" },
    ];

    const header = toCookieHeader(cookies);
    expect(header).toContain("z_c0=abc");
    expect(header).not.toContain("api=hidden");
  });

  test("supports leading-dot domain cookies", () => {
    const cookies = [{ name: "z_c0", value: "abc", domain: ".zhihu.com", path: "/" }];

    const header = toCookieHeaderForUrl(cookies, "https://www.zhihu.com/settings/account");
    expect(header).toContain("z_c0=abc");
  });

  test("treats .zhihu.com and zhihu.com equivalently for subdomain matching", () => {
    const requestUrl = "https://www.zhihu.com/settings/account";
    const dotted = [{ name: "z_c0", value: "abc", domain: ".zhihu.com", path: "/" }];
    const plain = [{ name: "z_c0", value: "abc", domain: "zhihu.com", path: "/" }];

    const dottedHeader = toCookieHeaderForUrl(dotted, requestUrl);
    const plainHeader = toCookieHeaderForUrl(plain, requestUrl);

    expect(dottedHeader).toBe("z_c0=abc");
    expect(plainHeader).toBe("z_c0=abc");
  });
});
