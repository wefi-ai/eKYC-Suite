#!/usr/bin/env node
/**
 * eKYC Suite MCP Server
 * =====================
 * Financial-grade eKYC tools for AI agents.
 *
 * Transports:
 *   - stdio (default): local MCP clients / ModelScope npm-style config
 *   - http: /mcp Streamable HTTP + /sse,/messages legacy SSE for cloud marketplaces
 *
 * Tools:
 *   1. face_compare            — Face comparison
 *   2. photo_liveness_detect   — Photo liveness detection
 *   3. video_liveness_detect   — Video liveness detection
 *   4. id_card_ocr             — ID card OCR
 *   5. bank_card_ocr           — Bank card OCR
 *   6. driver_license_ocr      — Driver's license OCR
 *   7. vehicle_license_ocr     — Vehicle license OCR
 *   8. media_labeling          — Media labeling (async)
 *
 * Auth: SHA1 (40-char uppercase). NEVER SHA256.
 */

import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs";
import net from "node:net";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";

// ============================================================
// Config
// ============================================================

const VERSION = "1.1.0";
const SERVER_NAME = "ekyc-suite";

const requestContext = new AsyncLocalStorage();
const CREDENTIAL_HEADERS = {
  KYC_APPID: ["x-kyc-appid", "x-kyc-app-id", "kyc-appid"],
  KYC_SECRET: ["x-kyc-secret", "kyc-secret"],
  LABEL_APPID: ["x-label-appid", "x-label-app-id", "label-appid"],
  LABEL_SECRET: ["x-label-secret", "label-secret"],
};

const KYC_BASE_MAIN = "https://kyc1.qcloud.com";
const KYC_BASE_MINI = "https://miniprogram-kyc.tencentcloudapi.com";
const LABEL_BASE = "https://kyc2.qcloud.com";

const MAX_RAW_BYTES = Number(process.env.MAX_RAW_BYTES || 20 * 1024 * 1024); // 20MB API limit
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
const ALLOW_HTTP_URLS = process.env.ALLOW_HTTP_URLS === "1";

const LABEL_CODES = new Set([
  "A01", "A02", "A04", "A05", "A06", "A09", "A10", "A11", "A13", "A14", "A15",
  "B02", "B03", "B06", "B07",
]);

// ============================================================
// Utilities
// ============================================================

