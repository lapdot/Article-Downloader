# GUI Bridge

The GUI is a local-only wrapper around the CLI. It adds input assistance and browser presentation, but does not replace CLI authority.

## Components

- `src/gui/bridge/server.ts`: Fastify bridge server
- `src/gui/bridge/local-executor.ts`: CLI subprocess execution
- `src/gui/bridge/history-store.ts`: recent-input persistence
- `src/gui/bridge/schemas.ts`: bridge request and response validation
- `src/gui/frontend-react/`: React frontend served through the bridge

## Responsibilities

- Serve built frontend assets
- Expose command metadata and history
- Assist with local path browsing
- Stream run output back to the frontend

## Non-Responsibilities

- Replacing CLI validation
- Enforcing stronger path requirements than the runtime
- Changing runtime failure semantics

See `docs/policies/gui-contract.md` for the authoritative contract.
