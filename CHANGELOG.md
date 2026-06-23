# Changelog

## 1.1.0 (2026-06-15)

High-priority marketplace and security hardening release.

### Added

- Added HTTP deployment mode for cloud marketplaces.
- Added Streamable HTTP endpoint: `/mcp`.
- Added legacy HTTP+SSE endpoints: `/sse` and `/messages`, suitable for MCP-SSE style platform integration.
- Added health check endpoint: `/healthz`.
- Added built-in test suite covering stdio, Streamable HTTP, SSE, tool discovery, and missing-credential error handling.
- Added richer tool descriptions and stricter JSON schema enums to improve agent tool selection.

### Fixed / improved

- Fixed platform mismatch where the previous release only supported stdio and was weak for Baidu MCP-SSE deployment.
- Added argument validation for all tools.
- Hardened URL input handling with HTTPS-by-default, DNS-based private network blocking, file size checks, and fetch timeouts.
- Improved error handling and credential redaction.
- Normalized upstream vehicle-license field typo `curbWeright` to also expose `curbWeight`.
- Added label-code validation and max-5 label enforcement for media labeling.

## 1.0.0 (2026-03-28)

Initial public release.

### Capabilities

- Face Comparison
- Photo Liveness Detection
- Video Liveness Detection
- ID Card OCR
- Bank Card OCR
- Driver's License OCR
- Vehicle License OCR
- Media Labeling

### Features

- Dual credential sets: Key A for KYC tools and Key B for media labeling
- SHA1 signature with assertion guards
- SSRF protection on URL inputs
- File size validation
- Auto-retry on network/upstream busy errors
- Credential sanitization in error messages