function generateNonce(len = 32) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateOrderNo(prefix = "ekyc") {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

function headerValue(headers, names) {
  if (!headers) return "";
  for (const name of names) {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return String(value[0] || "");
    if (value != null) return String(value);
  }
  return "";
}

function credential(name) {
  const envValue = process.env[name] || "";
  if (envValue) return envValue;
  return headerValue(requestContext.getStore()?.headers, CREDENTIAL_HEADERS[name] || []);
}

function credentials() {
  return {
    kycAppId: credential("KYC_APPID"),
    kycSecret: credential("KYC_SECRET"),
    labelAppId: credential("LABEL_APPID"),
    labelSecret: credential("LABEL_SECRET"),
  };
}

function credentialHeaderSubset(headers = {}) {
  const subset = {};
  for (const names of Object.values(CREDENTIAL_HEADERS)) {
    for (const name of names) {
      const value = headers[name] ?? headers[name.toLowerCase()];
      if (value != null) subset[name.toLowerCase()] = value;
    }
  }
  return subset;
}

function mergedCredentialHeaders(existing = {}, incoming = {}) {
  return { ...existing, ...credentialHeaderSubset(incoming) };
}

function redact(text = "") {
  let out = String(text);
  const active = credentials();
  const secrets = [
    process.env.KYC_SECRET, process.env.LABEL_SECRET, process.env.KYC_APPID, process.env.LABEL_APPID,
    active.kycSecret, active.labelSecret, active.kycAppId, active.labelAppId,
  ];
  for (const secret of secrets.filter(Boolean)) {
    out = out.split(secret).join("***");
  }
  return out;
}

/** SHA1 signature. 40 chars. NEVER SHA256. */
function sha1Sign(values) {
  values.sort();
  const sig = crypto.createHash("sha1").update(values.join(""), "utf8").digest("hex").toUpperCase();
  if (sig.length !== 40) throw new Error(`SHA1 signature must be 40 chars, got ${sig.length}. Do NOT use SHA256.`);
  return sig;
}

function requireString(obj, field) {
  const value = obj?.[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid argument: ${field} must be a non-empty string.`);
  }
  return value;
}

function optionalString(obj, field, fallback) {
  const value = obj?.[field];
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") throw new Error(`Invalid argument: ${field} must be a string.`);
  return value;
}

function isPrivateIp(ip) {
  const family = net.isIP(ip);
  if (family === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (family === 6) {
    const normalized = ip.toLowerCase();
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") || normalized.startsWith("fd") || // unique local
      normalized.startsWith("fe80") || // link local
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertPublicUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("Invalid URL input.");
  }

  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("Only http(s) URLs are allowed.");
  }
  if (parsed.protocol === "http:" && !ALLOW_HTTP_URLS) {
    throw new Error("Plain HTTP URLs are blocked by default. Use HTTPS or set ALLOW_HTTP_URLS=1 for controlled internal testing.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "metadata.google.internal"].includes(hostname)) {
    throw new Error("Private/internal URLs are not allowed.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("Private/internal IP URLs are not allowed.");
    return;
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error("URL resolves to private/internal network address and is blocked.");
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Smart input: file path, HTTPS URL, data URL, or base64 — with SSRF protection and size check. */
async function smartInput(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("Input file/image/video must be a non-empty string: file path, HTTPS URL, data URL, or base64.");
  }
  const value = input.trim();

  if (value.startsWith("data:")) {
    const idx = value.indexOf(",");
    if (idx === -1) throw new Error("Invalid data URL input.");
    const base64 = value.slice(idx + 1);
    const byteLen = Buffer.byteLength(base64, "base64");
    if (byteLen > MAX_RAW_BYTES) throw new Error(`Input too large: ${(byteLen / 1024 / 1024).toFixed(1)}MB, max ${(MAX_RAW_BYTES / 1024 / 1024).toFixed(1)}MB`);
    return base64;
  }

  if (fs.existsSync(value)) {
    const stat = fs.statSync(value);
    if (!stat.isFile()) throw new Error("Input path exists but is not a file.");
    if (stat.size > MAX_RAW_BYTES) throw new Error(`File too large: ${(stat.size / 1024 / 1024).toFixed(1)}MB, max ${(MAX_RAW_BYTES / 1024 / 1024).toFixed(1)}MB`);
    return fs.readFileSync(value).toString("base64");
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    await assertPublicUrl(value);
    const resp = await fetchWithTimeout(value);
    if (!resp.ok) throw new Error(`Failed to download input file: HTTP ${resp.status}`);
    const len = Number(resp.headers.get("content-length") || "0");
    if (len && len > MAX_RAW_BYTES) throw new Error(`Downloaded file too large: ${(len / 1024 / 1024).toFixed(1)}MB`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_RAW_BYTES) throw new Error(`Downloaded file too large: ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
    return buf.toString("base64");
  }

  // Treat as raw base64. Do not over-validate because upstream may accept provider-specific encodings.
  const approxBytes = Math.ceil(value.length * 3 / 4);
  if (approxBytes > MAX_RAW_BYTES) throw new Error(`Base64 input too large: ${(approxBytes / 1024 / 1024).toFixed(1)}MB`);
  return value;
}

/** Dual-path field parsing. */
function pf(data, field) {
  return data?.[field] ?? (data?.result?.[field] ?? undefined);
}

async function apiPost(url, payload) {
  const resp = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data;
  try {
    data = await resp.json();
  } catch {
    return { code: "JSON_PARSE_ERROR", msg: `API returned non-JSON response (HTTP ${resp.status}). Please retry.` };
  }
  if (!resp.ok && data.code == null) {
    return { code: `HTTP_${resp.status}`, msg: data.msg || data.message || `HTTP ${resp.status}` };
  }
  return data;
}

/** POST with retry for network errors and upstream busy codes. */
async function apiPostRetry(url, payload, retries = 3, wait = 3000) {
  let data;
  for (let i = 0; i < retries; i++) {
    try {
      data = await apiPost(url, payload);
    } catch (e) {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, wait * (i + 1)));
        continue;
      }
      throw e;
    }
    if (["999999", "999998", "999997"].includes(String(data.code)) && i < retries - 1) {
      await new Promise(r => setTimeout(r, wait * (i + 1)));
      continue;
    }
    return data;
  }
  return data;
}

