# Environment Variables

This reference lists the environment variables currently recognized or checked by ArticleDownloader.

Policy owners:
- Runtime config and precedence rules: `../policies/runtime-contract.md`
- Closed-loop testing and secret-safety rules: `../policies/testing-and-safety.md`

Secret values must not be stored directly in environment variables for normal runtime configuration. Secret examples in this document use dummy values only.

## Supported Runtime Variables

| Variable | Secret | Example | Purpose |
| --- | --- | --- | --- |
| `ARTICLE_DOWNLOADER_PUBLIC_CONFIG_PATH` | No | `./config/public.config.json` | Public config file path fallback when `--config` is not provided. |
| `ARTICLE_DOWNLOADER_NOTION_SECRETS_PATH` | No | `./config/notion.secrets.local.json` | Notion secrets file path fallback when `--notion-secrets` is not provided. The path is not secret, but the file contents are. |
| `ARTICLE_DOWNLOADER_COOKIEPROXY_PATH` | No | `/Users/lapdot/Documents/projects/runnable/cookieproxy` | Cookieproxy executable path override. If unset, the built-in default path is `/Users/lapdot/Documents/projects/runnable/cookieproxy`. |
| `ARTICLE_DOWNLOADER_DEBUG_CONFIG` | No | `1` | Enables runtime-config debug logs when set to `1`. |

## Test And Safety Variables

| Variable | Secret | Example | Purpose |
| --- | --- | --- | --- |
| `ARTICLE_DOWNLOADER_CLOSED_LOOP` | No | `1` | Enables the closed-loop test mode used by `npm run test:closed-loop`, including preflight checks and localhost-only network guarding. |

## Secret-Related Variables Checked By Preflight

These variables are not supported runtime configuration inputs. Closed-loop preflight rejects them when they contain non-empty values, because this project loads real secrets from secret files instead of secret environment variable payloads.

| Variable | Secret | Dummy example only | Status |
| --- | --- | --- | --- |
| `NOTION_TOKEN` | Yes | `foobar` | Rejected by closed-loop preflight when non-empty. |
| `ARTICLE_DOWNLOADER_NOTION_TOKEN` | Yes | `foobar` | Rejected by closed-loop preflight when non-empty. |
| `ZHIHU_COOKIE` | Yes | `foobar` | Rejected by closed-loop preflight when non-empty. |
| `ARTICLE_DOWNLOADER_COOKIE_VALUE` | Yes | `foobar` | Rejected by closed-loop preflight when non-empty. |
| `Z_C0` | Yes | `foobar` | Rejected by closed-loop preflight when non-empty. |
