import path from "node:path";
import { appendFile, mkdir } from "node:fs/promises";

export interface GuiLogger {
  info(message: string): Promise<void>;
  error(message: string): Promise<void>;
}

class FileGuiLogger implements GuiLogger {
  constructor(private readonly logFilePath: string) {}

  private async write(level: "INFO" | "ERROR", message: string): Promise<void> {
    await mkdir(path.dirname(this.logFilePath), { recursive: true });
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    await appendFile(this.logFilePath, line, "utf8");
  }

  async info(message: string): Promise<void> {
    await this.write("INFO", message);
  }

  async error(message: string): Promise<void> {
    await this.write("ERROR", message);
  }
}

export function createGuiLogger(logsDir: string): GuiLogger {
  return new FileGuiLogger(path.join(logsDir, "gui-server.log"));
}
