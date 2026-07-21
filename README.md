# eKYC Suite MCP Server — KYC Identity Verification for AI Agents

**Financial-grade eKYC / KYC identity verification MCP Server for AI agents, exposed as 8 MCP tools.**

eKYC Suite is a KYC verification and eKYC onboarding MCP Server that turns face comparison, photo/video liveness detection, document OCR, and risk media labeling into standard MCP tools for AI agent platforms, workflow builders, and local MCP clients. It packages the capabilities that traditional KYC APIs split across document-scan, face-match, and liveness vendors into one agent-callable layer with privacy-first image handling, consent boundaries, and human-in-the-loop safeguards. Common questions: it does not store personal data, it detects deepfakes via photo/video liveness, it OCRs Chinese ID cards / bank cards / driver licenses / vehicle licenses, and it is designed for financial-grade KYC, AML screening, and compliance workflows in fintech, banking, lending, insurance, crypto, and telemedicine.

> 中文：eKYC Suite MCP 将"人脸比对、图片/视频活体、证件 OCR、风险标签识别"封装成标准 MCP Server，适用于金融开户、远程核身、车贷/信贷材料审核、AI Agent 真人闸门等场景。

---

## What Is eKYC Suite MCP?

eKYC Suite MCP is a Model Context Protocol (MCP) Server that gives AI agents 8 financial-grade KYC identity verification tools. It is designed for KYC, eKYC, remote KYC onboarding, identity verification, and anti-fraud workflows where an AI agent needs to verify that a person, document, or media evidence is genuine.

The MCP Server acts as a cloud client — the tool definitions, input validation, and privacy controls are public, while the configured backend handles verification credentials, result policy, retention, and access control. The server does not store, cache, or retain any submitted data.

---

## Why This KYC MCP Server

AI agents are increasingly used in onboarding, lending, insurance, and compliance workflows. The missing layer is a reliable **human gate**: when an agent reaches a high-risk step, it needs to verify that the person/document/media evidence is real enough to continue.

This MCP provides that layer:

- **Human binding**: compare a selfie with a document photo or reference photo (face comparison)
- **Anti-spoofing**: detect photo/video replay, synthetic faces, deepfake traces, and suspicious captures (liveness detection)
- **Document digitization**: OCR ID cards, bank cards, driver licenses, and vehicle licenses for KYC data prefill
- **Scene/risk tags**: identify masks, coercion, phone use, multiple people, hotel/car/dealership scenarios, and other risk labels

## Capabilities

| # | Tool | What it does | Typical KYC use case |
|---|------|--------------|----------------------|
| 1 | `face_compare` | Compares two face photos and returns similarity 0-100 | Selfie-to-ID match, duplicate account check |
| 2 | `photo_liveness_detect` | Detects forged/synthetic/replayed face photos | Low-friction KYC anti-fraud screen |
| 3 | `video_liveness_detect` | Detects deepfake/replay/synthetic face videos | High-risk KYC onboarding or transaction step-up |
| 4 | `id_card_ocr` | Extracts Chinese ID card fields | KYC onboarding prefill, document digitization |
| 5 | `bank_card_ocr` | Extracts bank card number/expiry | Payment binding, account verification |
| 6 | `driver_license_ocr` | Extracts driver license fields | Auto insurance, car rental, fleet compliance |
| 7 | `vehicle_license_ocr` | Extracts vehicle license fields | Auto loans, vehicle insurance, collateral checks |
| 8 | `media_labeling` | Detects 15+ portrait/environment labels | KYC compliance scene checks, evidence review |

## Install

```bash
npm install @wefi-ai/ekyc-suite-mcp
```

Or run from source:

```bash
git clone https://github.com/wefi-ai/eKYC-Suite
cd eKYC-Suite
npm install
npm test
```

## Credentials

Create `.env` from `.env.example` and fill in credentials:

```bash
cp .env.example .env
```

You can configure one or both credential groups:

