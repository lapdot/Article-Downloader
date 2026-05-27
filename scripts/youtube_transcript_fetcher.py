#!/usr/bin/env python3
"""Fetch a YouTube transcript and print structured JSON for the Node runtime."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from importlib.metadata import PackageNotFoundError, version
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError as exc:
    YouTubeTranscriptApi = None  # type: ignore[assignment]
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None


DEFAULT_LANGUAGES = ("en",)


@dataclass
class TranscriptSnippet:
    text: str
    start: float
    duration: float


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch a YouTube transcript and print structured JSON."
    )
    parser.add_argument("video", help="YouTube URL or video ID.")
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


def ok_payload(args: argparse.Namespace, video_id: str) -> dict[str, Any]:
    if YouTubeTranscriptApi is None:
        raise RuntimeError(
            "missing python dependency: run `uv sync` from the repository root"
        ) from IMPORT_ERROR

    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)
    selected_transcript = transcript_list.find_transcript(args.languages)
    fetched_transcript = selected_transcript.fetch(preserve_formatting=args.preserve_formatting)
    transcript_data = [
        TranscriptSnippet(
            text=str(snippet["text"]),
            start=float(snippet["start"]),
            duration=float(snippet["duration"]),
        )
        for snippet in fetched_transcript.to_raw_data()
    ]
    transcript_text = "\n".join(snippet.text for snippet in transcript_data)

    return {
        "ok": True,
        "video_input": args.video,
        "video_id": video_id,
        "languages": args.languages,
        "fetched_at": utc_now(),
        "youtube_transcript_api_version": package_version("youtube-transcript-api"),
        "available_transcripts": transcript_list_summary(transcript_list),
        "transcript": {
            "video_id": fetched_transcript.video_id,
            "language": fetched_transcript.language,
            "language_code": fetched_transcript.language_code,
            "is_generated": fetched_transcript.is_generated,
            "snippet_count": len(fetched_transcript),
            "character_count": len(transcript_text),
            "first_timestamp": fetched_transcript[0].start if len(fetched_transcript) else None,
            "last_timestamp": fetched_transcript[-1].start if len(fetched_transcript) else None,
            "snippets": [asdict(snippet) for snippet in transcript_data],
        },
    }


def error_payload(args: argparse.Namespace, exc: Exception) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "ok": False,
        "video_input": args.video,
        "languages": args.languages,
        "fetched_at": utc_now(),
        "error": {
            "type": type(exc).__name__,
            "message": str(exc),
        },
    }
    try:
        payload["video_id"] = extract_video_id(args.video)
    except Exception:
        pass
    return payload


def main() -> int:
    args = parse_args()
    try:
        video_id = extract_video_id(args.video)
        payload = ok_payload(args, video_id)
    except Exception as exc:
        payload = error_payload(args, exc)
        print(json.dumps(payload, ensure_ascii=False))
        return 1

    print(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
