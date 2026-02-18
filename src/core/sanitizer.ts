import { load, type CheerioAPI } from "cheerio";
import { isTag, type DataNode, type Element } from "domhandler";
import type {
  LedgerNode,
  SanitizationCategory,
  SanitizationMapEntry,
  SanitizationResult,
  StructureLedger,
  ValueClass,
} from "../types.js";

const TRACKING_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "spm",
  "xsec_source",
  "xsec_token",
  "from",
  "_t",
]);

const FORBIDDEN_SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._-]{16,}\b/i,
  /\bntn_[A-Za-z0-9._-]{8,}\b/i,
  /\bsecret[-_][A-Za-z0-9._-]{8,}\b/i,
  /cookies\.secrets\.local\.json/i,
  /notion\.secrets\.local\.json/i,
  /"notionToken"\s*:/i,
  /\bz_c0["'\s:=]{1,}["']?[A-Za-z0-9._-]{8,}/i,
];

interface LedgerDiffResult {
  ok: boolean;
  violations: string[];
  warnings: string[];
}

interface PlaceholderStore {
  counters: Record<SanitizationCategory, number>;
  seen: Map<string, string>;
}

function createPlaceholderStore(): PlaceholderStore {
  return {
    counters: {
      person: 0,
      content_id: 0,
      token: 0,
      cookie: 0,
      tracking: 0,
    },
    seen: new Map(),
  };
}

function nextPlaceholder(category: SanitizationCategory, store: PlaceholderStore, raw: string): string {
  const key = `${category}::${raw}`;
  const existing = store.seen.get(key);
  if (existing) {
    return existing;
  }
  store.counters[category] += 1;
  const n = String(store.counters[category]).padStart(3, "0");
  const prefix =
    category === "person" ? "PERSON" :
    category === "content_id" ? "CID" :
    category === "token" ? "TOKEN" :
    category === "cookie" ? "COOKIE" :
    "TRACK";
  const placeholder = `${prefix}_${n}`;
  store.seen.set(key, placeholder);
  return placeholder;
}

function classifyValue(value: string): ValueClass {
  const trimmed = value.trim();
  if (!trimmed) {
    return "empty";
  }
  if (/^[A-Za-z]:\\/.test(trimmed) || /^\//.test(trimmed)) {
    return "path_like";
  }
  if (/^https?:\/\//i.test(trimmed) || /^\/\//.test(trimmed)) {
    return "url";
  }
  if (/^[0-9]{9,}$/.test(trimmed)) {
    return "long_numeric_id";
  }
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}(?:[T\s][0-9:.+-Z]+)?$/.test(trimmed)) {
    return "timestamp_like";
  }
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return "email_like";
  }
  if (/\b(ntn_[A-Za-z0-9._-]{8,}|[A-Za-z0-9._-]{24,})\b/.test(trimmed)) {
    return "token_like";
  }
  return "plain_text";
}

function getElementNodePath($: CheerioAPI, element: Element): string {
  let current = $(element);
  const segments: string[] = [];
  while (current.length > 0) {
    const currentNode = current.get(0);
    if (!currentNode || !isTag(currentNode)) {
      break;
    }
    const tag = currentNode.tagName;
    if (!tag || tag === "html") {
      break;
    }
    const parent = current.parent();
    const sameTagSiblings = parent
      .children()
      .toArray()
      .filter((node) => isTag(node) && node.tagName === tag);
    const index = sameTagSiblings.findIndex((node) => node === currentNode);
    segments.unshift(`${tag}[${index + 1}]`);
    current = parent;
  }
  return `/${segments.join("/")}`;
}

export function analyzeStructure(html: string, policyVersion = "v1"): StructureLedger {
  const $ = load(html);
  const nodes: LedgerNode[] = [];

  $("*").each((_i, element) => {
    if (!isTag(element)) {
      return;
    }
    const attrs = element.attribs ?? {};
    const attributesPresent = Object.keys(attrs).sort();
    const attributeValueClass: Record<string, ValueClass> = {};
    for (const attrName of attributesPresent) {
      attributeValueClass[attrName] = classifyValue(attrs[attrName] ?? "");
    }
    const text = $(element as Element).text().trim();
    nodes.push({
      nodePath: getElementNodePath($, element as Element),
      tagName: element.tagName,
      attributesPresent,
      attributeValueClass,
      textClass: text ? classifyValue(text) : undefined,
    });
  });

  nodes.sort((a, b) => a.nodePath.localeCompare(b.nodePath));
  return {
    policyVersion,
    nodes,
  };
}