// ============================================================
// Auth with in-memory caching (19min TTL)
// ============================================================

const _kycCache = new Map();
const _labelCache = new Map();
const CACHE_TTL = 19 * 60 * 1000;

function credentialCacheKey(...values) {
  return crypto.createHash("sha1").update(values.join("\n"), "utf8").digest("hex");
}

async function kycAuth(baseUrl = KYC_BASE_MAIN) {
  const { kycAppId, kycSecret } = credentials();
  if (!kycAppId || !kycSecret) {
    throw new Error("Missing KYC credentials. Set KYC_APPID + KYC_SECRET env vars or x-kyc-appid + x-kyc-secret request headers.");
  }

  const cacheKey = credentialCacheKey(baseUrl, kycAppId, kycSecret);
  const cached = _kycCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.auth;

  let td, tkd;
  try {
    td = await (await fetchWithTimeout(`${baseUrl}/api/oauth2/access_token?app_id=${encodeURIComponent(kycAppId)}&secret=${encodeURIComponent(kycSecret)}&grant_type=client_credential&version=1.0.0`)).json();
  } catch (e) {
    throw new Error(`access_token network error: ${redact(e.message || e)}`);
  }
  if (String(td.code) !== "0") throw new Error(`access_token failed: ${redact(td.msg || td.code)}`);

  try {
    tkd = await (await fetchWithTimeout(`${baseUrl}/api/oauth2/api_ticket?app_id=${encodeURIComponent(kycAppId)}&access_token=${encodeURIComponent(td.access_token)}&type=SIGN&version=1.0.0`)).json();
  } catch (e) {
    throw new Error(`SIGN ticket network error: ${redact(e.message || e).replace(td?.access_token || "", "***")}`);
  }
  if (String(tkd.code) !== "0") throw new Error(`SIGN ticket failed: ${redact(tkd.msg || tkd.code)}`);

  const ticket = tkd.tickets?.[0]?.value;
  if (!ticket) throw new Error("SIGN ticket failed: missing ticket value.");

  const auth = { appId: kycAppId, sign: (o, n) => sha1Sign([kycAppId, o, n, "1.0.0", ticket]) };
  _kycCache.set(cacheKey, { auth, expiry: Date.now() + CACHE_TTL });
  return auth;
}

async function labelAuth() {
  const { labelAppId, labelSecret } = credentials();
  if (!labelAppId || !labelSecret) {
    throw new Error(
      "Missing media labeling credentials. Set LABEL_APPID + LABEL_SECRET env vars or x-label-appid + x-label-secret request headers. " +
      "Media labeling uses separate credentials from KYC."
    );
  }

  const cacheKey = credentialCacheKey(LABEL_BASE, labelAppId, labelSecret);
  const cached = _labelCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) return cached.auth;

  let td;
  try {
    td = await (await fetchWithTimeout(`${LABEL_BASE}/idap-ac/oauth2/v2/api_ticket?appId=${encodeURIComponent(labelAppId)}&secret=${encodeURIComponent(labelSecret)}`)).json();
  } catch (e) {
    throw new Error(`Label ticket network error: ${redact(e.message || e)}`);
  }
  if (String(td.code) !== "0" && td.code !== 0) throw new Error(`Label ticket failed: ${redact(td.msg || td.code)}`);
  if (!td.ticket) throw new Error("Label ticket failed: missing ticket value.");

  const ticket = td.ticket;
  const auth = { appId: labelAppId, sign: (o, n, ts) => sha1Sign([labelAppId, o, n, "1.0.0", ticket, ts]) };
  _labelCache.set(cacheKey, { auth, expiry: Date.now() + CACHE_TTL });
  return auth;
}

