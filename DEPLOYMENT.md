# eKYC Suite MCP v1.1.0 Deployment Guide

## 1. Local stdio mode

Use this for local MCP clients and ModelScope-style npm command configuration.

```bash
npm install
MCP_TRANSPORT=stdio node server.mjs
```

MCP config:

```json
{
  "mcpServers": {
    "ekyc-suite": {
      "command": "npx",
      "args": ["-y", "@wefi-ai/ekyc-suite-mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "KYC_APPID": "${KYC_APPID}",
        "KYC_SECRET": "${KYC_SECRET}",
        "LABEL_APPID": "${LABEL_APPID}",
        "LABEL_SECRET": "${LABEL_SECRET}"
      }
    }
  }
}
```

## 2. HTTP mode for cloud marketplaces

Use this for Baidu MCP-SSE, enterprise deployment, and public Server URL integration.

```bash
npm install
MCP_TRANSPORT=http HOST=0.0.0.0 PORT=3000 node server.mjs
```

Endpoints:

- Health check: `GET /healthz`
- Streamable HTTP: `POST/GET/DELETE /mcp`
- Legacy SSE: `GET /sse`, `POST /messages?sessionId=...`

Public URLs after deployment:

- Recommended modern MCP endpoint: `https://<domain>/mcp`
- Baidu MCP-SSE endpoint: `https://<domain>/sse`

Recommended production settings:

- Put the server behind HTTPS.
- Set `ALLOWED_HOSTS` to the public host names accepted by your marketplace or gateway.
- Use test credentials for marketplace review and public demo flows.
- Keep production credentials only in the final private runtime environment.
- If the marketplace supports custom auth headers, prefer per-request credential headers: `x-kyc-appid`, `x-kyc-secret`, `x-label-appid`, `x-label-secret`.

## 3. Docker deployment

```bash
docker build -t ekyc-suite-mcp:1.1.0 .
docker run -d --name ekyc-suite-mcp \
  -p 3000:3000 \
  -e MCP_TRANSPORT=http \
  -e HOST=0.0.0.0 \
  -e PORT=3000 \
  -e KYC_APPID=your_test_kyc_appid \
  -e KYC_SECRET=your_test_kyc_secret \
  -e LABEL_APPID=your_test_label_appid \
  -e LABEL_SECRET=your_test_label_secret \
  ekyc-suite-mcp:1.1.0
```

Health check:

```bash
curl http://127.0.0.1:3000/healthz
```

## 4. Baidu MCP marketplace notes

Baidu AppBuilder documentation describes MCP components as MCP-SSE components and asks users to configure a Server URL. Therefore, do not submit the stdio-only `npx` configuration as the primary Baidu deployment. Deploy this server in HTTP mode and submit the public SSE URL:

```text
https://<your-domain>/sse
```

Operational checklist:

1. Deploy HTTP mode behind HTTPS.
2. Confirm `GET https://<domain>/healthz` returns ok.
3. In Baidu console, create/deploy MCP Server or use cloud deployment.
4. Fill MCP Server URL as `https://<domain>/sse`.
5. Fill auth parameters if the platform asks users to provide credentials. Recommended credential names: `KYC_APPID`, `KYC_SECRET`, `LABEL_APPID`, `LABEL_SECRET`.
6. Connect and verify the platform displays 8 tools.
7. Run a low-risk test call with test credentials only.

## 5. Alibaba / ModelScope notes

For ModelScope MCP listing, stdio/npm-style configuration is acceptable for local service usage, but the page should clearly show both local and cloud options.

Local config:

```json
{
  "mcpServers": {
    "ekyc-suite": {
      "command": "npx",
      "args": ["-y", "@wefi-ai/ekyc-suite-mcp"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "KYC_APPID": "your_test_kyc_appid",
        "KYC_SECRET": "your_test_kyc_secret",
        "LABEL_APPID": "your_test_label_appid",
        "LABEL_SECRET": "your_test_label_secret"
      }
    }
  }
}
```

Cloud endpoint, if you deploy it yourself:

```text
https://<domain>/mcp
```

## 6. Required environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `MCP_TRANSPORT` | yes | `stdio` or `http` |
| `HOST` | HTTP only | bind host, default `0.0.0.0` in deployment |
| `PORT` | HTTP only | default `3000` |
| `KYC_APPID` | tools 1-7 | KYC credential appid |
| `KYC_SECRET` | tools 1-7 | KYC credential secret |
| `LABEL_APPID` | tool 8 | media labeling credential appid |
| `LABEL_SECRET` | tool 8 | media labeling credential secret |
| `MAX_RAW_BYTES` | optional | max input size, default 20MB |
| `REQUEST_TIMEOUT_MS` | optional | upstream/download timeout, default 15000 |
| `ALLOW_HTTP_URLS` | optional | default `0`; set `1` only for controlled internal tests |
| `ALLOWED_HOSTS` | optional | comma-separated host allowlist for HTTP mode |
| `x-kyc-appid` / `x-kyc-secret` | hosted optional | request-header alternative to `KYC_APPID` / `KYC_SECRET` |
| `x-label-appid` / `x-label-secret` | hosted optional | request-header alternative to `LABEL_APPID` / `LABEL_SECRET` |

## 7. Test evidence

Command:

```bash
npm test
```

Expected result:

```text
PASS: stdio, Streamable HTTP, and SSE MCP transports are runnable; 8 tools are discoverable; missing-credential error path is clean.
```
