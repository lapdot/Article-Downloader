import type { BrowsePathApiResult, GuiCommandDescriptor, GuiRunEvent, GuiRunRequest } from "../../shared/types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload?.error ?? `request failed: ${response.status}`);
  }
  return payload;
}

export async function getCommands(): Promise<GuiCommandDescriptor[]> {
  const payload = await fetchJson<{ commands: GuiCommandDescriptor[] }>("/api/commands");
  return Array.isArray(payload.commands) ? payload.commands : [];
}

export async function getHistoryValues(commandName: string, argKey: string): Promise<string[]> {
  const scopedKey = `${commandName}.${argKey}`;
  const payload = await fetchJson<{ values: string[] }>(`/api/history?argKey=${encodeURIComponent(scopedKey)}`);
  return Array.isArray(payload.values) ? payload.values : [];
}

export async function browsePath(pathValue: string): Promise<BrowsePathApiResult> {
  return fetchJson<BrowsePathApiResult>("/api/browse-path", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: pathValue }),
  });
}

export async function runCommandStream(
  requestBody: GuiRunRequest,
  onEvent: (event: GuiRunEvent) => void,
): Promise<void> {
  const response = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({}));
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `run failed: ${response.status}`;
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        onEvent(JSON.parse(line) as GuiRunEvent);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }
}
