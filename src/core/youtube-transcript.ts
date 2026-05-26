import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createOutputDir, writeJsonFile, writeTextFile } from "../utils/fs.js";
import type {
  YoutubeTranscriptInput,
  YoutubeTranscriptMetadata,
  YoutubeTranscriptResult,
  YoutubeTranscriptSnippet,
} from "../types.js";

const execFileAsync = promisify(execFile);
const DEFAULT_PYTHON_PATH = "python3";
const DEFAULT_LANGUAGES = ["en"];

interface HelperTranscriptPayload {
  video_id: string;
  language?: string;
  language_code?: string;
  is_generated?: boolean;
  snippet_count?: number;
  character_count?: number;
  snippets: YoutubeTranscriptSnippet[];
}

interface HelperSuccessPayload {
  ok: true;
  video_input: string;
  video_id: string;
  languages: string[];
  fetched_at: string;
  transcript: HelperTranscriptPayload;
}

interface HelperErrorPayload {
  ok: false;
  video_input?: string;
  video_id?: string;
  languages?: string[];
  fetched_at?: string;
  error?: {
    type?: string;
    message?: string;
  };
}

type HelperPayload = HelperSuccessPayload | HelperErrorPayload;

function projectRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "../..");
}

function helperPath(): string {
  return path.join(projectRoot(), "scripts", "youtube_transcript_fetcher.py");
}

function parseHelperPayload(stdout: string): HelperPayload {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("youtube transcript helper produced no JSON output");
  }
  return JSON.parse(trimmed) as HelperPayload;
}

function errorReason(payload: HelperErrorPayload): string {
  const message = payload.error?.message?.trim();
  if (message) {
    return message;
  }
  const type = payload.error?.type?.trim();
  if (type) {
    return `youtube transcript helper failed: ${type}`;
  }
  return "youtube transcript helper failed";
}

function formatTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const displaySeconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const displayMinutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  const timeParts = [
    String(hours).padStart(2, "0"),
    String(displayMinutes).padStart(2, "0"),
    String(displaySeconds).padStart(2, "0"),
  ].join(":");
  return `${timeParts}.${String(milliseconds).padStart(3, "0")}`;
}

function normalizeSnippetText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function markdownLineForSnippet(snippet: YoutubeTranscriptSnippet): string | undefined {
  const text = normalizeSnippetText(snippet.text);
  if (!text) {
    return undefined;
  }
  const start = formatTimestamp(snippet.start);
  const end = formatTimestamp(snippet.start + snippet.duration);
  return `- [${start} - ${end}] ${text}`;
}

function markdownForTranscript(metadata: YoutubeTranscriptMetadata, snippets: YoutubeTranscriptSnippet[]): string {
  const transcriptLines = snippets
    .map((snippet) => markdownLineForSnippet(snippet))
    .filter((line): line is string => Boolean(line));
  const lines = [
    `# YouTube Transcript: ${metadata.videoId}`,
    "",
    `- Source URL: ${metadata.videoInput}`,
    `- Video ID: ${metadata.videoId}`,
    `- Language: ${metadata.language ?? "unknown"}${metadata.languageCode ? ` (${metadata.languageCode})` : ""}`,
    `- Transcript type: ${metadata.isGenerated === true ? "auto-generated" : metadata.isGenerated === false ? "manual" : "unknown"}`,
    `- Snippets: ${metadata.snippetCount}`,
    `- Fetched at: ${metadata.fetchedAt}`,
    "",
    "## Transcript",
    "",
    ...transcriptLines,
    "",
  ];
  return lines.join("\n");
}

function metadataFromPayload(payload: HelperSuccessPayload): YoutubeTranscriptMetadata {
  const snippets = payload.transcript.snippets;
  const transcriptText = snippets.map((snippet) => snippet.text).join("\n");
  return {
    videoInput: payload.video_input,
    videoId: payload.video_id,
    languages: payload.languages,
    language: payload.transcript.language,
    languageCode: payload.transcript.language_code,
    isGenerated: payload.transcript.is_generated,
    snippetCount: payload.transcript.snippet_count ?? snippets.length,
    characterCount: payload.transcript.character_count ?? transcriptText.length,
    fetchedAt: payload.fetched_at,
  };
}

export async function fetchYoutubeTranscript(input: YoutubeTranscriptInput): Promise<YoutubeTranscriptResult> {
  const pythonPath = DEFAULT_PYTHON_PATH;
  const args = [
    helperPath(),
    input.url,
    "--languages",
    ...DEFAULT_LANGUAGES,
  ];

  let stdout = "";
  let stderr = "";
  let payload: HelperPayload;
  try {
    const result = await execFileAsync(pythonPath, args, {
      maxBuffer: 20 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
    payload = parseHelperPayload(stdout);
  } catch (error) {
    stdout = typeof (error as { stdout?: unknown }).stdout === "string" ? (error as { stdout: string }).stdout : "";
    stderr = typeof (error as { stderr?: unknown }).stderr === "string" ? (error as { stderr: string }).stderr : "";
    try {
      payload = parseHelperPayload(stdout);
    } catch {
      const message = error instanceof Error ? error.message : "unknown youtube transcript helper error";
      return {
        ok: false,
        url: input.url,
        reason: message,
        errorCode: "E_YOUTUBE_TRANSCRIPT",
        diagnostics: {
          pythonPath,
          stderr: stderr.trim(),
        },
      };
    }
  }

  if (!payload.ok) {
    return {
      ok: false,
      url: input.url,
      videoId: payload.video_id,
      reason: errorReason(payload),
      errorCode: "E_YOUTUBE_TRANSCRIPT",
      diagnostics: {
        pythonPath,
        helperErrorType: payload.error?.type ?? "",
        stderr: stderr.trim(),
      },
    };
  }

  const metadata = metadataFromPayload(payload);
  const outputDir = await createOutputDir(input.outDir, input.url);
  const markdownPath = path.join(outputDir, "transcript.md");
  const transcriptJsonPath = path.join(outputDir, "transcript.json");
  const metaPath = path.join(outputDir, "meta.json");
  const snippets = payload.transcript.snippets;

  await writeTextFile(markdownPath, markdownForTranscript(metadata, snippets));
  await writeJsonFile(transcriptJsonPath, snippets);
  await writeJsonFile(metaPath, {
    youtubeTranscript: {
      ...metadata,
      snippets: undefined,
    },
    transcriptJsonPath,
    markdownPath,
  });

  return {
    ok: true,
    url: input.url,
    videoId: metadata.videoId,
    outputDir,
    markdownPath,
    transcriptJsonPath,
    metaPath,
    metadata,
    snippets,
  };
}
