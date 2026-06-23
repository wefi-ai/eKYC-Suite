# eKYC Suite MCP v1.1.0 Test Results

Date: 2026-06-16

Runtime used for validation:

- Node.js v24.14.0 in local Codex runtime
- MCP SDK 1.29.0

Command:

```bash
node test.mjs
```

Result:

```text
PASS: stdio, Streamable HTTP, and SSE MCP transports are runnable; 8 tools are discoverable; missing-credential error path is clean.
```

Coverage:

- stdio transport starts and responds to MCP client initialization.
- Streamable HTTP endpoint `/mcp` starts and lists 8 tools.
- Legacy SSE endpoint `/sse` starts and lists 8 tools.
- Missing KYC credential path returns a clean MCP tool error.
- `server.mjs` passes `node --check`.
- Hosted HTTP/SSE mode preserves compatibility after adding optional per-request credential header support.

Notes:

- Live upstream API calls were not executed because no test credentials were provided in this run.
- Marketplace review should use test credentials only.
