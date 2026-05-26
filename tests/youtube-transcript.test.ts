import { chmod, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { fetchYoutubeTranscript } from "../src/core/youtube-transcript.js";
import { writeTextFile } from "../src/utils/fs.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

async function createFakePython(root: string, mode: "success" | "error" | "malformed"): Promise<string> {
  const binDir = path.join(root, "bin");
  const scriptPath = path.join(binDir, "python3");
  const successPayload = JSON.stringify({
    ok: true,
    video_input: "https://www.youtube.com/watch?v=abc123",
    video_id: "abc123",
    languages: ["en"],
    fetched_at: "2026-05-26T12:00:00+00:00",
    transcript: {
      video_id: "abc123",
      language: "English",
      language_code: "en",
      is_generated: true,
      snippet_count: 2,
      character_count: 25,
      snippets: [
        { text: "Hello from the video.", start: 0, duration: 1.2 },
        { text: "This is the transcript.", start: 1.2, duration: 2.4 },
      ],
    },
  });
  const errorPayload = JSON.stringify({
    ok: false,
    video_input: "https://www.youtube.com/watch?v=missing",
    video_id: "missing",
    languages: ["en"],
    fetched_at: "2026-05-26T12:00:00+00:00",
    error: {
      type: "NoTranscriptFound",
      message: "No transcript was found for this video.",
    },
  });
  const body =
    mode === "success"
      ? `printf '%s\\n' '${successPayload}'`
      : mode === "error"
        ? `printf '%s\\n' '${errorPayload}'
exit 1`
        : `printf '%s\\n' 'not json'
exit 1`;
  await writeTextFile(scriptPath, `#!/bin/sh\n${body}\n`);
  await chmod(scriptPath, 0o755);
  process.env.PATH = `${binDir}${path.delimiter}${ORIGINAL_ENV.PATH ?? ""}`;
  return scriptPath;
}

describe("youtube transcript core", () => {
  test("runs the Python helper and writes markdown artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-transcript-test-"));
    await createFakePython(root, "success");

    const result = await fetchYoutubeTranscript({
      url: "https://www.youtube.com/watch?v=abc123",
      outDir: path.join(root, "out"),
    });

    expect(result.ok).toBe(true);
    expect(result.videoId).toBe("abc123");
    expect(result.markdownPath).toBeDefined();
    expect(result.transcriptJsonPath).toBeDefined();
    expect(result.metaPath).toBeDefined();

    const markdown = await readFile(result.markdownPath!, "utf8");
    expect(markdown).toContain("# YouTube Transcript: abc123");
    expect(markdown).toContain("- Language: English (en)");
    expect(markdown).toContain("- [00:00:00.000 - 00:00:01.200] Hello from the video.");
    expect(markdown).toContain("- [00:00:01.200 - 00:00:03.600] This is the transcript.");

    const transcriptJson = await readFile(result.transcriptJsonPath!, "utf8");
    expect(transcriptJson).toContain("This is the transcript.");
  });

  test("returns structured failure when helper reports an error", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-transcript-test-"));
    await createFakePython(root, "error");

    const result = await fetchYoutubeTranscript({
      url: "https://www.youtube.com/watch?v=missing",
      outDir: path.join(root, "out"),
    });

    expect(result).toMatchObject({
      ok: false,
      videoId: "missing",
      reason: "No transcript was found for this video.",
      errorCode: "E_YOUTUBE_TRANSCRIPT",
    });
  });

  test("returns structured failure when helper output is malformed", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "youtube-transcript-test-"));
    await createFakePython(root, "malformed");

    const result = await fetchYoutubeTranscript({
      url: "https://www.youtube.com/watch?v=abc123",
      outDir: path.join(root, "out"),
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("E_YOUTUBE_TRANSCRIPT");
    expect(result.reason).toContain("Command failed");
  });
});
