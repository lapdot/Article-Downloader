import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { startGuiServer } from "../src/gui/bridge/server.js";

const runningServers: FastifyInstance[] = [];

afterEach(async () => {
  while (runningServers.length > 0) {
    const server = runningServers.pop();
    if (server) {
      await server.close();
    }
  }
});

async function startTestServer(): Promise<{ app: FastifyInstance; baseUrl: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "gui-bridge-server-"));
  const app = await startGuiServer({
    port: 0,
    workspaceDir: root,
    historyDir: path.join(root, "history"),
    logsDir: path.join(root, "logs"),
    outputDir: path.join(root, "output"),
  });
  runningServers.push(app);
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to resolve bridge server address");
  }
  return { app, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe("gui bridge server", () => {
  it("returns commands list", async () => {
    const { baseUrl } = await startTestServer();
    const response = await fetch(`${baseUrl}/api/commands`);
    const payload = (await response.json()) as { ok?: boolean; commands?: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.commands)).toBe(true);
    expect((payload.commands?.length ?? 0) > 0).toBe(true);
  });

  it("validates history query and body contracts", async () => {
    const { baseUrl } = await startTestServer();

    const missingKey = await fetch(`${baseUrl}/api/history`);
    expect(missingKey.status).toBe(400);

    const invalidBody = await fetch(`${baseUrl}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ argKey: 123, value: "x" }),
    });
    expect(invalidBody.status).toBe(400);

    const save = await fetch(`${baseUrl}/api/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ argKey: "fetch.url", value: "https://example.com" }),
    });
    expect(save.status).toBe(200);

    const read = await fetch(`${baseUrl}/api/history?argKey=fetch.url`);
    const readPayload = (await read.json()) as { ok?: boolean; values?: string[] };
    expect(read.status).toBe(200);
    expect(readPayload.ok).toBe(true);
    expect(readPayload.values).toEqual(["https://example.com"]);
  });

  it("validates browse-path and run request contracts", async () => {
    const { baseUrl } = await startTestServer();

    const browseInvalid = await fetch(`${baseUrl}/api/browse-path`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: 123 }),
    });
    expect(browseInvalid.status).toBe(400);

    const runInvalid = await fetch(`${baseUrl}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "", args: null }),
    });
    expect(runInvalid.status).toBe(400);
  });
});