// ============================================================
// Risk tag map
// ============================================================

const TAG_MAP = {
  "01": "Eyes closed", "02": "Action incomplete", "03": "Replay attack",
  "04": "Synthetic attack", "05": "Fraud template", "06": "Watermark detected",
  "07": "Reflection check failed", "08": "Multiple faces", "09": "Poor face quality",
  "10": "Distance check failed", "11": "Adversarial attack", "12": "Attack traces on face",
};

const LEVEL_MAP = { "1": "No risk", "2": "Medium suspicion", "3": "High suspicion" };

// ============================================================
// Tool implementations
// ============================================================

async function toolFaceCompare(args) {
  const photo1 = requireString(args, "photo1");
  const photo2 = requireString(args, "photo2");
  const sourcePhotoType = optionalString(args, "sourcePhotoType", "2");
  if (!["1", "2"].includes(sourcePhotoType)) throw new Error("sourcePhotoType must be '1' or '2'.");

  const a = await kycAuth(KYC_BASE_MINI);
  const o = generateOrderNo(), n = generateNonce(), s = a.sign(o, n);
  const d = await apiPost(`${KYC_BASE_MINI}/api/paas/easycompare?orderNo=${o}`, {
    appId: a.appId, nonce: n, version: "1.0.0", sign: s, orderNo: o,
    photoStr: await smartInput(photo1), sourcePhotoStr: await smartInput(photo2), sourcePhotoType,
  });
  if (String(pf(d, "code")) !== "0") return { success: false, error: pf(d, "msg"), code: pf(d, "code"), orderNo: o };
  return { success: true, similarity: pf(d, "similarity"), orderNo: o };
}

async function _livenessImpl(file, faceInputType) {
  const a = await kycAuth(KYC_BASE_MAIN);
  const o = generateOrderNo(), n = generateNonce(), s = a.sign(o, n);
  const url = `${KYC_BASE_MAIN}/api/v2/paas/detectAIFakeFace?orderNo=${o}`;
  const payload = { appId: a.appId, orderNo: o, nonce: n, version: "1.0.0", sign: s, faceInputType, faceInput: await smartInput(file) };
  const d = faceInputType === 2 ? await apiPostRetry(url, payload) : await apiPost(url, payload);
  if (String(pf(d, "code")) !== "0") return { success: false, error: pf(d, "msg"), code: pf(d, "code"), orderNo: o };
  const lv = pf(d, "livenessInfoLevel"), tg = pf(d, "livenessInfoTag");
  return {
    success: true,
    riskLevel: lv,
    riskTag: tg,
    riskLevelText: LEVEL_MAP[String(lv)] || `Unknown(${lv})`,
    riskTagText: TAG_MAP[String(tg)] || `Tag(${tg})`,
    orderNo: o,
  };
}

async function toolPhotoLiveness(args) { return _livenessImpl(requireString(args, "file"), 1); }
async function toolVideoLiveness(args) { return _livenessImpl(requireString(args, "file"), 2); }

async function toolIdCardOcr(args) {
  const image = requireString(args, "image");
  const side = optionalString(args, "side", "0");
  if (!["0", "1"].includes(side)) throw new Error("side must be '0' (portrait/front) or '1' (emblem/back).");

  const a = await kycAuth(KYC_BASE_MAIN);
  const o = generateOrderNo(), n = generateNonce(), s = a.sign(o, n);
  const d = await apiPost(`${KYC_BASE_MAIN}/api/paas/idcardocrapp?orderNo=${o}`, {
    appId: a.appId, version: "1.0.0", nonce: n, sign: s, orderNo: o, cardType: side, idcardStr: await smartInput(image),
  });
  if (String(pf(d, "code")) !== "0") return { success: false, error: pf(d, "msg"), code: pf(d, "code"), orderNo: o };
  const fields = ["name", "sex", "nation", "birth", "idcard", "address", "authority", "validDate"];
  const r = { success: true, orderNo: o };
  fields.forEach(f => { const v = pf(d, f); if (v != null) r[f] = v; });
  return r;
}

