export type GuiArgKind = "string" | "boolean";
export type GuiArgValueHint = "path" | "url" | "text";
export type GuiPathMode = "file" | "dir";
export type GuiInputMode = "name" | "text";

export interface GuiArgDescriptor {
  key: string;
  flag: string;
  description: string;
  required: boolean;
  kind: GuiArgKind;
  valueHint: GuiArgValueHint;
  pathMode?: GuiPathMode;
  inputMode?: GuiInputMode;
}

export interface GuiCommandDescriptor {
  name: string;
  description: string;
  args: GuiArgDescriptor[];
}

export interface GuiRunRequest {
  command: string;
  args: Record<string, unknown>;
}

export type GuiRunEventType = "started" | "stdout" | "stderr" | "exited" | "result";

export interface GuiRunEvent {
  type: GuiRunEventType;
  data: unknown;
}

export interface GuiRunResult {
  ok: boolean;
  exitCode: number | null;
  parsedJson?: unknown;
  stdout: string;
  stderr: string;
}

export interface BrowsePathRequest {
  path: string;
}

export interface BrowsePathApiResult {
  ok: boolean;
  path: string;
  entries?: Array<{
    name: string;
    fullPath: string;
    kind: "file" | "dir" | "symlink" | "other";
  }>;
  error?: {
    code: string;
    message: string;
  };
}