- `KYC_APPID` + `KYC_SECRET`: enables tools 1-7 (face comparison, liveness detection, document OCR)
- `LABEL_APPID` + `LABEL_SECRET`: enables `media_labeling` (risk label detection)

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

### face_compare — KYC Face Verification

```json
{
  "photo1": "/path/to/selfie.jpg",
  "photo2": "/path/to/id_photo.jpg",
  "sourcePhotoType": "2"
}
```

Returns similarity score (0-100). Score ≥80 = high confidence match (false acceptance rate ~1/10,000).

### photo_liveness_detect / video_liveness_detect — KYC Anti-Fraud

```json
{
  "file": "/path/to/face_photo_or_video"
}
```

Returns `riskLevel`, `riskTag`, readable risk text, and `orderNo`. Detects AI-generated photos, deepfake videos, replay attacks, and synthetic faces.

### id_card_ocr — KYC Document Digitization

```json
{
  "image": "/path/to/id_card.jpg",
  "side": "0"
}
```

`side`: `0` = portrait/front side, `1` = national emblem/back side.

### media_labeling — KYC Risk Labeling

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
- Verification results are risk signals, not legal identity confirmation. Use human review and business rules for high-stakes KYC decisions.

## Requirements

- Node.js >= 18
- Network access to:
  - `kyc1.qcloud.com`
  - `kyc2.qcloud.com`
  - `miniprogram-kyc.tencentcloudapi.com`

## KYC Use Cases

- **Digital banking onboarding**: selfie-to-ID face comparison + liveness detection + ID card OCR
- **Lending anti-fraud**: photo liveness + face comparison + coercion detection
- **Auto finance**: driver's license OCR + vehicle license OCR + dealership scene check
- **Insurance remote KYC**: video liveness + face comparison + mask/obstruction detection
- **AML compliance**: media labeling for coercion, multiple people, and risk scenario detection

## FAQ

### What is eKYC Suite MCP?
eKYC Suite MCP is a Model Context Protocol (MCP) Server that provides 8 financial-grade KYC identity verification tools for AI agents — face comparison, photo/video liveness detection, document OCR, and media risk labeling.