function sanitizeZhihuRoutes(input: string, store: PlaceholderStore): string {
  return input
    .replace(/(\/question\/)(\d{9,})/g, (_m, p1, p2) => `${p1}${nextPlaceholder("content_id", store, p2)}`)
    .replace(/(\/answer\/)(\d{9,})/g, (_m, p1, p2) => `${p1}${nextPlaceholder("content_id", store, p2)}`)
    .replace(/(\/pin\/)(\d{9,})/g, (_m, p1, p2) => `${p1}${nextPlaceholder("content_id", store, p2)}`)
    .replace(/(\/p\/)(\d{9,})/g, (_m, p1, p2) => `${p1}${nextPlaceholder("content_id", store, p2)}`);
}

function sanitizeUrlLike(input: string, store: PlaceholderStore): string {
  const routeSanitized = sanitizeZhihuRoutes(input, store)
    .replace(/(\/people\/)\b[a-z0-9_-]{3,}\b/gi, (_m, p1) => `${p1}${nextPlaceholder("person", store, "people")}`);

  if (!/^https?:\/\//i.test(routeSanitized)) {
    return routeSanitized;
  }

  try {
    const url = new URL(routeSanitized);
    const keys = [...url.searchParams.keys()];
    for (const key of keys) {
      const value = url.searchParams.get(key) ?? "";
      if (TRACKING_QUERY_KEYS.has(key.toLowerCase())) {
        url.searchParams.set(key, nextPlaceholder("tracking", store, `${key}:${value}`));
        continue;
      }
      if (/\d{9,}/.test(value) || /[A-Za-z0-9._-]{24,}/.test(value)) {
        url.searchParams.set(key, nextPlaceholder("tracking", store, `${key}:${value}`));
      }
    }
    return url.toString();
  } catch {
    return routeSanitized;
  }
}

function sanitizeTokens(input: string, store: PlaceholderStore): string {
  let result = input;
  result = result.replace(/\bntn_[A-Za-z0-9._-]{8,}\b/g, (m) => nextPlaceholder("token", store, m));
  result = result.replace(/\bBearer\s+[A-Za-z0-9._-]{16,}\b/gi, (m) => {
    return `Bearer ${nextPlaceholder("token", store, m)}`;
  });
  result = result.replace(/\bz_c0\s*[=:]\s*[^;\s"]+/gi, (m) => {
    const suffix = nextPlaceholder("cookie", store, m);
    return `z_c0=${suffix}`;
  });
  result = result.replace(/\b[A-Za-z0-9._-]{24,}\b/g, (m) => {
    if (/^(?:https?:)?\/\//i.test(m)) {
      return m;
    }
    return nextPlaceholder("token", store, m);
  });
  return result;
}

function sanitizePersonish(input: string, store: PlaceholderStore): string {
  return input.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g, (m) => {
    if (["Zhihu", "HTML", "URL", "POST", "GET"].includes(m)) {
      return m;
    }
    return nextPlaceholder("person", store, m);
  });
}

function sanitizeScalar(input: string, store: PlaceholderStore, context: "text" | "attr"): string {
  let result = input;
  result = sanitizeTokens(result, store);
  result = sanitizeUrlLike(result, store);

  if (context === "attr" && /^[0-9]{9,}$/.test(result.trim())) {
    return nextPlaceholder("content_id", store, result.trim());
  }

  if (/\b(name|author|user)\b/i.test(result) || context === "text") {
    result = sanitizePersonish(result, store);
  }

  result = result.replace(/\b\d{9,}\b/g, (m) => nextPlaceholder("content_id", store, m));
  return result;
}

