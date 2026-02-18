import path from "node:path";
import { access, mkdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";
import { browsePath } from "../../core/browse-path.js";
import { getGuiCommandDescriptors } from "../shared/command-descriptors.js";
import { buildHistoryFilePath, getHistoryValues, putHistoryValue } from "./history-store.js";
import { createGuiLogger } from "./logger.js";
import { runCliLocal } from "./local-executor.js";
import { browsePathBodySchema, historyBodySchema, historyQuerySchema, runRequestSchema } from "./schemas.js";

function getProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../../..");
}

const PROJECT_ROOT = getProjectRoot();
const FRONTEND_DIST_ROOT = path.join(PROJECT_ROOT, "dist-gui");

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

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function writeNdjsonEvent(res: ServerResponse, type: string, data: unknown): void {
  res.write(`${JSON.stringify({ type, data })}\n`);
}

function createAssetRelativePath(pathname: string): string {
  return pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
}

async function registerApiRoutes(app: FastifyInstance, options: Required<GuiServerOptions>): Promise<void> {
  const logger = createGuiLogger(options.logsDir);
  const historyFilePath = buildHistoryFilePath(options.historyDir);

  app.get("/api/commands", async (_req, reply) => {
    reply.code(200).send({ ok: true, commands: getGuiCommandDescriptors() });
  });

  app.get("/api/history", async (req, reply) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: "argKey is required" });
      return;
    }
    const values = await getHistoryValues(historyFilePath, parsed.data.argKey);
    reply.code(200).send({ ok: true, values });
  });

  app.post("/api/history", async (req, reply) => {
    const parsed = historyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: "argKey and value must be strings" });
      return;
    }
    await putHistoryValue(historyFilePath, parsed.data.argKey, parsed.data.value);
    reply.code(200).send({ ok: true });
  });

  app.post("/api/browse-path", async (req, reply) => {
    const parsed = browsePathBodySchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: "path must be a string" });
      return;
    }
    const result = await browsePath(parsed.data.path);
    reply.code(result.ok ? 200 : 400).send(result);
  });

  app.post("/api/run", async (req, reply) => {
    const parsed = runRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ ok: false, error: "invalid run request" });
      return;
    }

    reply.hijack();
    const raw = reply.raw;
    raw.statusCode = 200;
    raw.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    raw.setHeader("Cache-Control", "no-cache");

    const body = parsed.data;
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
          writeNdjsonEvent(raw, event.type, event.data);
        },
      );
    } catch (error) {
      await logger.error(`run error: ${error instanceof Error ? error.message : "unknown error"}`);
      writeNdjsonEvent(raw, "result", {
        ok: false,
        exitCode: null,
        stdout: "",
        stderr: error instanceof Error ? error.message : "unknown error",
      });
    }
    raw.end();
  });
}

async function registerStaticRoutes(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: FRONTEND_DIST_ROOT,
    decorateReply: true,
    wildcard: false,
  });

  app.route({
    method: ["GET", "HEAD"],
    url: "/*",
    handler: async (req: FastifyRequest, reply: FastifyReply) => {
      const requestUrl = new URL(req.url, "http://localhost");
      const pathname = decodeURIComponent(requestUrl.pathname);

      if (pathname.startsWith("/api/")) {
        reply.code(404).send({ ok: false, error: "not found" });
        return;
      }

      const relativePath = createAssetRelativePath(pathname);
      const candidatePath = path.resolve(FRONTEND_DIST_ROOT, relativePath);
      const normalizedRoot = path.resolve(FRONTEND_DIST_ROOT);
      const rootPrefix = `${normalizedRoot}${path.sep}`;
      if (candidatePath !== normalizedRoot && !candidatePath.startsWith(rootPrefix)) {
        reply.code(400).send({ ok: false, error: "invalid path" });
        return;
      }

      if (await exists(candidatePath)) {
        return reply.sendFile(relativePath);
      }

      const indexPath = path.join(FRONTEND_DIST_ROOT, "index.html");
      if (await exists(indexPath)) {
        reply.type("text/html; charset=utf-8");
        return reply.sendFile("index.html");
      }

      reply.code(503).send({
        ok: false,
        error: "frontend assets not found; run `npm run gui:build` first",
      });
    },
  });
}

export async function startGuiServer(input: GuiServerOptions = {}): Promise<FastifyInstance> {
  const options = resolveServerOptions(input);
  await mkdir(options.historyDir, { recursive: true });
  await mkdir(options.logsDir, { recursive: true });
  await mkdir(options.outputDir, { recursive: true });
  const logger = createGuiLogger(options.logsDir);

  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  app.setErrorHandler(async (error, _req, reply) => {
    await logger.error(`request error: ${error instanceof Error ? error.message : "unknown error"}`);
    if (!reply.raw.writableEnded) {
      reply.code(500).send({
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  });

  await registerApiRoutes(app, options);
  await registerStaticRoutes(app);

  app.setNotFoundHandler(async (_req, reply) => {
    reply.code(404).send({ ok: false, error: "not found" });
  });

  await app.listen({ port: options.port });
  const address = app.server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : options.port;
  process.stdout.write(`GUI server running at http://localhost:${resolvedPort}\n`);
  process.stdout.write(`workspace-dir: ${options.workspaceDir}\n`);
  process.stdout.write(`history-dir: ${options.historyDir}\n`);
  process.stdout.write(`logs-dir: ${options.logsDir}\n`);
  process.stdout.write(`output-dir: ${options.outputDir}\n`);

  await logger.info(
    `server started: port=${String(options.port)} workspaceDir=${options.workspaceDir} historyDir=${options.historyDir} logsDir=${options.logsDir} outputDir=${options.outputDir}`,
  );
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const parsedPort = Number(parseArgValue("port"));
  const port = Number.isFinite(parsedPort) ? (parsedPort as number) : 8787;
  void startGuiServer({
    port,
    workspaceDir: parseArgValue("workspace-dir"),
    historyDir: parseArgValue("history-dir"),
    logsDir: parseArgValue("logs-dir"),
    outputDir: parseArgValue("output-dir"),
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
  });
}
