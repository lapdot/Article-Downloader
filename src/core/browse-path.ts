import path from "node:path";
import { readdir } from "node:fs/promises";

export type BrowseEntryKind = "file" | "dir" | "symlink" | "other";

export interface BrowsePathEntry {
  name: string;
  fullPath: string;
  kind: BrowseEntryKind;
}

export interface BrowsePathResult {
  ok: boolean;
  path: string;
  entries?: BrowsePathEntry[];
  error?: {
    code: string;
    message: string;
  };
}

function mapDirentKind(isFile: boolean, isDirectory: boolean, isSymbolicLink: boolean): BrowseEntryKind {
  if (isFile) {
    return "file";
  }
  if (isDirectory) {
    return "dir";
  }
  if (isSymbolicLink) {
    return "symlink";
  }
  return "other";
}

export async function browsePath(targetPath: string): Promise<BrowsePathResult> {
  try {
    const resolvedPath = path.resolve(targetPath);
    const dirents = await readdir(resolvedPath, { withFileTypes: true });
    const entries = dirents
      .map((dirent) => ({
        name: dirent.name,
        fullPath: path.join(resolvedPath, dirent.name),
        kind: mapDirentKind(dirent.isFile(), dirent.isDirectory(), dirent.isSymbolicLink()),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      ok: true,
      path: resolvedPath,
      entries,
    };
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
        ? error.code
        : "E_BROWSE_FAILED";
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      ok: false,
      path: targetPath,
      error: { code, message },
    };
  }
}
