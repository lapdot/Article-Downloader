import path from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { findCommandDescriptor } from "../shared/command-descriptors.js";
import type { GuiRunEvent, GuiRunRequest, GuiRunResult } from "../shared/types.js";
import type { GuiLogger } from "./logger.js";

type OnEvent = (event: GuiRunEvent) => void;

function getProjectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../../..");
}

function resolveCliInvocation(projectRoot: string): { command: string; args: string[] } {
  const distCliPath = path.join(projectRoot, "dist", "cli.js");
  if (existsSync(distCliPath)) {
    return { command: process.execPath, args: [distCliPath] };
  }
  const tsxCliPath = path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs");
  const sourceCliPath = path.join(projectRoot, "src", "cli.ts");
  return { command: process.execPath, args: [tsxCliPath, sourceCliPath] };
}

function buildCliArgs(request: GuiRunRequest, outputDir?: string): string[] {
  const descriptor = findCommandDescriptor(request.command);
  if (!descriptor) {
    throw new Error(`unknown command: ${request.command}`);
  }
  const hasOutOption = descriptor.args.some((arg) => arg.key === "out");
  const hasOutFixturesOption = descriptor.args.some((arg) => arg.key === "outFixturesDir");
  const runArgs = { ...request.args };
  if (outputDir && hasOutOption && typeof runArgs.out !== "string") {
    runArgs.out = outputDir;
  }
  if (outputDir && hasOutFixturesOption && typeof runArgs.outFixturesDir !== "string") {
    runArgs.outFixturesDir = path.join(outputDir, "fixtures");
  }

  const args: string[] = [request.command];
  for (const argDescriptor of descriptor.args) {
    const value = runArgs[argDescriptor.key];
    if (argDescriptor.kind === "boolean") {
      if (value === true) {
        args.push(argDescriptor.flag);
      }
      continue;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      args.push(argDescriptor.flag, value);
    }
  }
  return args;
}

export interface LocalExecutorOptions {
  projectRoot?: string;
  workspaceDir: string;
  outputDir?: string;
  logger?: GuiLogger;
}

export async function runCliLocal(
  request: GuiRunRequest,
  options: LocalExecutorOptions,
  onEvent: OnEvent,
): Promise<GuiRunResult> {
  const projectRoot = options.projectRoot ?? getProjectRoot();
  const invocation = resolveCliInvocation(projectRoot);
  const cliArgs = [...invocation.args, ...buildCliArgs(request, options.outputDir)];

  onEvent({
    type: "started",
    data: {
      command: invocation.command,
      args: cliArgs,
    },
  });

  await options.logger?.info(`run started: ${request.command}`);
  return new Promise<GuiRunResult>((resolve, reject) => {
    const child = spawn(invocation.command, cliArgs, {
      cwd: options.workspaceDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stdout += text;
      onEvent({ type: "stdout", data: text });
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      stderr += text;
      onEvent({ type: "stderr", data: text });
    });

    child.on("error", (error) => {
      void options.logger?.error(`run failed to spawn: ${request.command}: ${error instanceof Error ? error.message : "unknown error"}`);
      reject(error);
    });

    child.on("close", (code) => {
      const exitCode = code ?? null;
      onEvent({ type: "exited", data: { exitCode } });

      const trimmed = stdout.trim();
      let parsedJson: unknown;
      if (trimmed.length > 0) {
        try {
          parsedJson = JSON.parse(trimmed);
        } catch {
          parsedJson = undefined;
        }
      }

      const result: GuiRunResult = {
        ok: exitCode === 0,
        exitCode,
        parsedJson,
        stdout,
        stderr,
      };
      onEvent({ type: "result", data: result });
      void options.logger?.info(`run finished: ${request.command}: exitCode=${String(exitCode)}`);
      resolve(result);
    });
  });
}
