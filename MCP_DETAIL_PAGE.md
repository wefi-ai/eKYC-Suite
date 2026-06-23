# eKYC Suite MCP Detail Page

## Basic fields

| Field | Recommended content |
|---|---|
| Name | eKYC Suite MCP |
| Type | Local MCP for npm usage; Hosted MCP after HTTPS deployment |
| Category | 金融 / 风控 / 身份核验 / OCR / AI 安全 |
| Version | 1.1.0 |
| Runtime | Node.js 18+ |
| License | MIT |
| Auth type | Environment variables |

## Hero

### Headline

eKYC Suite MCP

### Subheadline

为 AI Agent 接入身份核验、活体检测、证件 OCR 与媒体风险标签能力。

### Value proposition

在远程开户、授信审核、车辆金融、保险理赔、交易加验和 AI Agent 真人授权场景中，模型不仅要理解用户意图，还需要判断用户上传的图片、视频、证件和场景是否可信。eKYC Suite MCP 将 8 项身份核验能力封装为标准 MCP 工具，支持本地 stdio、Streamable HTTP 和 SSE 接入，方便在智能体平台和业务工作流中调用。

## Feature highlights

- 8 个 MCP 工具：人脸比对、图片活体、视频活体、身份证 OCR、银行卡 OCR、驾驶证 OCR、行驶证 OCR、媒体风险标签。
- 多形态输入：本地文件路径、HTTPS URL、data URL、base64。
- 多协议部署：stdio、本地 npm、Streamable HTTP `/mcp`、SSE `/sse`。
- 安全默认值：HTTPS-only URL 输入、SSRF 防护、20MB 默认大小限制、超时控制、凭据脱敏。
- 面向审核的输出：返回结构化字段、风险等级、风险标签和订单号，便于业务规则、人工复核与审计留痕。

## Tool table

| Tool | Description | Required credentials |
|---|---|---|
| `face_compare` | 比对两张人脸照片，返回 0-100 相似度分数。 | `KYC_APPID`, `KYC_SECRET` |
| `photo_liveness_detect` | 判断照片是否存在翻拍、合成、AI 伪造、多脸、低质等风险。 | `KYC_APPID`, `KYC_SECRET` |
| `video_liveness_detect` | 判断视频是否存在 replay、deepfake、合成等风险，并对瞬时上游繁忙做重试。 | `KYC_APPID`, `KYC_SECRET` |
| `id_card_ocr` | 识别身份证人像面/国徽面字段。 | `KYC_APPID`, `KYC_SECRET` |
| `bank_card_ocr` | 识别银行卡号和有效期。 | `KYC_APPID`, `KYC_SECRET` |
| `driver_license_ocr` | 识别驾驶证主页字段。 | `KYC_APPID`, `KYC_SECRET` |
| `vehicle_license_ocr` | 识别行驶证主页/副页字段。 | `KYC_APPID`, `KYC_SECRET` |
| `media_labeling` | 识别口罩、墨镜、胁迫、多人同框、车内、酒店、车行等风险标签。 | `LABEL_APPID`, `LABEL_SECRET` |

## Recommended listing copy

### 80-character summary

身份核验 MCP Server，提供人脸比对、活体检测、证件 OCR 与媒体风险标签识别。

### Full description

eKYC Suite MCP 是面向 AI Agent 和工作流平台的身份核验 MCP Server。它提供 8 个标准 MCP 工具，覆盖人脸比对、图片/视频活体检测、身份证/银行卡/驾驶证/行驶证 OCR，以及媒体风险标签识别。

在远程开户、授信审核、车辆金融、保险理赔、交易加验和 AI Agent 真人授权等流程中，业务系统通常需要判断上传的人脸、证件、视频和环境是否可信。eKYC Suite MCP 可以作为 Agent 的核验层：模型负责选择工具和解释结果，业务系统负责阈值、复核和最终决策。

服务支持本地 stdio、npm 启动、Streamable HTTP 和 SSE。Local 场景可通过 `npx -y @wefi-ai/ekyc-suite-mcp` 接入；Hosted 场景可部署为 HTTPS 服务后提交 `/mcp` 或 `/sse` 地址。

### Review note

请使用测试凭据完成广场联调和审核。不要在公开演示中采集姓名、身份证号、手机号等个人文本信息；如需处理真实业务数据，应在企业受控环境内完成授权、审计和数据保护流程。

## Baidu MCP-SSE submission

Use this when the platform asks for an MCP-SSE Server URL.

| Field | Value |
|---|---|
| MCP Server URL | `https://<domain>/sse` |
| Health URL | `https://<domain>/healthz` |
| Transport | SSE |
| Auth variables | `KYC_APPID`, `KYC_SECRET`, `LABEL_APPID`, `LABEL_SECRET` |
| Tool count after connection | 8 |

If the platform supports custom request headers, configure:

- `x-kyc-appid`: KYC app ID
- `x-kyc-secret`: KYC secret
- `x-label-appid`: media labeling app ID
- `x-label-secret`: media labeling secret

## ModelScope / Alibaba submission

Use Local type if no public HTTPS endpoint is ready.

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

Use Hosted type only after deploying a public HTTPS service.

| Field | Value |
|---|---|
| MCP endpoint | `https://<domain>/mcp` |
| SSE endpoint, if needed | `https://<domain>/sse` |
| Health URL | `https://<domain>/healthz` |
| Auth variables | `KYC_APPID`, `KYC_SECRET`, `LABEL_APPID`, `LABEL_SECRET` |

For Hosted mode, prefer request-header credentials when the platform supports them:

- `x-kyc-appid`
- `x-kyc-secret`
- `x-label-appid`
- `x-label-secret`

## Visual guidance

- Icon concept: shield + face scan + document corner.
- Primary color: deep teal or blue-green, not bank-specific.
- Avoid using any financial institution logo or name.
- Use a neutral product identity: "eKYC Suite MCP".
