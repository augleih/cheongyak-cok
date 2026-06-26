import { createServer } from "node:http";

import {
  handleSearchNoticesTool,
  searchNoticesToolDefinition,
} from "./search-notices-tool.mjs";

export const MCP_PROTOCOL_VERSION = "2025-03-26";

const DEFAULT_ENDPOINT_PATH = "/mcp";
const DEFAULT_SERVER_INFO = {
  name: "cheongyak-cok",
  version: "0.1.0",
};
const JSON_RPC_VERSION = "2.0";
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

export function createMcpHttpServer(options = {}) {
  return createServer(createMcpRequestHandler(options));
}

export function createMcpRequestHandler({
  endpointPath = DEFAULT_ENDPOINT_PATH,
  cachePath,
  readCache,
  allowedOrigins,
  serverInfo = DEFAULT_SERVER_INFO,
} = {}) {
  return async (request, response) => {
    if (request.url !== endpointPath) {
      respondText(response, 404, "Not found");
      return;
    }

    if (!isAllowedOrigin(request.headers.origin, allowedOrigins)) {
      respondText(response, 403, "Forbidden origin");
      return;
    }

    if (request.method === "GET") {
      response.setHeader("Allow", "POST");
      respondText(response, 405, "SSE streams are not supported");
      return;
    }

    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      respondText(response, 405, "Method not allowed");
      return;
    }

    if (!acceptsStreamableHttpResponse(request.headers.accept)) {
      respondText(response, 406, "Accept must include application/json and text/event-stream");
      return;
    }

    let message;

    try {
      message = JSON.parse(await readRequestBody(request));
    } catch {
      respondJson(response, 400, jsonRpcError(null, JSON_RPC_ERRORS.PARSE_ERROR, "Parse error"));
      return;
    }

    const result = await handleJsonRpcInput(message, {
      cachePath,
      readCache,
      serverInfo,
    });

    if (result === undefined || (Array.isArray(result) && result.length === 0)) {
      response.writeHead(202);
      response.end();
      return;
    }

    respondJson(response, 200, result);
  };
}

export async function handleJsonRpcInput(input, options = {}) {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return jsonRpcError(null, JSON_RPC_ERRORS.INVALID_REQUEST, "Invalid Request");
    }

    const responses = [];

    for (const message of input) {
      const response = await handleJsonRpcMessage(message, options);

      if (response !== undefined) {
        responses.push(response);
      }
    }

    return responses.length > 0 ? responses : undefined;
  }

  return handleJsonRpcMessage(input, options);
}

export async function handleJsonRpcMessage(message, {
  cachePath,
  readCache,
  serverInfo = DEFAULT_SERVER_INFO,
} = {}) {
  if (!isPlainObject(message) || message.jsonrpc !== JSON_RPC_VERSION || typeof message.method !== "string") {
    return jsonRpcError(
      message?.id ?? null,
      JSON_RPC_ERRORS.INVALID_REQUEST,
      "Invalid Request",
    );
  }

  if (!Object.hasOwn(message, "id")) {
    return handleJsonRpcNotification(message);
  }

  switch (message.method) {
    case "initialize":
      return jsonRpcResult(message.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo,
        instructions:
          "CheongyakCok searches cached MyHome-listed public housing notices. Tool results are informational and official notice documents should be reviewed before applying.",
      });
    case "ping":
      return jsonRpcResult(message.id, {});
    case "tools/list":
      return jsonRpcResult(message.id, {
        tools: [searchNoticesToolDefinition],
      });
    case "tools/call":
      return handleToolCall(message, { cachePath, readCache });
    default:
      return jsonRpcError(
        message.id,
        JSON_RPC_ERRORS.METHOD_NOT_FOUND,
        `Method not found: ${message.method}`,
      );
  }
}

function handleJsonRpcNotification(message) {
  if (message.method === "notifications/initialized") {
    return undefined;
  }

  return undefined;
}

async function handleToolCall(message, { cachePath, readCache } = {}) {
  const params = message.params ?? {};
  const name = params.name;

  if (name !== "search_notices") {
    return jsonRpcError(
      message.id,
      JSON_RPC_ERRORS.INVALID_PARAMS,
      `Unknown tool: ${String(name)}`,
    );
  }

  try {
    const result = await handleSearchNoticesTool(params.arguments ?? {}, {
      cachePath,
      readCache,
    });

    return jsonRpcResult(message.id, {
      ...result,
      isError: false,
    });
  } catch (error) {
    return jsonRpcResult(message.id, {
      content: [
        {
          type: "text",
          text: error.message,
        },
      ],
      isError: true,
    });
  }
}

function jsonRpcResult(id, result) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result,
  };
}

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message,
    },
  };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function acceptsStreamableHttpResponse(acceptHeader = "") {
  return (
    acceptHeader.includes("application/json") &&
    acceptHeader.includes("text/event-stream")
  );
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }

  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(origin);
  }

  try {
    const { hostname } = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return false;
  }
}

function respondJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function respondText(response, status, value) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(value);
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
