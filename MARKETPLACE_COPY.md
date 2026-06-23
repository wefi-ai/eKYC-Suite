# eKYC Suite MCP Marketplace Copy

## Listing fields

### Title

eKYC Suite MCP

### One-line description

面向 AI Agent 的身份核验 MCP Server，提供人脸比对、图片/视频活体检测、证件 OCR 与媒体风险标签识别 8 项工具。

### Short description

eKYC Suite MCP 将身份核验能力封装为标准 MCP 工具，适合接入智能体、工作流平台与本地 MCP 客户端。它覆盖自拍与证件照比对、图片/视频活体检测、身份证/银行卡/驾驶证/行驶证 OCR，以及口罩、墨镜、多人同框、车内、酒店、车行等风险场景标签识别，可用于远程开户、材料审核、保险风控、车贷核验、AI Agent 真人授权闸门等流程。

### Suggested category

金融 / 风控 / 身份核验 / OCR / AI 安全

### Suggested tags

`MCP`, `eKYC`, `KYC`, `KYA`, `身份核验`, `人脸比对`, `活体检测`, `证件OCR`, `银行卡识别`, `驾驶证识别`, `行驶证识别`, `图像标签`, `反欺诈`, `风控`, `合规`, `AI Agent`, `金融科技`, `远程开户`, `真人闸门`, `deepfake检测`

## Detail page

### Overview

AI Agent 可以完成开户、授信、保险理赔、租车审核、交易加验等复杂流程，但在高风险节点仍然需要确认三件事：

1. 当前操作者是否为真实本人。
2. 上传的照片、视频、证件是否可信。
3. 当前场景是否存在欺诈或合规风险信号。

eKYC Suite MCP 提供一组标准 MCP 工具，把这些检查放进 Agent 工作流中。模型可以按场景选择合适工具，调用后得到结构化结果，再由业务规则或人工复核决定是否放行。

### Key capabilities

| Capability | Tool | Typical input | Typical output |
|---|---|---|---|
| 人脸比对 | `face_compare` | 两张人脸照片 | 相似度分数、订单号 |
| 图片活体检测 | `photo_liveness_detect` | 一张人脸照片 | 风险等级、攻击标签 |
| 视频活体检测 | `video_liveness_detect` | 一段人脸视频 | 风险等级、攻击标签 |
| 身份证 OCR | `id_card_ocr` | 身份证正面或反面图片 | 姓名、证件号、地址、有效期等识别字段 |
| 银行卡 OCR | `bank_card_ocr` | 银行卡正面图片 | 卡号、有效期 |
| 驾驶证 OCR | `driver_license_ocr` | 驾驶证主页图片 | 证号、准驾车型、地址、有效期等 |
| 行驶证 OCR | `vehicle_license_ocr` | 行驶证主页或副页图片 | 车牌、VIN、发动机号、车主、检验记录等 |
| 媒体风险标签 | `media_labeling` | 图片或视频 | 口罩、墨镜、胁迫、多人同框、车内、酒店、车行等标签 |

### Best-fit scenarios

- AI Agent 真人闸门：在高风险动作前触发活体检测或人脸比对，确认背后是真实用户授权。
- 远程开户与 eKYC：对自拍、证件图片、视频材料进行可信度检查，降低冒名开户风险。
- 信贷和车贷材料审核：识别身份证、银行卡、驾驶证、行驶证字段，并结合场景标签辅助风控判断。
- 保险、租车、车辆金融：结合驾驶证、行驶证 OCR 和人脸/视频活体，提升自动审核效率。
- 反欺诈与合规质检：识别口罩、墨镜、胁迫、多人同框、车内、酒店、车行等风险信号。

### When not to use

- 用户只是咨询 KYC/eKYC 概念、流程或政策时，不需要调用工具。
- 不建议在公开演示中让用户输入姓名、身份证号、手机号等个人文本信息。
- 工具返回的是风险信号和结构化识别结果，不应单独作为法律身份确认结论。高风险业务应叠加人工复核、业务规则和审计留痕。

### Deployment modes

#### Local MCP / npm

适合 ModelScope Local MCP、本地智能体客户端和开发调试。

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

#### Hosted MCP / cloud endpoint

适合需要平台直接连 Server URL 的 MCP 广场或企业工作流。

```bash
MCP_TRANSPORT=http HOST=0.0.0.0 PORT=3000 node server.mjs
```

Endpoints:

- Health check: `GET /healthz`
- Streamable HTTP: `POST/GET/DELETE /mcp`
- Legacy SSE: `GET /sse`, `POST /messages?sessionId=...`

提交公网地址时建议：

- 现代 MCP 客户端：`https://<domain>/mcp`
- 需要 MCP-SSE 的平台：`https://<domain>/sse`

### Credentials

| Environment variable | Required by | Notes |
|---|---|---|
| `KYC_APPID` | tools 1-7 | 人脸比对、活体检测、OCR 凭据 |
| `KYC_SECRET` | tools 1-7 | 人脸比对、活体检测、OCR 凭据 |
| `LABEL_APPID` | `media_labeling` | 媒体风险标签凭据 |
| `LABEL_SECRET` | `media_labeling` | 媒体风险标签凭据 |
| `MCP_TRANSPORT` | all modes | `stdio` or `http` |
| `MAX_RAW_BYTES` | optional | 默认 20MB |
| `REQUEST_TIMEOUT_MS` | optional | 默认 15000 |
| `ALLOW_HTTP_URLS` | optional | 默认 `0`，仅内部测试时设为 `1` |
| `ALLOWED_HOSTS` | optional | HTTP 模式下可配置 Host allowlist |

请使用测试凭据完成广场审核和联调，不要在公开测试或演示流程中使用生产凭据。

Hosted 模式支持两种凭据方式：

- 服务端环境变量：适合私有部署或仅审核用测试环境。
- 平台/网关请求头：`x-kyc-appid`、`x-kyc-secret`、`x-label-appid`、`x-label-secret`。如果广场表单支持自定义鉴权头，优先使用这种方式，避免把生产凭据固化到共享公网服务中。

### Security and privacy

- 服务端不主动存储、缓存或保留上传的图片、视频、证件内容。
- 凭据仅从环境变量读取，不写入代码或配置样例。
- 错误信息会对已配置的凭据值做脱敏。
- URL 输入默认只允许 HTTPS，并阻止 localhost、内网 IP、元数据服务等 SSRF 风险地址。
- 输入体积默认限制 20MB，可通过 `MAX_RAW_BYTES` 调整。
- 工具结果应作为风控信号使用，高风险业务建议保留人工复核和审计流程。

### Review checklist

- [x] MCP stdio transport runnable.
- [x] Streamable HTTP `/mcp` runnable.
- [x] Legacy SSE `/sse` runnable.
- [x] All 8 tools discoverable.
- [x] Missing credentials return clean MCP errors.
- [x] No production credentials included.
- [x] No hardcoded secrets included.
- [x] Package supports local npm and hosted HTTP deployment.
