#!/usr/bin/env python3
"""Fetch a YouTube transcript and record the library's HTTP traffic."""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests
from youtube_transcript_api import YouTubeTranscriptApi


DEFAULT_VIDEO = "https://www.youtube.com/watch?v=cg6MD07Vz6U"
DEFAULT_LANGUAGES = ("en",)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def package_version(package_name: str) -> str:
    try:
        return version(package_name)
    except PackageNotFoundError:
        return "unknown"


def extract_video_id(value: str) -> str:
    candidate = value.strip()
    if not candidate:
        raise ValueError("Expected a YouTube URL or video ID, but got an empty value.")

    parsed = urlparse(candidate)
    if not parsed.scheme and not parsed.netloc:
        return candidate

    host = parsed.netloc.lower()
    if host.startswith("www."):
        host = host[4:]

    if host in {"youtube.com", "m.youtube.com", "music.youtube.com"}:
        query_video_id = parse_qs(parsed.query).get("v", [None])[0]
        if query_video_id:
            return query_video_id
        if parsed.path.startswith("/shorts/") or parsed.path.startswith("/embed/"):
            parts = [part for part in parsed.path.split("/") if part]
            if len(parts) >= 2:
                return parts[1]

    if host == "youtu.be":
        parts = [part for part in parsed.path.split("/") if part]
        if parts:
            return parts[0]

    raise ValueError(f"Could not extract a YouTube video ID from: {value}")


def body_to_text(body: Any) -> str:
    if body is None:
        return ""
    if isinstance(body, bytes):
        return body.decode("utf-8", errors="replace")
    return str(body)


def headers_to_dict(headers: Any) -> dict[str, str]:
    return {str(key): str(value) for key, value in dict(headers or {}).items()}


@dataclass
class HttpTraceEntry:
    sequence: int
    timestamp: str
    method: str
    url: str
    request_headers: dict[str, str] = field(default_factory=dict)
    request_body: str = ""
    response_status_code: int | None = None
    response_reason: str | None = None
    response_headers: dict[str, str] = field(default_factory=dict)
    response_body: str = ""
    elapsed_seconds: float | None = None
    exception_type: str | None = None
    exception_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "sequence": self.sequence,
            "timestamp": self.timestamp,
            "method": self.method,
            "url": self.url,
            "request_headers": self.request_headers,
            "request_body": self.request_body,
            "response_status_code": self.response_status_code,
            "response_reason": self.response_reason,
            "response_headers": self.response_headers,
            "response_body": self.response_body,
            "elapsed_seconds": self.elapsed_seconds,
            "exception_type": self.exception_type,
            "exception_message": self.exception_message,
        }


class RecordingSession(requests.Session):
    """A requests session that stores prepared request and response details."""

    def __init__(self) -> None:
        super().__init__()
        self.trace: list[HttpTraceEntry] = []

    def request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        sequence = len(self.trace) + 1
        started = time.perf_counter()
        entry = HttpTraceEntry(
            sequence=sequence,
            timestamp=utc_now(),
            method=method.upper(),
            url=url,
            request_headers=headers_to_dict(kwargs.get("headers")),
            request_body=body_to_text(kwargs.get("data") or kwargs.get("json")),
        )

        try:
            response = super().request(method, url, **kwargs)
        except Exception as exc:
            entry.elapsed_seconds = time.perf_counter() - started
            entry.exception_type = type(exc).__name__
            entry.exception_message = str(exc)

            request = getattr(exc, "request", None)
            if request is not None:
                entry.method = request.method
                entry.url = request.url
                entry.request_headers = headers_to_dict(request.headers)
                entry.request_body = body_to_text(request.body)

            response = getattr(exc, "response", None)
            if response is not None:
                self._record_response(entry, response)

            self.trace.append(entry)
            raise

        entry.elapsed_seconds = time.perf_counter() - started
        self._record_response(entry, response)
        self.trace.append(entry)
        return response

    def _record_response(
        self, entry: HttpTraceEntry, response: requests.Response
    ) -> None:
        request = response.request
        entry.method = request.method
        entry.url = request.url
        entry.request_headers = headers_to_dict(request.headers)
        entry.request_body = body_to_text(request.body)
        entry.response_status_code = response.status_code
        entry.response_reason = response.reason
        entry.response_headers = headers_to_dict(response.headers)
        entry.response_body = response.text


