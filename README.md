# eKYC Suite MCP Server

Financial-grade eKYC / KYA toolkit for AI agents, exposed as 8 MCP tools.

It turns face comparison, photo/video liveness detection, document OCR, and risk media labeling into standard MCP tools that can be used by agent platforms, workflow builders, and local MCP clients.

> 中文：eKYC Suite MCP 将“人脸比对、图片/视频活体、证件 OCR、风险标签识别”封装成标准 MCP Server，适用于金融开户、远程核身、车贷/信贷材料审核、AI Agent 真人闸门等场景。

## Why this MCP

AI agents are increasingly used in onboarding, lending, insurance, and compliance workflows. The missing layer is a reliable **human gate**: when an agent reaches a high-risk step, it needs to verify that the person/document/media evidence is real enough to continue.

This MCP provides that layer:

- **Human binding**: compare a selfie with a document photo or reference photo.
- **Anti-spoofing**: detect photo/video replay, synthetic faces, deepfake traces, and suspicious captures.
- **Document digitization**: OCR ID cards, bank cards, driver licenses, and vehicle licenses.
- **Scene/risk tags**: identify masks, coercion, phone use, multiple people, hotel/car/dealership scenarios, and other risk labels.

## Capabilities

| # | Tool | What it does | Typical use case |
|---|------|--------------|------------------|
| 1 | `face_compare` | Compares two face photos and returns similarity 0-100 | Selfie-to-ID match, duplicate account check |
| 2 | `photo_liveness_detect` | Detects forged/synthetic/replayed face photos | Low-friction anti-fraud screen |
| 3 | `video_liveness_detect` | Detects deepfake/replay/synthetic face videos | High-risk onboarding or transaction step-up |
| 4 | `id_card_ocr` | Extracts Chinese ID card fields | Onboarding prefill, document digitization |
| 5 | `bank_card_ocr` | Extracts bank card number/expiry | Payment binding, account verification |
| 6 | `driver_license_ocr` | Extracts driver license fields | Auto insurance, car rental, fleet compliance |
| 7 | `vehicle_license_ocr` | Extracts vehicle license fields | Auto loans, vehicle insurance, collateral checks |
| 8 | `media_labeling` | Detects 15+ portrait/environment labels | Compliance scene checks, evidence review |

## Install

```bash
npm install @wefi-ai/ekyc-suite-mcp
```

Or run from source:

```bash
git clone <repository-url>
cd ekyc-suite-mcp
npm install
npm test
```

## Credentials

Create `.env` from `.env.example` and fill in credentials:

```bash
cp .env.example .env
```

You can configure one or both credential groups:

- `KYC_APPID` + `KYC_SECRET`: enables tools 1-7.
- `LABEL_APPID` + `LABEL_SECRET`: enables `media_labeling`.

Unconfigured tools return a clear missing-credential error instead of crashing.

In hosted HTTP/SSE mode, credentials may also be supplied per request by a gateway or marketplace that supports custom headers:

- `x-kyc-appid` + `x-kyc-secret`
- `x-label-appid` + `x-label-secret`

Environment variables take precedence over request headers. For public marketplace listings, prefer platform-managed credential headers or isolated test credentials instead of hardcoding production credentials into a shared public service.

## Transport modes

### 1. stdio: local MCP clients / ModelScope npm-style config

```bash
npx @wefi-ai/ekyc-suite-mcp --transport=stdio
```

Example MCP client config:

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

### 2. HTTP: cloud marketplace / Baidu MCP-SSE / Streamable HTTP

```bash
MCP_TRANSPORT=http HOST=0.0.0.0 PORT=3000 node server.mjs
```

Endpoints:

- `GET /healthz` — health check
- `POST/GET/DELETE /mcp` — Streamable HTTP MCP endpoint
- `GET /sse` + `POST /messages?sessionId=...` — legacy HTTP+SSE MCP endpoint

Baidu AppBuilder-style MCP-SSE integration should use the public URL of:

```text
https://<your-domain>/sse
```

Newer MCP clients should use:

```text
https://<your-domain>/mcp
```

## Input formats

Image/video parameters accept:

- Local file path: `/path/to/photo.jpg`
- HTTPS URL: `https://example.com/photo.jpg`
- Data URL: `data:image/jpeg;base64,...`
- Raw base64 string

Security defaults:

- Max input size: 20MB by default. Override with `MAX_RAW_BYTES`.
- HTTPS URLs only by default. For controlled internal tests, set `ALLOW_HTTP_URLS=1`.
- Private/internal network URLs are blocked with hostname and DNS resolution checks.
- Network calls use timeout control via `REQUEST_TIMEOUT_MS`.

## Tool examples

### face_compare

```json
{
  "photo1": "/path/to/selfie.jpg",
  "photo2": "/path/to/id_photo.jpg",
  "sourcePhotoType": "2"
}
```

### photo_liveness_detect / video_liveness_detect

```json
{
  "file": "/path/to/face_photo_or_video"
}
```

Returns `riskLevel`, `riskTag`, readable risk text, and `orderNo`.

### id_card_ocr

```json
{
  "image": "/path/to/id_card.jpg",
  "side": "0"
}
```

`side`: `0` = portrait/front side, `1` = national emblem/back side.

### media_labeling

```json
{
  "file": "/path/to/photo.jpg",
  "labels": "A02,A14,B03",
  "type": "image"
}
```

Available label codes, max 5 per request:

- Portrait: `A01` facial mask, `A02` medical mask, `A04` headphones, `A05` nudity, `A06` sunglasses, `A09` coercion, `A10` unconscious/asleep, `A11` phone, `A13` tattoo, `A14` hat, `A15` critical patient
- Environment: `B02` multiple people, `B03` inside car, `B06` hotel room, `B07` car dealership

## Test

```bash
npm test
```

The built-in test verifies:

- stdio transport starts and lists all 8 tools
- Streamable HTTP `/mcp` starts and lists all 8 tools
- SSE `/sse` starts and lists all 8 tools
- missing credentials return a clean MCP error instead of crashing

## Security & privacy

- The server does not intentionally store, cache, or retain submitted image/video/document content.
- Credentials are read from environment variables and not hardcoded.
- Error messages redact configured credential values.
- Public URL inputs include SSRF protection and size checks.
- Verification results are risk signals, not legal identity confirmation. Use human review and business rules for high-stakes decisions.

## Requirements

- Node.js >= 18
- Network access to:
  - `kyc1.qcloud.com`
  - `kyc2.qcloud.com`
  - `miniprogram-kyc.tencentcloudapi.com`

## License

MIT
