# Stable Cloudflare Tunnel Setup

This MCP server runs locally or on an origin host as HTTP and should be exposed to marketplaces through a stable HTTPS hostname.

## Recommended hostname

Use a dedicated subdomain, for example:

```text
ekyc-mcp.<your-domain>
```

Public endpoints after the tunnel is ready:

```text
https://ekyc-mcp.<your-domain>/healthz
https://ekyc-mcp.<your-domain>/mcp
https://ekyc-mcp.<your-domain>/sse
```

## Origin service

Run the MCP server in HTTP mode:

```bash
MCP_TRANSPORT=http HOST=127.0.0.1 PORT=3000 node server.mjs --transport=http
```

Health check:

```bash
curl http://127.0.0.1:3000/healthz
```

## Cloudflare Zero Trust dashboard steps

1. Open Cloudflare Zero Trust.
2. Go to **Networks -> Tunnels**.
3. Create a tunnel named `ekyc-mcp`.
4. Choose **Cloudflared** as connector.
5. Install and run the connector on the same machine or server that runs this MCP server.
6. Add a public hostname:
   - Subdomain: `ekyc-mcp`
   - Domain: your Cloudflare-managed domain
   - Type: `HTTP`
   - URL: `localhost:3000`
7. Confirm `https://ekyc-mcp.<your-domain>/healthz` returns JSON with `ok: true`.

## Marketplace endpoint choice

- Baidu MCP-SSE: submit `https://ekyc-mcp.<your-domain>/sse`
- Streamable HTTP clients: submit `https://ekyc-mcp.<your-domain>/mcp`
- Health check: `https://ekyc-mcp.<your-domain>/healthz`

## Credential handling

For public hosted listings, do not hardcode production credentials into the shared service.

Preferred options:

1. Marketplace-managed custom request headers:
   - `x-kyc-appid`
   - `x-kyc-secret`
   - `x-label-appid`
   - `x-label-secret`
2. Isolated test credentials in server environment variables for marketplace review.
3. Private enterprise deployment for production credentials.

## Operational notes

- A tunnel running on a laptop is acceptable for short review windows, but not for long-term production.
- For production, run the connector on a stable VM or server and configure it as a service.
- Keep Cloudflare Access disabled unless the target marketplace supports Access tokens; otherwise MCP clients may fail to connect.