async function toolBankCardOcr(args) {
  const image = requireString(args, "image");
  const a = await kycAuth(KYC_BASE_MAIN);
  const o = generateOrderNo(), n = generateNonce(), s = a.sign(o, n);
  const d = await apiPost(`${KYC_BASE_MAIN}/api/paas/bankcardocrapp`, {
    appId: a.appId, version: "1.0.0", nonce: n, sign: s, orderNo: o, bankcardStr: await smartInput(image),
  });
  if (String(pf(d, "code")) !== "0") return { success: false, error: pf(d, "msg"), code: pf(d, "code"), orderNo: o };
  return { success: true, bankcardNo: pf(d, "bankcardNo"), bankcardValidDate: pf(d, "bankcardValidDate"), orderNo: o };
}

// NOTE: Upstream API requires this exact app ID field name.
async function toolDriverLicenseOcr(args) {
  const image = requireString(args, "image");
  const a = await kycAuth(KYC_BASE_MINI);
  const o = generateOrderNo(), n = generateNonce(), s = a.sign(o, n);
  const d = await apiPost(`${KYC_BASE_MINI}/api/v2/ocrpaas/driverlicenseupload`, {
    webankAppId: a.appId, version: "1.0.0", nonce: n, sign: s, orderNo: o, imageStr: await smartInput(image),
  });
  if (String(pf(d, "code")) !== "0") return { success: false, error: pf(d, "msg"), code: pf(d, "code"), orderNo: o };
  const fields = ["licenseNo", "name", "sex", "nationality", "address", "birth", "fetchDate", "driveClass", "validDateFrom", "validDateTo"];
  const r = { success: true, orderNo: o };
  fields.forEach(f => { const v = pf(d, f); if (v != null) r[f] = v; });
  return r;
}

async function toolVehicleLicenseOcr(args) {
  const image = requireString(args, "image");
  const side = optionalString(args, "side", "1");
  if (!["1", "2"].includes(side)) throw new Error("side must be '1' (main page) or '2' (supplementary page).");

  const a = await kycAuth(KYC_BASE_MINI);
  const o = generateOrderNo(), n = generateNonce(), s = a.sign(o, n);
  const d = await apiPost(`${KYC_BASE_MINI}/api/v2/ocrpaas/vehiclelicenseupload`, {
    webankAppId: a.appId, version: "1.0.0", nonce: n, sign: s, orderNo: o,
    imageStr: await smartInput(image), vehicleLicenseSide: side,
  });
  if (String(pf(d, "code")) !== "0") return { success: false, error: pf(d, "msg"), code: pf(d, "code"), orderNo: o };
  const fields = [
    "plateNo", "vehicleType", "owner", "useCharacter", "address", "model", "vin", "engineNo",
    "registeDate", "issueDate", "authorizedCarryCapacity", "authorizedLoadQuality", "fileNumber", "total",
    "inspectionRecord", "externalDimensions", "curbWeright",
  ];
  const r = { success: true, orderNo: o };
  fields.forEach(f => { const v = pf(d, f); if (v != null) r[f] = v; });
  if (r.curbWeright != null && r.curbWeight == null) r.curbWeight = r.curbWeright; // normalized alias for upstream typo
  return r;
}

function normalizeLabels(labels) {
  const values = labels.split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
  if (!values.length) throw new Error("labels must contain at least one label code.");
  if (values.length > 5) throw new Error("labels supports max 5 codes per request.");
  const invalid = values.filter(v => !LABEL_CODES.has(v));
  if (invalid.length) throw new Error(`Unsupported label code(s): ${invalid.join(", ")}.`);
  return values.join(",");
}

