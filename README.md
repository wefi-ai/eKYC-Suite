# 🔐 eKYC Suite

**Financial-grade identity verification for AI agents.** 8 capabilities in one package.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ClawHub](https://img.shields.io/badge/ClawHub-ekyc--suite-orange)](https://clawhub.ai/wefi-ai/ekyc-suite)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-green.svg)](https://python.org)
[![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org)

---

## What it does

Upload a photo or video → get structured verification results. That's it.

| # | Capability | What you get |
|---|-----------|-------------|
| 1 | **Face Comparison** | Similarity score 0-100 between two face photos |
| 2 | **Photo Liveness** | Is this photo real or AI-generated/deepfake? (risk level 1-3) |
| 3 | **Video Liveness** | Is this video real or deepfake? (auto-retries on network errors) |
| 4 | **ID Card OCR** | Name, ID number, address, etc. from Chinese national ID card |
| 5 | **Bank Card OCR** | Card number and expiry date |
| 6 | **Driver's License OCR** | License number, vehicle class, validity dates |
| 7 | **Vehicle License OCR** | Plate number, VIN, owner, engine number |
| 8 | **Media Labeling** | 15+ attributes: mask, hat, coercion, tattoo, phone, in-car, etc. |

## Quick Start

### 1. Get credentials

You need API credentials to use this tool:

- **Key A** (`KYC_APPID` + `KYC_SECRET`) → Capabilities 1-7
- **Key B** (`LABEL_APPID` + `LABEL_SECRET`) → Capability 8

How to get them:
- Self-service: [Tencent Cloud Face Verification Console](https://console.cloud.tencent.com/faceid/access) (Key A only)
- Full access: Contact Huiyan tech support (WeChat: `blue-201809`) for Key A + Key B

> ⚠️ **Use TEST credentials** (free 100 calls per appid). Do NOT use production credentials — production IDs incur charges.

### 2. Set up environment

```bash
cp .env.example .env
# Edit .env and fill in your test credentials
```

### 3. Install & run

**As OpenClaw / ClawHub Skill:**

```bash
pip install requests
python scripts/ekyc_api.py face_compare --photo1 selfie.jpg --photo2 id_photo.jpg
```

**As MCP Server (for Claude Desktop, etc.):**

```bash
cd mcp/
npm install
node server.mjs
```

Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ekyc-suite": {
      "command": "node",
      "args": ["/path/to/mcp/server.mjs"],
      "env": {
        "KYC_APPID": "your_test_appid",
        "KYC_SECRET": "your_test_secret",
        "LABEL_APPID": "your_label_appid",
        "LABEL_SECRET": "your_label_secret"
      }
    }
  }
}
```

## Usage Examples

```bash
# Compare two faces
python scripts/ekyc_api.py face_compare --photo1 photo_a.jpg --photo2 photo_b.jpg
# → {"success": true, "similarity": "96.2"}

# Check if a photo is AI-generated
python scripts/ekyc_api.py photo_liveness_detect --file selfie.jpg
# → {"success": true, "riskLevel": 1, "riskTag": "01"}

# Read an ID card
python scripts/ekyc_api.py id_card_ocr --image id_card.png --side 0
# → {"success": true, "name": "...", "idcard": "...", "address": "..."}

# Read a bank card number
python scripts/ekyc_api.py bank_card_ocr --image bank_card.png
# → {"success": true, "bankcardNo": "6222..."}

# Detect if someone is wearing a hat or mask
python scripts/ekyc_api.py media_labeling --file photo.jpg --labels "A14,A02" --type image
# → {"success": true, "fileLabel": [{"label": "A14", "value": "1"}, ...]}
```

## Security

- **No data storage** — All processing is stateless. Nothing is saved.
- **SSRF protection** — Private/internal URLs are blocked.
- **File size limit** — 20MB max, validated before upload.
- **Credential safety** — API keys are never logged or included in error messages.

## Project Structure

```
├── SKILL.md              # Skill definition (English)
├── SKILL_CN.md           # Skill definition (中文)
├── scripts/
│   ├── ekyc_api.py       # Main CLI — all 8 capabilities
│   ├── kyc_auth.py       # Auth for capabilities 1-7
│   └── label_auth.py     # Auth for capability 8
├── mcp/
│   ├── server.mjs        # MCP server — same 8 capabilities
│   └── package.json
├── .env.example
├── LICENSE               # MIT
└── CHANGELOG.md
```

## Legal Notice

This software does not store, cache, or retain any submitted data.

API verification results are for reference only and do not constitute legal identity confirmation. This software must not be used as the sole basis for automated decisions that produce legal effects or significant consequences for individuals. Users should implement appropriate business logic and human review processes for high-stakes identity decisions.

## License

[MIT](LICENSE) — Copyright (c) 2024-2026 Wefi AI Team
