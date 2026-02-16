import type { Cookie } from "../types.js";
import { Cookie as ToughCookie, CookieJar } from "tough-cookie";

const DEFAULT_COOKIE_URL = "https://www.zhihu.com/";

function normalizeCookieDomain(domain?: string): string | undefined {
  if (domain === undefined) {
    return undefined;
  }
  const trimmed = domain.trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith(".") ? trimmed.slice(1) : trimmed;
}

export function validateCookies(value: unknown): value is Cookie[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return value.every((cookie) => {
    if (!cookie || typeof cookie !== "object") {
      return false;
    }
    const c = cookie as Record<string, unknown>;
    if (typeof c.name !== "string" || c.name.length === 0 || typeof c.value !== "string") {
      return false;
    }
    if (c.domain !== undefined && typeof c.domain !== "string") {
      return false;
    }
    if (typeof c.domain === "string") {
      const normalizedDomain = normalizeCookieDomain(c.domain);
      if (!normalizedDomain) {
        return false;
      }
      if (!normalizedDomain.includes(".")) {
        return false;
      }
    }
    if (c.path !== undefined && typeof c.path !== "string") {
      return false;
    }
    if (typeof c.path === "string" && !c.path.startsWith("/")) {
      return false;
    }
    if (c.expires !== undefined && typeof c.expires !== "number") {
      return false;
    }
    if (c.httpOnly !== undefined && typeof c.httpOnly !== "boolean") {
      return false;
    }
    if (c.secure !== undefined && typeof c.secure !== "boolean") {
      return false;
    }
    if (
      c.sameSite !== undefined &&
      c.sameSite !== "Strict" &&
      c.sameSite !== "Lax" &&
      c.sameSite !== "None" &&
      c.sameSite !== "unspecified" &&
      c.sameSite !== "no_restriction"
    ) {
      return false;
    }
    return true;
  });
}

export function assertValidCookies(value: unknown): Cookie[] {
  if (!validateCookies(value)) {
    throw new Error(
      "E_COOKIE_INVALID: expected a non-empty JSON array of cookies with name and value fields",
    );
  }
  return value;
}

function mapSameSite(
  sameSite?: Cookie["sameSite"],
): "strict" | "lax" | "none" | undefined {
  if (sameSite === "Strict") {
    return "strict";
  }
  if (sameSite === "Lax") {
    return "lax";
  }
  if (sameSite === "unspecified") {
    return "lax";
  }
  if (sameSite === "None") {
    return "none";
  }
  if (sameSite === "no_restriction") {
    return "none";
  }
  return undefined;
}

function validateRequestUrl(requestUrl: string): void {
  try {
    new URL(requestUrl);
  } catch {
    throw new Error(`E_COOKIE_INVALID: invalid request URL: ${requestUrl}`);
  }
}

function createToughCookie(cookie: Cookie): ToughCookie {
  const sameSite = mapSameSite(cookie.sameSite);
  const normalizedDomain = normalizeCookieDomain(cookie.domain);
  const toughCookie = new ToughCookie({
    key: cookie.name,
    value: cookie.value,
    domain: normalizedDomain,
    path: cookie.path,
    expires: cookie.expires !== undefined ? new Date(cookie.expires) : "Infinity",
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite,
  });

  if (!toughCookie.validate()) {
    throw new Error(`E_COOKIE_INVALID: invalid cookie "${cookie.name}"`);
  }
  return toughCookie;
}

export function createCookieJar(cookies: Cookie[]): CookieJar {
  const validCookies = assertValidCookies(cookies);
  const jar = new CookieJar();

  for (const cookie of validCookies) {
    const toughCookie = createToughCookie(cookie);
    const normalizedDomain = normalizeCookieDomain(cookie.domain);
    const contextUrl = normalizedDomain
      ? `https://${normalizedDomain}${cookie.path ?? "/"}`
      : DEFAULT_COOKIE_URL;
    jar.setCookieSync(toughCookie, contextUrl, { ignoreError: false });
  }

  return jar;
}

export function toCookieHeaderForUrl(cookies: Cookie[], requestUrl: string): string {
  validateRequestUrl(requestUrl);
  const jar = createCookieJar(cookies);
  return jar.getCookieStringSync(requestUrl);
}

export function toCookieHeader(cookies: Cookie[]): string {
  return toCookieHeaderForUrl(cookies, DEFAULT_COOKIE_URL);
}
