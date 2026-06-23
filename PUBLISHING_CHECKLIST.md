# eKYC Suite MCP Publishing Checklist

## Release status

The MCP server is technically ready for marketplace review after the v1.1.0 packaging updates in this bundle.

Validated:

- stdio transport starts and lists 8 tools.
- Streamable HTTP `/mcp` starts and lists 8 tools.
- Legacy SSE `/sse` starts and lists 8 tools.
- Missing credentials return clean MCP errors.
- `server.mjs` passes Node syntax check.
- No production credentials are included.
- No internal npm registry URLs remain in `package-lock.json`.
- No banned institution names appear in docs or listing copy.

Known exception:

- `server.mjs` contains `webankAppId` only as a required upstream API field name in request payloads. Do not rename this field unless the upstream API changes.

## Blocking items before public submission

### 1. Hosted submission needs a public HTTPS MCP endpoint

Baidu MCP-SSE style integration needs a reachable Server URL. This package can serve:

- `https://<domain>/sse` for legacy SSE MCP
- `https://<domain>/mcp` for Streamable HTTP MCP
- `https://<domain>/healthz` for health check

Current bundle does not include a deployed public endpoint. Deploy it first if the platform asks for a hosted URL.

### 2. Local/npm submission needs npm publication or tgz upload support

The recommended Local config uses:

```json
{
  "command": "npx",
  "args": ["-y", "@wefi-ai/ekyc-suite-mcp"]
}
```

Registry check on 2026-06-17 confirmed the npm package is `@wefi-ai/ekyc-suite-mcp`, with older versions already published. Therefore this Local config will work after v1.1.0 is published to that package.

If the marketplace does not support scoped package names, use Hosted mode instead.

### 3. Platform login and account review are required

Publishing to Baidu or ModelScope/Alibaba requires account login and may require provider review. Be ready with:

- Product title and description from `MCP_DETAIL_PAGE.md`
- Icon/logo asset if required
- Test credentials for review
- Public HTTPS endpoint for Hosted mode, or npm/tgz source for Local mode
- Privacy/security statement from `MARKETPLACE_COPY.md`
- Credential strategy: environment variables for private/test deployments, or request headers if the marketplace supports custom auth headers

## Recommended platform strategy

### Baidu

Use Hosted/SSE mode.

- Deploy the server behind HTTPS.
- Submit `https://<domain>/sse` as the MCP Server URL.
- Set credential variables through environment variables or custom request headers: `x-kyc-appid`, `x-kyc-secret`, `x-label-appid`, `x-label-secret`.
- Verify that the platform displays 8 tools after connection.

### ModelScope / Alibaba

If no public endpoint is ready, use Local mode only after npm publication or tgz-upload confirmation.

If a public endpoint is ready, use Hosted mode:

- Streamable HTTP: `https://<domain>/mcp`
- SSE, if requested: `https://<domain>/sse`
- Health: `https://<domain>/healthz`

### Tencent Cloud

The server is protocol-compatible for hosted MCP if Tencent Cloud accepts public MCP endpoints, but this bundle has not been submitted there in this run. Use the same hosted endpoint and credential model after checking the current Tencent Cloud marketplace form.

## Packaging changes made in this bundle

- Locked `@modelcontextprotocol/sdk` to `1.29.0`.
- Changed `start:stdio` and `start:http` scripts to cross-platform `node server.mjs --transport=...`.
- Rewrote marketplace copy for MCP listing pages.
- Added `MCP_DETAIL_PAGE.md` for form-ready marketplace content.
- Added `ALLOWED_HOSTS` guidance to deployment docs.
- Repacked npm tarball for `@wefi-ai/ekyc-suite-mcp@1.1.0`.
