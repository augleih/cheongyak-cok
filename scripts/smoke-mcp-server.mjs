#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MCP_PROTOCOL_VERSION,
  createMcpHttpServer,
} from "./lib/mcp-http-server.mjs";

async function main() {
  const tempDir = mkdtempSync(join(tmpdir(), "cheongyak-cok-mcp-smoke-"));
  const cachePath = join(tempDir, "myhome-notices.json");
  const server = createMcpHttpServer({ cachePath });

  try {
    writeFileSync(cachePath, JSON.stringify(smokeCache()), "utf8");
    const baseUrl = await listen(server);

    await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: "cheongyak-cok-smoke",
          version: "0.0.0",
        },
      },
    });

    await postMcp(baseUrl, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    const toolsList = await postMcp(baseUrl, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    const search = await callTool(baseUrl, 3, "search_notices", {
      keyword: "Happy",
      limit: 3,
    });
    const firstNoticeId = search.structuredContent.notices[0]?.id;
    const detail = await callTool(baseUrl, 4, "get_notice_detail", {
      id: firstNoticeId,
    });
    const eligibility = await callTool(baseUrl, 5, "evaluate_eligibility", {
      noticeId: firstNoticeId,
      profile: {
        income: {
          monthlyAverage: 1000000,
        },
      },
    });

    console.log(JSON.stringify({
      ok: true,
      endpointPath: "/mcp",
      toolNames: toolsList.result.tools.map((tool) => tool.name),
      calls: {
        search_notices: {
          returned: search.structuredContent.returned,
          firstNoticeId,
        },
        get_notice_detail: {
          found: detail.structuredContent.found,
          noticeId: detail.structuredContent.notice?.id,
        },
        evaluate_eligibility: {
          found: eligibility.structuredContent.found,
          status: eligibility.structuredContent.eligibility.status,
          needsConfirmationCount:
            eligibility.structuredContent.eligibility.needsConfirmation.length,
        },
      },
    }, null, 2));
  } finally {
    await closeServer(server);
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function callTool(baseUrl, id, name, args) {
  const response = await postMcp(baseUrl, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  });

  if (response.result?.isError) {
    throw new Error(`${name} returned an error: ${response.result.content?.[0]?.text}`);
  }

  return response.result;
}

async function postMcp(baseUrl, message) {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
    },
    body: JSON.stringify(message),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`MCP HTTP ${response.status}: ${text}`);
  }

  return text ? JSON.parse(text) : undefined;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function closeServer(server) {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

function smokeCache() {
  return {
    generatedAt: "2026-06-26T00:00:00.000Z",
    notices: [
      {
        id: "myhome:public_rental:smoke-happy:1",
        sourceNoticeGroupId: "myhome:public_rental:smoke-happy",
        noticeType: "public_rental",
        title: "Smoke Happy Housing",
        provider: { name: "LH" },
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
        links: {
          sourceUrl: "https://apply.example/smoke-happy",
        },
        rawApiResponse: "secret raw payload",
      },
    ],
  };
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
