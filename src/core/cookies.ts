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

function debugValue(value: unknown): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[array length=${value.length}]`;
  }
  if (typeof value === "object") {
    return `[object keys=${Object.keys(value as Record<string, unknown>).join(",")}]`;
  }
  return `[type=${typeof value}]`;
}

function validateCookiesWithReason(value: unknown): { valid: true; cookies: Cookie[] } | { valid: false; reason: string } {
  if (!Array.isArray(value)) {
    return { valid: false, reason: `input must be an array, got ${debugValue(value)}` };
  }
  if (value.length === 0) {
    return { valid: false, reason: "input must be a non-empty array" };
  }

  for (const [index, cookie] of value.entries()) {
    if (!cookie || typeof cookie !== "object") {
      return {
        valid: false,
        reason: `cookie[${index}] must be an object, got ${debugValue(cookie)}`,
      };
    }

    const c = cookie as Record<string, unknown>;
    if (typeof c.name !== "string" || c.name.length === 0 || typeof c.value !== "string") {
      return {
        valid: false,
        reason: `cookie[${index}] requires non-empty string name and string value, got name=${debugValue(c.name)}, value=${debugValue(c.value)}`,
      };
    }
    if (c.domain !== undefined && typeof c.domain !== "string") {
      return {
        valid: false,
        reason: `cookie[${index}].domain must be a string when provided, got ${debugValue(c.domain)}`,
      };
    }
    if (typeof c.domain === "string") {
      const normalizedDomain = normalizeCookieDomain(c.domain);
      if (!normalizedDomain) {
        return {
          valid: false,
          reason: `cookie[${index}].domain must not be empty, got ${debugValue(c.domain)}`,
        };
      }
      if (!normalizedDomain.includes(".")) {
        return {
          valid: false,
          reason: `cookie[${index}].domain must include a dot, got ${debugValue(c.domain)}`,
        };
      }
    }
    if (c.path !== undefined && typeof c.path !== "string") {
      return {
        valid: false,
        reason: `cookie[${index}].path must be a string when provided, got ${debugValue(c.path)}`,
      };
    }
    if (typeof c.path === "string" && !c.path.startsWith("/")) {
      return {
        valid: false,
        reason: `cookie[${index}].path must start with "/", got ${debugValue(c.path)}`,
      };
    }
    if (c.expires !== undefined && typeof c.expires !== "number") {
      return {
        valid: false,
        reason: `cookie[${index}].expires must be a number when provided, got ${debugValue(c.expires)}`,
      };
    }
    if (c.httpOnly !== undefined && typeof c.httpOnly !== "boolean") {
      return {
        valid: false,
        reason: `cookie[${index}].httpOnly must be a boolean when provided, got ${debugValue(c.httpOnly)}`,
      };
    }
    if (c.secure !== undefined && typeof c.secure !== "boolean") {
      return {
        valid: false,
        reason: `cookie[${index}].secure must be a boolean when provided, got ${debugValue(c.secure)}`,
      };
    }
    if (
      c.sameSite !== undefined &&
      c.sameSite !== "Strict" &&
      c.sameSite !== "Lax" &&
      c.sameSite !== "None" &&
      c.sameSite !== "unspecified" &&
      c.sameSite !== "no_restriction"
    ) {
      return {
        valid: false,
        reason:
          `cookie[${index}].sameSite must be one of Strict|Lax|None|unspecified|no_restriction, ` +
          `got ${debugValue(c.sameSite)}`,
      };
    }
  }

  return { valid: true, cookies: value as Cookie[] };
}

export function validateCookies(value: unknown): value is Cookie[] {
  function debug(reason: string): void {
    console.error(`[validateCookies] ${reason}`);
  }

  const result = validateCookiesWithReason(value);
  if (!result.valid) {
    debug(result.reason);
    return false;
  }
  return true;
}

export function assertValidCookies(value: unknown): Cookie[] {
  const result = validateCookiesWithReason(value);
  if (!result.valid) {
    console.error(`[validateCookies] ${result.reason}`);
    throw new Error(
      `E_COOKIE_INVALID: ${result.reason}`,
    );
  }
  return result.cookies;
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