def transcript_list_summary(transcript_list: Any) -> list[dict[str, Any]]:
    summaries = []
    for transcript in transcript_list:
        summaries.append(
            {
                "video_id": transcript.video_id,
                "language": transcript.language,
                "language_code": transcript.language_code,
                "is_generated": transcript.is_generated,
                "is_translatable": transcript.is_translatable,
                "translation_languages": [
                    {
                        "language": translation.language,
                        "language_code": translation.language_code,
                    }
                    for translation in transcript.translation_languages
                ],
            }
        )
    return summaries


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def write_text_http_files(output_dir: Path, entries: list[HttpTraceEntry]) -> None:
    http_dir = output_dir / "http"
    http_dir.mkdir(parents=True, exist_ok=True)

    for entry in entries:
        prefix = f"{entry.sequence:03d}"
        request_lines = [
            f"{entry.method} {entry.url}",
            "",
            "Headers:",
            json.dumps(entry.request_headers, indent=2, ensure_ascii=False),
            "",
            "Body:",
            entry.request_body,
            "",
        ]
        (http_dir / f"{prefix}_request.txt").write_text("\n".join(request_lines))

        response_lines = [
            f"Status: {entry.response_status_code} {entry.response_reason}",
            f"Elapsed seconds: {entry.elapsed_seconds}",
            "",
            "Headers:",
            json.dumps(entry.response_headers, indent=2, ensure_ascii=False),
            "",
            "Body:",
            entry.response_body,
            "",
        ]
        if entry.exception_type:
            response_lines.insert(0, f"Exception: {entry.exception_type}")
            response_lines.insert(1, entry.exception_message or "")
            response_lines.insert(2, "")
        (http_dir / f"{prefix}_response.txt").write_text("\n".join(response_lines))


def default_output_dir() -> Path:
    return (
        Path(__file__).resolve().parents[2]
        / "artifacts"
        / "llm"
        / "work"
        / "youtube-transcript-api"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Fetch a YouTube transcript using youtube-transcript-api and record "
            "all HTTP requests/responses made by the library."
        )
    )
    parser.add_argument(
        "video",
        nargs="?",
        default=DEFAULT_VIDEO,
        help="YouTube URL or video ID. Defaults to the sample video.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=default_output_dir(),
        help="Directory for transcript and HTTP trace outputs.",
    )
    parser.add_argument(
        "--languages",
        nargs="+",
        default=list(DEFAULT_LANGUAGES),
        help="Language codes to try in priority order. Defaults to en.",
    )
    parser.add_argument(
        "--preserve-formatting",
        action="store_true",
        help="Ask the library to preserve supported HTML text formatting tags.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    video_id = extract_video_id(args.video)
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    session = RecordingSession()
    api = YouTubeTranscriptApi(http_client=session)
    base_name = video_id
    transcript_json_path = output_dir / f"{base_name}.transcript.json"
    transcript_text_path = output_dir / f"{base_name}.transcript.txt"
    metadata_path = output_dir / f"{base_name}.metadata.json"
    trace_path = output_dir / f"{base_name}.http-trace.json"

    metadata: dict[str, Any] = {
        "video_input": args.video,
        "video_id": video_id,
        "languages": args.languages,
        "started_at": utc_now(),
        "youtube_transcript_api_version": package_version("youtube-transcript-api"),
        "requests_version": requests.__version__,
        "outputs": {
            "transcript_json": str(transcript_json_path),
            "transcript_text": str(transcript_text_path),
            "metadata": str(metadata_path),
            "http_trace": str(trace_path),
            "http_text_dir": str(output_dir / "http"),
        },
    }

    try:
        transcript_list = api.list(video_id)
        metadata["available_transcripts"] = transcript_list_summary(transcript_list)

        selected_transcript = transcript_list.find_transcript(args.languages)
        fetched_transcript = selected_transcript.fetch(
            preserve_formatting=args.preserve_formatting
        )
        transcript_data = fetched_transcript.to_raw_data()
        transcript_text = "\n".join(snippet["text"] for snippet in transcript_data)

        write_json(transcript_json_path, transcript_data)
        transcript_text_path.write_text(transcript_text + "\n")

        metadata.update(
            {
                "status": "ok",
                "completed_at": utc_now(),
                "transcript": {
                    "video_id": fetched_transcript.video_id,
                    "language": fetched_transcript.language,
                    "language_code": fetched_transcript.language_code,
                    "is_generated": fetched_transcript.is_generated,
                    "snippet_count": len(fetched_transcript),
                    "character_count": len(transcript_text),
                    "first_timestamp": fetched_transcript[0].start
                    if len(fetched_transcript)
                    else None,
                    "last_timestamp": fetched_transcript[-1].start
                    if len(fetched_transcript)
                    else None,
                },
            }
        )

        print(f"Fetched transcript for {video_id}")
        print(f"  snippets: {len(fetched_transcript)}")
        print(f"  text: {transcript_text_path}")
        print(f"  json: {transcript_json_path}")
    except Exception as exc:
        metadata.update(
            {
                "status": "error",
                "completed_at": utc_now(),
                "error": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                },
            }
        )
        print(f"Failed to fetch transcript for {video_id}: {exc}")
        return_code = 1
    else:
        return_code = 0
    finally:
        write_json(trace_path, [entry.to_dict() for entry in session.trace])
        write_text_http_files(output_dir, session.trace)
        metadata["http_request_count"] = len(session.trace)
        write_json(metadata_path, metadata)
        print(f"  metadata: {metadata_path}")
        print(f"  http trace: {trace_path}")
        print(f"  http request/response files: {output_dir / 'http'}")

    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