async function toolMediaLabeling(args) {
  const file = requireString(args, "file");
  const labels = normalizeLabels(requireString(args, "labels"));
  const type = optionalString(args, "type", "image");
  if (!["image", "video"].includes(type)) throw new Error("type must be 'image' or 'video'.");
  const doLive = optionalString(args, "doLive", "1");
  const doCompare = optionalString(args, "doCompare", "1");
  if (!["0", "1"].includes(doLive)) throw new Error("doLive must be '0' or '1'.");
  if (!["0", "1"].includes(doCompare)) throw new Error("doCompare must be '0' or '1'.");

  const a = await labelAuth();
  const o = generateOrderNo("label"), n = generateNonce(), ts = String(Math.floor(Date.now() / 1000));
  const s = a.sign(o, n, ts);
  const ftc = type === "video" ? "1" : "0";

  const sd = await apiPost(`${LABEL_BASE}/idap-ac/server/fileModeration?orderNo=${o}`, {
    appId: a.appId, orderNo: o, nonce: n, version: "1.0.0", sign: s,
    fileStr: await smartInput(file), fileType: ftc, doLive, doCompare,
    labelList: labels, unixTimeStamp: ts,
  });
  if (String(sd.code) !== "0") return { success: false, error: sd.msg || "Submit failed", code: sd.code, orderNo: o };

  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const qn = generateNonce(), qt = String(Math.floor(Date.now() / 1000));
    const qs = a.sign(o, qn, qt);
    const qd = await apiPost(`${LABEL_BASE}/idap-ac/server/getFileModeration?orderNo=${o}`, {
      appId: a.appId, orderNo: o, nonce: qn, version: "1.0.0", sign: qs, unixTimeStamp: qt,
    });
    const qc = String(qd.code || "");
    if (qc === "0") {
      const r = qd.result || qd;
      return { success: true, fileLabel: r.fileLabel || [], liveStatus: r.liveStatus, compareStatus: r.compareStatus, orderNo: o };
    }
    if (qc === "66661015" && i < 2) continue;
    return { success: false, error: qd.msg || "Query failed", code: qc, orderNo: o };
  }
  return { success: false, error: "Timeout", code: "TIMEOUT", orderNo: o };
}

// ============================================================
// MCP Server factory
// ============================================================

