# Experiments

This directory is the tracked home for prototype code that is related to ArticleDownloader but not part of the production runtime by default.

Use one subdirectory per experiment:

```text
experiments/
  <experiment-name>/
    README.md
    ...
```

Each experiment must include its own `README.md` with:

- purpose or hypothesis
- how to run it
- project APIs, source files, or artifact paths it touches
- current status or outcome

Experiment code is tracked even when the result is inconclusive or unsuccessful, so the reasoning and implementation history remain visible in git.

Do not treat files under `experiments/` as production code unless they are deliberately promoted into an established production surface such as `src/`.

Keep generated or bulky scratch outputs outside this directory unless they are intentionally curated. Prefer ignored artifact locations such as `artifacts/llm/work/` for temporary experiment outputs, and use `artifacts/runtime/` for runtime-produced files.

`.local/` remains reserved for local operational state such as GUI history and logs, not experiment content.
