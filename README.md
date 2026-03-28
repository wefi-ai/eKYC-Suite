# 🔐 eKYC Suite

**Financial-grade identity verification for AI agents.** 8 capabilities in one package.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ClawHub](https://img.shields.io/badge/ClawHub-ekyc--suite-orange)](https://clawhub.ai/wefi-ai/ekyc-suite)

---

## What it does

Upload a photo or video, ask a question, get structured verification results. That's it.

| # | Capability | What you get |
|---|-----------|-------------|
| 1 | **Face Comparison** | Similarity score 0-100 between two face photos |
| 2 | **Photo Liveness** | Is this photo real or AI-generated/deepfake? (risk level 1-3) |
| 3 | **Video Liveness** | Is this video real or deepfake? (risk level 1-3) |
| 4 | **ID Card OCR** | Name, ID number, address from Chinese national ID card |
| 5 | **Bank Card OCR** | Card number and expiry date |
| 6 | **Driver's License OCR** | License number, vehicle class, validity dates |
| 7 | **Vehicle License OCR** | Plate number, VIN, owner, engine number |
| 8 | **Media Labeling** | 15+ risk attributes: mask, hat, coercion, tattoo, phone, in-car, etc. |

## Setup

### 1. Get API credentials

- **Key A** (`KYC_APPID` + `KYC_SECRET`) → enables capabilities 1-7
- **Key B** (`LABEL_APPID` + `LABEL_SECRET`) → enables capability 8

How to get: [Tencent Cloud Console](https://console.cloud.tencent.com/faceid/access) (Key A) or contact Huiyan tech support (WeChat: `blue-201809`) for Key A + Key B.

> ⚠️ **Use TEST credentials** (free 100 calls per appid). Production IDs incur charges.

### 2. Configure

Copy `.env.example` to `.env` and fill in your test credentials.

## How to Use

Install this Skill in your AI agent (OpenClaw, etc.), then just talk to it naturally:

| You say | What happens |
|---------|-------------|
| "Compare these two photos — same person?" + upload 2 photos | Returns similarity score (e.g. 96.2/100) |
| "Is this photo AI-generated?" + upload a selfie | Returns risk level 1-3 with attack type classification |
| "Is this video real or deepfake?" + upload a video | Detects deepfake/replay, returns risk level |
| "Read this ID card" + upload ID card photo | Extracts name, ID number, address, ethnicity, birth date |
| "Read this bank card number" + upload bank card photo | Extracts card number and expiry date |
| "Read this driver's license" + upload photo | Extracts license number, name, vehicle class, validity dates |
| "Read this vehicle license" + upload photo | Extracts plate number, VIN, owner, engine number |
| "Check for hat and mask" + upload photo | Detects 15+ risk attributes (see table below) |

The AI agent handles everything automatically — you just upload files and ask questions in natural language.

## Media Labeling — Risk Attributes (Capability 8)

### Portrait Attributes — Detect user status and fraud risk

| Code | Attribute | Use case |
|------|-----------|----------|
| A09 | **Under coercion** | Anti-fraud: detect if the person is being coerced during identity verification |
| A10 | **Unconscious / asleep** | Risk alert: detect if the person's eyes are closed or eyelids are being forced open |
| A15 | **Critical patient** | Loan fraud prevention: flag verification attempts by critically ill individuals |
| A11 | **On the phone** | Third-party guidance detection: someone may be coaching the user through the process |
| A04 | **Wearing headphones** | Third-party guidance detection: hidden earpiece coaching during verification |
| A02 | **Medical mask** | Obstruction: face partially covered, may compromise identity verification accuracy |
| A14 | **Wearing hat** | Obstruction/disguise: may indicate attempt to alter appearance |
| A06 | **Sunglasses** | Obstruction: eyes hidden, reduces face recognition confidence |
| A01 | **Facial sheet mask** | Obstruction: skincare mask covering facial features |
| A05 | **Nudity** | Compliance: flag inappropriate content during video verification |
| A13 | **Tattoo** | Risk profiling: visible tattoo detected for feature marking |

### Environment Attributes — Detect business scenario

| Code | Attribute | Use case |
|------|-----------|----------|
| B02 | **Multiple people** | Fraud risk: third party present during what should be a solo verification |
| B03 | **Inside a car** | Auto loan verification: confirm the applicant is at/in the vehicle |
| B06 | **Hotel room** | Risk control: flag unusual verification location for loan/account applications |
| B07 | **Car dealership** | Consumer finance compliance: verify the applicant is at the dealership |

**Max 5 label codes per request.** Example: `"A09,A10,A02,B02,B03"`

## License

[MIT](LICENSE) — Copyright (c) 2024-2026 Wefi AI Team
