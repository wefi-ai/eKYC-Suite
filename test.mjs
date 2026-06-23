#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function testStdio() {
  const client = new Client({ name: "ekyc-suite-test-stdio", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "node",
    args: ["server.mjs"],
    cwd: process.cwd(),
    env: { ...process.env, MCP_TRANSPORT: "stdio", KYC_APPID: "", KYC_SECRET: "", LABEL_APPID: "", LABEL_SECRET: "" },
    stderr: "pipe",
  });
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  assert.ok(tools.tools.some(t => t.name === "face_compare"));
  const result = await client.callTool({ name: "id_card_ocr", arguments: { image: "ZmFrZQ==" } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Missing KYC credentials/);
  await client.close();
}

function waitForHttp(port) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const tick = async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (resp.ok) return resolve();
      } catch {}
      if (Date.now() > deadline) return reject(new Error("HTTP server did not become ready"));
      setTimeout(tick, 150);
    };
    tick();
  });
}

async function withHttpServer(fn) {
  const port = 39217;
  const child = spawn("node", ["server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, MCP_TRANSPORT: "http", HOST: "127.0.0.1", PORT: String(port), KYC_APPID: "", KYC_SECRET: "", LABEL_APPID: "", LABEL_SECRET: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", d => { stderr += d.toString(); });
  try {
    await waitForHttp(port);
    await fn(port);
  } finally {
    child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve));
  }
  assert.match(stderr, /Endpoints:/);
}

async function testStreamableHttp(port) {
  const client = new Client({ name: "ekyc-suite-test-http", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  assert.ok(tools.tools.some(t => t.name === "video_liveness_detect"));
  await client.close();
}

async function testSse(port) {
  const client = new Client({ name: "ekyc-suite-test-sse", version: "1.0.0" });
  const transport = new SSEClientTransport(new URL(`http://127.0.0.1:${port}/sse`));
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  assert.ok(tools.tools.some(t => t.name === "media_labeling"));
  await client.close();
}

await testStdio();
await withHttpServer(async (port) => {
  await testStreamableHttp(port);
  await testSse(port);
});

console.log("PASS: stdio, Streamable HTTP, and SSE MCP transports are runnable; 8 tools are discoverable; missing-credential error path is clean.");
