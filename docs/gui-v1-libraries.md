# GUI V1 Libraries (Aligned with Plan + Workflow)

## Scope Alignment
This file follows:
- `docs/gui-v1-plan.md` (local-only V1)
- `docs/gui-v1-workflow.md` (phase-based delivery)

V1 assumption:
- frontend, bridge, and CLI run on the same machine.
- no remote transport in V1.

## V1 Core Libraries
- `express` or `fastify`
  - Purpose: local bridge API (`/api/commands`, `/api/run`, `/api/history`, `/api/browse-path`).
- `zod` (already in repo)
  - Purpose: request/response/config validation for bridge contracts.
- `react` + `react-dom` (optional but practical)
  - Purpose: dynamic command form UI and execution panels.

## V1 Optional Libraries
- `react-hook-form`
  - Purpose: simplify large argument-form handling.
- `@tanstack/react-query`
  - Purpose: caching/loading/retry state for command/history/browse APIs.
- `eventsource-parser`
  - Purpose: parse streamed run events if SSE is used for `/api/run`.
- `supertest`
  - Purpose: bridge integration testing.
- `playwright`
  - Purpose: end-to-end GUI testing.

## V1 by Workflow Phase

### Phase 0-2 (contracts, bridge, local executor)
- Required:
  - `express` or `fastify`
  - `zod`
- Usually not needed yet:
  - frontend/testing extras

### Phase 3-4 (history + browse-path)
- No new mandatory third-party library.
- Use Node built-ins for browse implementation:
  - `node:fs/promises` (`readdir`)
  - `Dirent`
- Optional:
  - `supertest` for endpoint contract checks

### Phase 5 (frontend command runner)
- Required if using React UI:
  - `react`, `react-dom`
- Optional:
  - `react-hook-form`
  - `@tanstack/react-query`
  - `eventsource-parser`

### Phase 6 (hardening + docs + E2E)
- Optional:
  - `playwright` for browser E2E
  - `supertest` for API regression coverage

## Small Usage Examples

### `express`
```ts
import express from "express";
const app = express();
app.use(express.json());
app.get("/api/commands", (_req, res) => res.json({ commands: [] }));
app.listen(8787);
```

### `fastify`
```ts
import Fastify from "fastify";
const app = Fastify();
app.get("/api/commands", async () => ({ commands: [] }));
await app.listen({ port: 8787 });
```

### `zod`
```ts
import { z } from "zod";
const BrowseReq = z.object({ path: z.string().min(1) });
const parsed = BrowseReq.parse(input);
```

### `eventsource-parser` (optional)
```ts
import { createParser } from "eventsource-parser";
const parser = createParser({ onEvent: (evt) => console.log(evt.data) });
parser.feed("event: stdout\ndata: hello\\n\\n");
```

### `supertest` (optional)
```ts
import request from "supertest";
import { app } from "../src/gui/bridge/app";
test("GET /api/commands", async () => {
  const res = await request(app).get("/api/commands");
  expect(res.status).toBe(200);
});
```

### `playwright` (optional)
```ts
import { test, expect } from "@playwright/test";
test("shows Run button", async ({ page }) => {
  await page.goto("http://localhost:8787");
  await expect(page.getByRole("button", { name: "Run" })).toBeVisible();
});
```

## V2 Remote Additions (Not V1)
- `ssh2`
  - For SSH executor in V2 (`docs/gui-v2-plan.md`).
- `ssh2-sftp-client` (optional)
  - Only if direct SFTP browsing is introduced later.

## Selection Guidance
- Keep V1 dependency footprint small.
- Add optional libraries only when a concrete pain appears.
- Preserve thin-wrapper model: CLI remains behavior/validation authority.
