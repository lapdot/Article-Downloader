import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

interface HistoryFile {
  records: Record<string, string[]>;
}

const HISTORY_MAX_ITEMS = 8;

async function loadHistory(historyFilePath: string): Promise<HistoryFile> {
  try {
    const raw = await readFile(historyFilePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || !("records" in parsed)) {
      return { records: {} };
    }
    const records = (parsed as { records: unknown }).records;
    if (!records || typeof records !== "object") {
      return { records: {} };
    }
    const normalized: Record<string, string[]> = {};
    for (const [key, values] of Object.entries(records as Record<string, unknown>)) {
      if (!Array.isArray(values)) {
        continue;
      }
      normalized[key] = values.filter((value): value is string => typeof value === "string");
    }
    return { records: normalized };
  } catch {
    return { records: {} };
  }
}

async function saveHistory(historyFilePath: string, history: HistoryFile): Promise<void> {
  await mkdir(path.dirname(historyFilePath), { recursive: true });
  await writeFile(historyFilePath, JSON.stringify(history, null, 2), "utf8");
}

export function buildHistoryFilePath(historyDir: string): string {
  return path.join(historyDir, "history.json");
}

export async function getHistoryValues(historyFilePath: string, argKey: string): Promise<string[]> {
  const history = await loadHistory(historyFilePath);
  return history.records[argKey] ?? [];
}

export async function putHistoryValue(historyFilePath: string, argKey: string, value: string): Promise<void> {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return;
  }
  const history = await loadHistory(historyFilePath);
  const existing = history.records[argKey] ?? [];
  const next = [normalizedValue, ...existing.filter((item) => item !== normalizedValue)].slice(
    0,
    HISTORY_MAX_ITEMS,
  );
  history.records[argKey] = next;
  await saveHistory(historyFilePath, history);
}
