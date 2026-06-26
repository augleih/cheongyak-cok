import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  MCP_PROTOCOL_VERSION,
  createMcpHttpServer,
} from "../scripts/lib/mcp-http-server.mjs";

test("serves initialize, initialized notification, and tools/list over Streamable HTTP", async () => {
  const server = createMcpHttpServer();

  await withListeningServer(server, async (baseUrl) => {
    const initialize = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "test-client",
          version: "1.0.0",
        },
      },
    });

    assert.equal(initialize.status, 200);
    assert.match(initialize.contentType, /^application\/json/);
    assert.equal(initialize.body.jsonrpc, "2.0");
    assert.equal(initialize.body.id, 1);
    assert.deepEqual(initialize.body.result, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "cheongyak-cok",
        version: "0.1.0",
      },
      instructions:
        "CheongyakCok searches cached MyHome-listed public housing notices. Tool results are informational and official notice documents should be reviewed before applying.",
    });

    const initialized = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    assert.equal(initialized.status, 202);
    assert.equal(initialized.text, "");

    const list = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });

    assert.equal(list.status, 200);
    assert.deepEqual(
      list.body.result.tools.map((tool) => tool.name),
      ["search_notices", "get_notice_detail"],
    );
    assert.equal(
      list.body.result.tools[0].description.includes("CheongyakCok"),
      true,
    );
    assert.equal(list.body.result.tools[0].inputSchema.additionalProperties, false);

    const get = await fetch(`${baseUrl}/mcp`, {
      method: "GET",
      headers: {
        accept: "text/event-stream",
      },
    });

    assert.equal(get.status, 405);
  });
});

test("calls search_notices through tools/call without exposing raw cache fields", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-http-server-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");
    const server = createMcpHttpServer({ cachePath });

    await withListeningServer(server, async (baseUrl) => {
      const call = await postMcp(baseUrl, {
        jsonrpc: "2.0",
        id: "call-1",
        method: "tools/call",
        params: {
          name: "search_notices",
          arguments: {
            keyword: "Happy",
            limit: 3,
          },
        },
      });

      assert.equal(call.status, 200);
      assert.equal(call.body.id, "call-1");
      assert.equal(call.body.result.isError, false);
      assert.equal(call.body.result.structuredContent.total, 1);
      assert.deepEqual(
        call.body.result.structuredContent.notices.map((notice) => notice.id),
        ["myhome:public_rental:happy-seoul:1"],
      );
      assert.equal(JSON.stringify(call.body.result).includes("secret raw payload"), false);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("calls get_notice_detail through tools/call without exposing raw cache fields", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-http-server-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");
    const server = createMcpHttpServer({ cachePath });

    await withListeningServer(server, async (baseUrl) => {
      const call = await postMcp(baseUrl, {
        jsonrpc: "2.0",
        id: "detail-1",
        method: "tools/call",
        params: {
          name: "get_notice_detail",
          arguments: {
            id: "myhome:public_rental:happy-seoul:1",
          },
        },
      });

      assert.equal(call.status, 200);
      assert.equal(call.body.id, "detail-1");
      assert.equal(call.body.result.isError, false);
      assert.equal(call.body.result.structuredContent.found, true);
      assert.equal(
        call.body.result.structuredContent.notice.id,
        "myhome:public_rental:happy-seoul:1",
      );
      assert.equal(JSON.stringify(call.body.result).includes("secret raw payload"), false);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("returns protocol errors for unknown tools and rejects disallowed origins", async () => {
  const server = createMcpHttpServer({
    allowedOrigins: ["https://allowed.example"],
  });

  await withListeningServer(server, async (baseUrl) => {
    const originRejected = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });

    assert.equal(originRejected.status, 403);

    const unknownTool = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "refresh_notice_cache",
        arguments: {},
      },
    }, {
      origin: "https://allowed.example",
    });

    assert.equal(unknownTool.status, 200);
    assert.deepEqual(unknownTool.body.error, {
      code: -32602,
      message: "Unknown tool: refresh_notice_cache",
    });
  });
});

test("CLI starts the MCP HTTP server with a configured cache path", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "mcp-http-cli-"));
  const cachePath = join(tempDir, "myhome-notices.json");
  let child;

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");
    child = spawn(
      process.execPath,
      [
        "scripts/serve-mcp.mjs",
        "--host",
        "127.0.0.1",
        "--port",
        "0",
        "--cachePath",
        cachePath,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    const startup = await readStartupLine(child);
    assert.equal(startup.event, "mcp_server_listening");
    assert.equal(startup.host, "127.0.0.1");
    assert.equal(typeof startup.port, "number");

    const call = await postMcp(startup.endpoint.replace(/\/mcp$/, ""), {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "search_notices",
        arguments: {
          keyword: "Happy",
        },
      },
    });

    assert.equal(call.status, 200);
    assert.equal(call.body.result.isError, false);
    assert.equal(call.body.result.structuredContent.returned, 1);
  } finally {
    if (child && child.exitCode === null && !child.killed) {
      child.kill();
      await waitForExit(child);
    }

    rmSync(tempDir, { recursive: true, force: true });
  }
});

async function withListeningServer(server, callback) {
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

function readStartupLine(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      reject(new Error(`server did not start. stderr: ${stderr}`));
    }, 5000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const line = stdout.split(/\r?\n/).find(Boolean);

      if (line) {
        clearTimeout(timeout);
        resolve(JSON.parse(line));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code) => {
      if (!stdout) {
        clearTimeout(timeout);
        reject(new Error(`server exited before startup line with code ${code}. stderr: ${stderr}`));
      }
    });
  });
}

function waitForExit(child) {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    child.once("exit", resolve);
  });
}

async function postMcp(baseUrl, message, headers = {}) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(message),
  });
  const text = await response.text();

  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    text,
    body: text ? JSON.parse(text) : undefined,
  };
}

function sampleCache() {
  return {
    generatedAt: "2026-06-26T00:00:00.000Z",
    notices: [
      {
        id: "myhome:public_rental:happy-seoul:1",
        sourceNoticeGroupId: "myhome:public_rental:happy-seoul",
        noticeType: "public_rental",
        title: "Seoul Happy Housing",
        provider: { name: "SH" },
        region: {
          sidoName: "Seoul",
          sigunguName: "Gangnam",
        },
        categories: {
          houseType: { name: "Apartment" },
          supplyType: { name: "Public rental" },
        },
        dates: {
          noticeDate: "2026-06-25",
          applicationStartDate: "2026-07-07",
          applicationEndDate: "2026-07-09",
        },
        rawApiResponse: "secret raw payload",
      },
      {
        id: "myhome:public_sale:busan:1",
        noticeType: "public_sale",
        title: "Busan Sale",
        dates: {
          noticeDate: "2026-06-24",
          applicationStartDate: "2026-07-06",
          applicationEndDate: "2026-07-08",
        },
      },
    ],
  };
}
