import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { browsePath } from "../../core/browse-path.js";
import { getGuiCommandDescriptors } from "../shared/command-descriptors.js";
import type { BrowsePathRequest, GuiRunRequest } from "../shared/types.js";
import { buildHistoryFilePath, getHistoryValues, putHistoryValue } from "./history-store.js";
import { createGuiLogger } from "./logger.js";
import { runCliLocal } from "./local-executor.js";

function getProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../../..");
}

const PROJECT_ROOT = getProjectRoot();
const FRONTEND_ROOT = path.join(PROJECT_ROOT, "src", "gui", "frontend");

export interface GuiServerOptions {
  port?: number;
  workspaceDir?: string;
  historyDir?: string;
  logsDir?: string;
  outputDir?: string;
}

function parseArgValue(argName: string): string | undefined {
  const prefix = `--${argName}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function resolveServerOptions(input: GuiServerOptions): Required<GuiServerOptions> {
  const workspaceDir = path.resolve(input.workspaceDir ?? PROJECT_ROOT);
  const historyDir = path.resolve(input.historyDir ?? path.join(workspaceDir, ".local", "gui", "history"));
  const logsDir = path.resolve(input.logsDir ?? path.join(workspaceDir, ".local", "gui", "logs"));
  const outputDir = path.resolve(input.outputDir ?? path.join(workspaceDir, "output"));
  return {
    port: input.port ?? 8787,
    workspaceDir,
    historyDir,
    logsDir,
    outputDir,
  };
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const bodyText = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(bodyText) as T;
}

async function serveStaticFile(res: ServerResponse, filePath: string, contentType: string): Promise<void> {
  try {
    const content = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.end(content);
  } catch {
    writeJson(res, 404, { ok: false, error: "not found" });
  }
}

function writeNdjsonEvent(res: ServerResponse, type: string, data: unknown): void {
  res.write(`${JSON.stringify({ type, data })}\n`);
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  options: Required<GuiServerOptions>,
): Promise<boolean> {
  const logger = createGuiLogger(options.logsDir);
  const historyFilePath = buildHistoryFilePath(options.historyDir);
  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  const pathname = requestUrl.pathname;

  if (req.method === "GET" && pathname === "/api/commands") {
    writeJson(res, 200, { ok: true, commands: getGuiCommandDescriptors() });
    return true;
  }

  if (req.method === "GET" && pathname === "/api/history") {
    const argKey = requestUrl.searchParams.get("argKey");
    if (!argKey) {
      writeJson(res, 400, { ok: false, error: "argKey is required" });
      return true;
    }
    const values = await getHistoryValues(historyFilePath, argKey);
    writeJson(res, 200, { ok: true, values });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/history") {
    const body = await readJsonBody<{ argKey?: unknown; value?: unknown }>(req);
    if (typeof body.argKey !== "string" || typeof body.value !== "string") {
      writeJson(res, 400, { ok: false, error: "argKey and value must be strings" });
      return true;
    }
    await putHistoryValue(historyFilePath, body.argKey, body.value);
    writeJson(res, 200, { ok: true });
    return true;
  }

  if (req.method === "POST" && pathname === "/api/browse-path") {
    const body = await readJsonBody<BrowsePathRequest>(req);
    if (!body || typeof body.path !== "string") {
      writeJson(res, 400, { ok: false, error: "path must be a string" });
      return true;
    }
    const result = await browsePath(body.path);
    writeJson(res, result.ok ? 200 : 400, result);
    return true;
  }

  if (req.method === "POST" && pathname === "/api/run") {
    const body = await readJsonBody<GuiRunRequest>(req);
    if (!body || typeof body.command !== "string" || typeof body.args !== "object" || body.args === null) {
      writeJson(res, 400, { ok: false, error: "invalid run request" });
      return true;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");

    for (const [argKey, argValue] of Object.entries(body.args)) {
      if (typeof argValue === "string" && argValue.trim().length > 0) {
        await putHistoryValue(historyFilePath, `${body.command}.${argKey}`, argValue);
      }
    }

    try {
      await runCliLocal(
        body,
        {
          projectRoot: PROJECT_ROOT,
          workspaceDir: options.workspaceDir,
          outputDir: options.outputDir,
          logger,
        },
        (event) => {
          writeNdjsonEvent(res, event.type, event.data);
        },
      );
    } catch (error) {
      await logger.error(`run error: ${error instanceof Error ? error.message : "unknown error"}`);
      writeNdjsonEvent(res, "result", {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: error instanceof Error ? error.message : "unknown error",
      });
    }
    res.end();
    return true;
  }

  return false;
}

export function startGuiServer(input: GuiServerOptions = {}): http.Server {
  const options = resolveServerOptions(input);
  const logger = createGuiLogger(options.logsDir);
  void mkdir(options.historyDir, { recursive: true });
  void mkdir(options.logsDir, { recursive: true });
  void mkdir(options.outputDir, { recursive: true });
  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        if (await handleApi(req, res, options)) {
          return;
        }

        const requestUrl = new URL(req.url ?? "/", "http://localhost");
        const pathname = requestUrl.pathname;
        if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
          await serveStaticFile(res, path.join(FRONTEND_ROOT, "index.html"), "text/html; charset=utf-8");
          return;
        }
        if (req.method === "GET" && pathname === "/app.js") {
          await serveStaticFile(res, path.join(FRONTEND_ROOT, "app.js"), "text/javascript; charset=utf-8");
          return;
        }
        if (req.method === "GET" && pathname === "/styles.css") {
          await serveStaticFile(res, path.join(FRONTEND_ROOT, "styles.css"), "text/css; charset=utf-8");
          return;
        }

        writeJson(res, 404, { ok: false, error: "not found" });
      } catch (error) {
        await logger.error(`request error: ${error instanceof Error ? error.message : "unknown error"}`);
        writeJson(res, 500, {
          ok: false,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }
    })();
  });
  server.listen(options.port, () => {
    process.stdout.write(`GUI server running at http://localhost:${options.port}\n`);
    process.stdout.write(`workspace-dir: ${options.workspaceDir}\n`);
    process.stdout.write(`history-dir: ${options.historyDir}\n`);
    process.stdout.write(`logs-dir: ${options.logsDir}\n`);
    process.stdout.write(`output-dir: ${options.outputDir}\n`);
  });
  void logger.info(
    `server started: port=${String(options.port)} workspaceDir=${options.workspaceDir} historyDir=${options.historyDir} logsDir=${options.logsDir} outputDir=${options.outputDir}`,
  );
  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const parsedPort = Number(parseArgValue("port"));
  const port = Number.isFinite(parsedPort) ? (parsedPort as number) : 8787;
  startGuiServer({
    port,
    workspaceDir: parseArgValue("workspace-dir"),
    historyDir: parseArgValue("history-dir"),
    logsDir: parseArgValue("logs-dir"),
    outputDir: parseArgValue("output-dir"),
  });
}