function toolDefinitions() {
  return [
    {
      name: "face_compare",
      description: "Compare two face photos and return a similarity score from 0 to 100. Best for customer onboarding, duplicate-account checks, selfie-to-ID matching, and agent workflows that need a same-person decision. Input supports file path, HTTPS URL, data URL, or base64. Suggested business rule: score >=80 means high-confidence same person, but final thresholds should be calibrated by scenario.",
      inputSchema: { type: "object", properties: {
        photo1: { type: "string", description: "First face photo: local file path, HTTPS URL, data URL, or base64." },
        photo2: { type: "string", description: "Second face photo: local file path, HTTPS URL, data URL, or base64." },
        sourcePhotoType: { type: "string", description: "Reference photo type: 1=watermarked ID photo, 2=HD photo. Default: 2.", default: "2", enum: ["1", "2"] },
      }, required: ["photo1", "photo2"] },
    },
    {
      name: "photo_liveness_detect",
      description: "Detect whether a face photo is a genuine capture or a spoof/AI-forged image. Returns risk level plus attack tag, covering screen replay, print attack, synthetic face, adversarial traces, multiple faces, and poor-quality captures. Best for lightweight anti-fraud before account opening, loan application, payment-risk step-up, or AI-agent human gate.",
      inputSchema: { type: "object", properties: {
        file: { type: "string", description: "Face photo to analyze: local file path, HTTPS URL, data URL, or base64." },
      }, required: ["file"] },
    },
    {
      name: "video_liveness_detect",
      description: "Detect whether a face video is genuine or a replay/deepfake/synthetic attack. Includes retry handling for transient upstream busy responses. Best for higher-risk eKYC, remote onboarding, transaction step-up, and Know Your Agent human-binding gates. Video limit: max 20MB; upstream recommends short clips <=20s.",
      inputSchema: { type: "object", properties: {
        file: { type: "string", description: "Face video: local file path, HTTPS URL, data URL, or base64. Max 20MB." },
      }, required: ["file"] },
    },
    {
      name: "id_card_ocr",
      description: "Extract structured data from a Chinese national ID card image. Front side returns name, sex, ethnicity, birth date, ID number and address. Back side returns issuing authority and validity. Best for identity-data prefill, document digitization, and onboarding workflow automation.",
      inputSchema: { type: "object", properties: {
        image: { type: "string", description: "ID card image: local file path, HTTPS URL, data URL, or base64." },
        side: { type: "string", description: "0=portrait/front side, 1=national emblem/back side. Default: 0.", default: "0", enum: ["0", "1"] },
      }, required: ["image"] },
    },
    {
      name: "bank_card_ocr",
      description: "Extract bank card number and expiry date from a bank card front image. Best for payment binding, card-information prefill, and bank-account verification workflows.",
      inputSchema: { type: "object", properties: {
        image: { type: "string", description: "Bank card front image: local file path, HTTPS URL, data URL, or base64." },
      }, required: ["image"] },
    },
    {
      name: "driver_license_ocr",
      description: "Extract structured fields from a Chinese driver's license main page: license number, name, vehicle class, address, issue date and validity dates. Best for auto insurance, car rental, fleet compliance, and vehicle-finance workflows. Supplementary page is not supported by this upstream endpoint.",
      inputSchema: { type: "object", properties: {
        image: { type: "string", description: "Driver license main-page image: local file path, HTTPS URL, data URL, or base64." },
      }, required: ["image"] },
    },
    {
      name: "vehicle_license_ocr",
      description: "Extract structured fields from a Chinese vehicle license. Main page returns plate number, VIN, owner, engine number and vehicle model. Supplementary page returns inspection and capacity-related fields. Best for auto loans, fleet onboarding, vehicle insurance, and collateral checks.",
      inputSchema: { type: "object", properties: {
        image: { type: "string", description: "Vehicle license image: local file path, HTTPS URL, data URL, or base64." },
        side: { type: "string", description: "1=main page, 2=supplementary page. Default: 1.", default: "1", enum: ["1", "2"] },
      }, required: ["image"] },
    },
    {
      name: "media_labeling",
      description: "Analyze an image/video for risk and scene attributes. Supports portrait labels such as mask, hat, sunglasses, coercion, unconscious/asleep, phone use, headphones, tattoo, nudity, critical patient, facial mask; and environment labels such as multiple people, inside car, hotel room, car dealership. Best for compliance scene checks, loan/insurance evidence review, and anti-fraud triage. Async upstream job is submitted and polled automatically.",
      inputSchema: { type: "object", properties: {
        file: { type: "string", description: "Image/video: local file path, HTTPS URL, data URL, or base64." },
        labels: { type: "string", description: "Comma-separated label codes, max 5 per request. Portrait: A01 facial mask, A02 medical mask, A04 headphones, A05 nudity, A06 sunglasses, A09 coercion, A10 unconscious/asleep, A11 phone, A13 tattoo, A14 hat, A15 critical patient. Environment: B02 multiple people, B03 inside car, B06 hotel room, B07 car dealership. Example: A02,A14,B03." },
        type: { type: "string", description: "image or video. Default: image.", default: "image", enum: ["image", "video"] },
        doLive: { type: "string", description: "Enable video liveness check: 1=yes, 0=no. Default: 1.", default: "1", enum: ["0", "1"] },
        doCompare: { type: "string", description: "Enable video face-consistency check: 1=yes, 0=no. Default: 1.", default: "1", enum: ["0", "1"] },
      }, required: ["file", "labels"] },
    },
  ];
}

function createServer() {
  const server = new Server({ name: SERVER_NAME, version: VERSION }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefinitions() }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      const dispatch = {
        face_compare: () => toolFaceCompare(args),
        photo_liveness_detect: () => toolPhotoLiveness(args),
        video_liveness_detect: () => toolVideoLiveness(args),
        id_card_ocr: () => toolIdCardOcr(args),
        bank_card_ocr: () => toolBankCardOcr(args),
        driver_license_ocr: () => toolDriverLicenseOcr(args),
        vehicle_license_ocr: () => toolVehicleLicenseOcr(args),
        media_labeling: () => toolMediaLabeling(args),
      };
      if (!dispatch[name]) {
        return { content: [{ type: "text", text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }) }], isError: true };
      }
      const result = await dispatch[name]();
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: result?.success === false };
    } catch (err) {
      return { content: [{ type: "text", text: JSON.stringify({ success: false, error: redact(err.message || err) }) }], isError: true };
    }
  });

  return server;
}

