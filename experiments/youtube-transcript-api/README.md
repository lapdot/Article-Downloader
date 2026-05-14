# YouTube Transcript API Experiment

This experiment fetches a YouTube transcript directly with
`youtube-transcript-api` and records the HTTP traffic produced by the library.
It is intentionally isolated from the production Node/TypeScript runtime.

## Purpose

- Fetch the full transcript for a public YouTube video.
- Avoid cookie proxies, browser cookies, authentication, and browser automation.
- Capture every HTTP request and response made while invoking the library API, so
  failures can be debugged from local trace files.

## Run

From the repository root:

```bash
python3 experiments/youtube-transcript-api/fetch_youtube_transcript.py "https://www.youtube.com/watch?v=cg6MD07Vz6U"
```

You can also pass a raw video ID:

```bash
python3 experiments/youtube-transcript-api/fetch_youtube_transcript.py cg6MD07Vz6U
```

The script defaults to English:

```bash
python3 experiments/youtube-transcript-api/fetch_youtube_transcript.py cg6MD07Vz6U --languages en
```

## Outputs

By default, outputs are written under
`artifacts/llm/work/youtube-transcript-api/`:

- `cg6MD07Vz6U.transcript.json`: structured transcript snippets with `text`,
  `start`, and `duration`.
- `cg6MD07Vz6U.transcript.txt`: readable transcript text.
- `cg6MD07Vz6U.metadata.json`: video ID, library versions, available
  transcripts, selected transcript metadata, output paths, and status.
- `cg6MD07Vz6U.http-trace.json`: complete request/response trace.
- `http/001_request.txt`, `http/001_response.txt`, and so on: human-readable
  request and response files for each HTTP call.

## Notes

The script passes a custom `requests.Session` into
`YouTubeTranscriptApi(http_client=session)`. The session records the prepared
request headers/body, response status/headers/body, elapsed time, and any
exception details.

For the sample video `cg6MD07Vz6U`, the library reports no manual transcript and
one English auto-generated transcript. A verified run fetched 1,825 snippets and
about 63.9k characters of plain text.

If DNS or network access is blocked by the environment, the script still writes
metadata and any trace entries it captured before the failure. If YouTube blocks
the current IP, the library error is preserved in metadata and the HTTP trace.
