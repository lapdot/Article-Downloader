# Artifact Layout

This directory is the canonical home for local-generated content in ArticleDownloader.

Recommended subdirectories:

- `runtime/`: default CLI and GUI output artifacts such as fetched HTML, parsed Markdown, metadata, and Notion block JSON
- `llm/sources/`: local input material for LLM-assisted workflows
- `llm/work/`: temporary scratch space and intermediate runs for LLM tooling
- `llm/exports/`: final LLM-produced exports you want to keep or share

Notes:

- `runtime/`, `llm/sources/`, and `llm/work/` are gitignored by default
- `.local/` is reserved for local operational state such as GUI history and logs, not artifact storage
- explicit `--out` paths remain supported, so existing scripts can migrate gradually