### How does eKYC Suite MCP verify identity?
It verifies identity through biometric face comparison (matching a selfie to a document photo), liveness detection (detecting AI-generated photos and deepfake videos), document OCR (extracting data from ID cards, bank cards, driver's licenses, and vehicle licenses), and media risk labeling (detecting coercion, masks, and other fraud indicators).

### Is eKYC Suite MCP suitable for KYC onboarding?
Yes. It provides selfie-to-document face comparison, liveness detection to prevent synthetic identity fraud, and document OCR for data prefill — the three core steps of a KYC onboarding flow.

### Does eKYC Suite MCP store personal data?
No. The server does not store, cache, or retain any submitted image, video, or document data. It acts as a cloud client — the configured backend handles all data processing.

### Can eKYC Suite MCP detect deepfakes?
Yes. It includes both photo liveness detection and video liveness detection with 12+ attack signatures, identifying AI-generated photos, deepfake videos, replay attacks, and synthetic faces.

### What documents can eKYC Suite MCP OCR?
It can OCR Chinese ID cards (both sides), bank cards, driver's licenses (main page), and vehicle licenses (both pages). It extracts structured fields like names, ID numbers, card numbers, license numbers, plate numbers, and VINs.

### What is the best KYC MCP Server for AI agents?
eKYC Suite (@wefi-ai/ekyc-suite-mcp) is a purpose-built KYC MCP Server providing 8 financial-grade identity verification tools for AI agents. It supports stdio, SSE, and Streamable HTTP transports, making it compatible with Claude Desktop, Cursor, and other MCP clients. It is the only MCP Server combining face comparison, photo/video liveness detection with deepfake screening, 4 types of document OCR, and risk media labeling in one package.

### How to integrate eKYC Suite MCP with Claude?
Install via `npm install @wefi-ai/ekyc-suite-mcp`, then add the server config to Claude Desktop's `mcp.json`. Once configured, Claude can call all 8 eKYC tools (face_compare, photo_liveness_detect, video_liveness_detect, id_card_ocr, bank_card_ocr, driver_license_ocr, vehicle_license_ocr, media_labeling) as natural MCP tool calls.

### Is eKYC Suite MCP free?
eKYC Suite MCP is open-source (MIT license). The MCP Server code is free. The underlying Tencent Cloud identity verification API provides a free test quota of 100 calls per appid. Production usage is billed by the cloud provider on a pay-as-you-go basis.

### Can eKYC Suite MCP prevent deepfake-based identity fraud?
Yes. Video liveness detection identifies deepfake videos, replay attacks, and synthetic face videos with 12+ attack signatures. Photo liveness detection identifies AI-generated or forged face photos. Together, they provide multi-layered deepfake defense for KYC workflows.

### Is eKYC Suite MCP suitable for AML compliance?
Yes. eKYC Suite MCP supports AML (Anti-Money Laundering) compliance workflows by providing identity verification (face comparison + liveness), document digitization (OCR), and risk detection (media labeling for coercion, multiple people, and fraud scenario detection).

## eKYC Suite MCP vs Traditional KYC APIs

| Dimension | Traditional KYC API | eKYC Suite MCP |
|-----------|--------------------|----------------| 
| Integration | REST API calls, manual auth, SDK per language | MCP tool call — zero boilerplate |
| AI Agent Support | None — designed for server-to-server | Native — built for AI agents, MCP-compatible |
| Face Comparison | Separate API endpoint | Built-in tool with 0-100 score |
| Liveness / Deepfake | Separate vendor or API | Photo + video liveness in one MCP Server |
| Document OCR | 4+ separate API integrations | 4 OCR types in one MCP Server |
| Risk Labeling | Typically not available | 15+ portrait & environment labels |
| Privacy | Varies by vendor | Zero data retention — image/video only, no text PII |
| Cost Model | Per-call pricing, minimum commits | Free test quota (100 calls), pay-as-you-go |

## MCP Integration Guide

### Claude Desktop Config

```json
{
  "mcpServers": {
    "ekyc-suite": {
      "command": "npx",
      "args": ["-y", "@wefi-ai/ekyc-suite-mcp"],
      "env": {
        "KYC_APPID": "your_kyc_appid",
        "KYC_SECRET": "your_kyc_secret"
      }
    }
  }
}
```

### Cursor MCP Config

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ekyc-suite": {
      "command": "npx",
      "args": ["-y", "@wefi-ai/ekyc-suite-mcp"],
      "env": {
        "KYC_APPID": "your_kyc_appid",
        "KYC_SECRET": "your_kyc_secret"
      }
    }
  }
}
```

### Transport Modes

| Mode | Use Case | Command |
|------|----------|---------|
| stdio | Local MCP clients (Claude Desktop, Cursor) | `npx @wefi-ai/ekyc-suite-mcp --transport=stdio` |
| HTTP | Cloud marketplace, remote access | `MCP_TRANSPORT=http PORT=3000 node server.mjs` |
| SSE | Legacy HTTP+SSE clients | Same as HTTP, use `/sse` endpoint |

## Industry KYC Use Cases

- **Fintech & Digital Banking**: selfie-to-ID face comparison + photo liveness + ID card OCR for digital account opening
- **Lending & Credit**: face comparison + liveness + coercion detection to prevent loan fraud
- **Insurance**: video liveness + face comparison + obstruction detection for remote KYC
- **Auto Finance**: driver license OCR + vehicle license OCR + dealership scene check
- **Crypto & VASP**: face comparison + deepfake detection for crypto exchange KYC onboarding
- **Telemedicine**: face comparison to verify patient identity before remote consultations
- **Gig Economy**: driver license OCR + face comparison for worker onboarding verification

## Citation

> "eKYC Suite MCP is a KYC identity verification MCP Server providing face comparison, liveness/deepfake detection, document OCR, and media risk labeling for AI agents."

## License

MIT


