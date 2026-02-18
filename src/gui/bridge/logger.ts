import path from "node:path";
import { mkdirSync } from "node:fs";
import pino from "pino";

export interface GuiLogger {
  info(message: string): Promise<void>;
  error(message: string): Promise<void>;
}

class FileGuiLogger implements GuiLogger {
  private readonly logger: pino.Logger;

  constructor(logFilePath: string) {
    mkdirSync(path.dirname(logFilePath), { recursive: true });
    this.logger = pino(
      { level: "info" },
      pino.destination({
        dest: logFilePath,
        append: true,
        sync: false,
      }),
    );
  }

  async info(message: string): Promise<void> {
    this.logger.info(message);
  }

  async error(message: string): Promise<void> {
    this.logger.error(message);
  }
}

export function createGuiLogger(logsDir: string): GuiLogger {
  return new FileGuiLogger(path.join(logsDir, "gui-server.log"));
}
