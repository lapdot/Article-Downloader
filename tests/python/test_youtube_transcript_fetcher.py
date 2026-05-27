from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path

import pytest


def load_helper_module():
    script_path = Path(__file__).resolve().parents[2] / "scripts" / "youtube_transcript_fetcher.py"
    spec = importlib.util.spec_from_file_location("youtube_transcript_fetcher", script_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


helper = load_helper_module()


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("cg6MD07Vz6U", "cg6MD07Vz6U"),
        ("https://www.youtube.com/watch?v=cg6MD07Vz6U", "cg6MD07Vz6U"),
        ("https://m.youtube.com/watch?v=cg6MD07Vz6U&feature=youtu.be", "cg6MD07Vz6U"),
        ("https://music.youtube.com/watch?v=cg6MD07Vz6U", "cg6MD07Vz6U"),
        ("https://youtube.com/shorts/cg6MD07Vz6U", "cg6MD07Vz6U"),
        ("https://youtube.com/embed/cg6MD07Vz6U", "cg6MD07Vz6U"),
        ("https://youtu.be/cg6MD07Vz6U", "cg6MD07Vz6U"),
    ],
)
def test_extract_video_id_accepts_supported_inputs(value: str, expected: str) -> None:
    assert helper.extract_video_id(value) == expected


@pytest.mark.parametrize("value", ["", "   ", "https://example.com/watch?v=cg6MD07Vz6U"])
def test_extract_video_id_rejects_unsupported_inputs(value: str) -> None:
    with pytest.raises(ValueError):
        helper.extract_video_id(value)


def test_missing_dependency_error_points_to_uv(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(helper, "YouTubeTranscriptApi", None)
    monkeypatch.setattr(helper, "IMPORT_ERROR", ImportError("missing test dependency"))
    args = argparse.Namespace(
        video="cg6MD07Vz6U",
        languages=["en"],
        preserve_formatting=False,
    )

    with pytest.raises(RuntimeError, match="uv sync"):
        helper.ok_payload(args, "cg6MD07Vz6U")