export function sanitizeHtmlForFixture(
  html: string,
  sourceUrl: string,
  policyVersion = "v1",
): SanitizationResult {
  // Validate source URL early to keep ingest failures explicit.
  new URL(sourceUrl);

  const rawLedger = analyzeStructure(html, policyVersion);
  const $ = load(html);
  const store = createPlaceholderStore();

  $("*").each((_i, element) => {
    if (!isTag(element)) {
      return;
    }
    const attrs = element.attribs ?? {};
    for (const [key, raw] of Object.entries(attrs)) {
      const value = String(raw ?? "");
      const shouldSanitizeAttr =
        /token|cookie|auth|session|secret/i.test(key) ||
        /url|href|src|content|value|data-/.test(key) ||
        key === "alt" ||
        key === "title";
      if (!shouldSanitizeAttr) {
        continue;
      }
      let sanitizedValue = sanitizeScalar(value, store, "attr");
      const itemprop = String(attrs.itemprop ?? "");
      const personishAttr =
        /name|author|user/i.test(key) ||
        (key === "content" && /name|author|user/i.test(itemprop));
      if (personishAttr) {
        sanitizedValue = sanitizePersonish(sanitizedValue, store);
      }
      attrs[key] = sanitizedValue;
    }
  });

  $("body, article, main, div, p, span, li, h1, h2, h3, h4").each((_i, element) => {
    if (!isTag(element)) {
      return;
    }
    const node = $(element);
    const text = node.text();
    if (!text || !text.trim()) {
      return;
    }

    const sanitizedText = sanitizeScalar(text, store, "text");
    if (sanitizedText !== text) {
      node.contents().each((_j, child) => {
        if (child.type === "text") {
          const textChild = child as DataNode;
          if (textChild.data) {
            textChild.data = sanitizeScalar(textChild.data, store, "text");
          }
        }
      });
    }
  });

  const sanitizedHtml = $.html();
  const sanitizedLedger = analyzeStructure(sanitizedHtml, policyVersion);

  const map: SanitizationMapEntry[] = [];
  for (const [key, placeholder] of store.seen.entries()) {
    const [category] = key.split("::") as [SanitizationCategory, string];
    const sourceType = category === "tracking" ? "query" : "attr";
    map.push({
      placeholder,
      category,
      sourceType,
    });
  }
  map.sort((a, b) => a.placeholder.localeCompare(b.placeholder));

  return {
    sanitizedHtml,
    map,
    rawLedger,
    sanitizedLedger,
  };
}

function isTransitionAllowed(from: ValueClass, to: ValueClass): boolean {
  if (from === to) {
    return true;
  }
  if (from === "long_numeric_id" && to === "plain_text") {
    return true;
  }
  if (from === "token_like" && to === "plain_text") {
    return true;
  }
  if (from === "url" && to === "url") {
    return true;
  }
  return false;
}

export function diffStructureLedger(raw: StructureLedger, sanitized: StructureLedger): LedgerDiffResult {
  const rawMap = new Map(raw.nodes.map((node) => [node.nodePath, node]));
  const sanitizedMap = new Map(sanitized.nodes.map((node) => [node.nodePath, node]));
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const [nodePath, rawNode] of rawMap.entries()) {
    const sanitizedNode = sanitizedMap.get(nodePath);
    if (!sanitizedNode) {
      violations.push(`missing node in sanitized ledger: ${nodePath}`);
      continue;
    }

    if (rawNode.tagName !== sanitizedNode.tagName) {
      violations.push(`tag mismatch at ${nodePath}: ${rawNode.tagName} -> ${sanitizedNode.tagName}`);
    }

    for (const attr of rawNode.attributesPresent) {
      if (!sanitizedNode.attributesPresent.includes(attr)) {
        violations.push(`missing attribute at ${nodePath}: ${attr}`);
        continue;
      }
      const from = rawNode.attributeValueClass[attr];
      const to = sanitizedNode.attributeValueClass[attr];
      if (!isTransitionAllowed(from, to)) {
        violations.push(`value class change not allowed at ${nodePath}.${attr}: ${from} -> ${to}`);
      }
    }
  }

  for (const [nodePath] of sanitizedMap.entries()) {
    if (!rawMap.has(nodePath)) {
      warnings.push(`new node introduced during sanitization: ${nodePath}`);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    warnings,
  };
}

export function findForbiddenSecretPatterns(content: string): string[] {
  const hits: string[] = [];
  for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
    if (pattern.test(content)) {
      hits.push(pattern.toString());
    }
  }
  return hits;
}