// ============================================================
// Transports
// ============================================================

async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`eKYC Suite MCP Server v${VERSION} running on stdio`);
}

function startHttp() {
  const host = process.env.HOST || "0.0.0.0";
  const port = Number(process.env.PORT || 3000);
  const app = createMcpExpressApp({ host, allowedHosts: process.env.ALLOWED_HOSTS ? process.env.ALLOWED_HOSTS.split(",").map(s => s.trim()).filter(Boolean) : undefined });
  const transports = {};

  function contextForTransport(transport, headers) {
    transport.credentialHeaders = mergedCredentialHeaders(transport.credentialHeaders, headers);
    return { headers: transport.credentialHeaders };
  }

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true, name: SERVER_NAME, version: VERSION, transports: ["streamable-http", "sse"] });
  });

  // Streamable HTTP endpoint: recommended for newer MCP clients.
  app.all("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"];
      let transport;

      if (sessionId && transports[sessionId]) {
        const existing = transports[sessionId];
        if (!(existing instanceof StreamableHTTPServerTransport)) {
          res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Session exists but uses a different transport protocol." }, id: null });
          return;
        }
        transport = existing;
      } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => { transports[sid] = transport; },
        });
        transport.credentialHeaders = credentialHeaderSubset(req.headers);
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) delete transports[sid];
        };
        const server = createServer();
        await server.connect(transport);
      } else {
        res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request: No valid MCP session. Initialize with POST /mcp first." }, id: null });
        return;
      }

      await requestContext.run(contextForTransport(transport, req.headers), () => transport.handleRequest(req, res, req.body));
    } catch (error) {
      console.error("Error handling /mcp request:", redact(error.message || error));
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
    }
  });

  // Legacy HTTP + SSE endpoints: required by older clients and Baidu MCP-SSE style integration.
  app.get("/sse", async (req, res) => {
    try {
      const transport = new SSEServerTransport("/messages", res);
      transport.credentialHeaders = credentialHeaderSubset(req.headers);
      transports[transport.sessionId] = transport;
      res.on("close", () => { delete transports[transport.sessionId]; });
      const server = createServer();
      await server.connect(transport);
    } catch (error) {
      console.error("Error starting /sse transport:", redact(error.message || error));
      if (!res.headersSent) res.status(500).send("Internal server error");
    }
  });

  app.post("/messages", async (req, res) => {
    try {
      const sessionId = req.query.sessionId;
      const transport = transports[sessionId];
      if (!(transport instanceof SSEServerTransport)) {
        res.status(400).send("No SSE transport found for sessionId");
        return;
      }
      await requestContext.run(contextForTransport(transport, req.headers), () => transport.handlePostMessage(req, res, req.body));
    } catch (error) {
      console.error("Error handling /messages request:", redact(error.message || error));
      if (!res.headersSent) res.status(500).send("Internal server error");
    }
  });

  const httpServer = app.listen(port, host, (error) => {
    if (error) {
      console.error("Failed to start HTTP server:", error);
      process.exit(1);
    }
    console.error(`eKYC Suite MCP Server v${VERSION} listening on http://${host}:${port}`);
    console.error(`Endpoints: /mcp (Streamable HTTP), /sse + /messages (legacy SSE), /healthz`);
  });

  const shutdown = async () => {
    for (const sid of Object.keys(transports)) {
      try { await transports[sid].close(); } catch {}
      delete transports[sid];
    }
    httpServer.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const modeArg = process.argv.find(a => a.startsWith("--transport="));
const mode = (modeArg?.split("=")[1] || process.env.MCP_TRANSPORT || (process.argv.includes("--http") ? "http" : "stdio")).toLowerCase();

if (["http", "sse", "streamable-http"].includes(mode)) {
  startHttp();
} else if (mode === "stdio") {
  startStdio().catch(err => { console.error(redact(err.message || err)); process.exit(1); });
} else {
  console.error(`Unsupported transport: ${mode}. Use stdio or http.`);
  process.exit(1);
}
