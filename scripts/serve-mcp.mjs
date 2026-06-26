#!/usr/bin/env node

import { createMcpHttpServer } from "./lib/mcp-http-server.mjs";

const args = parseArgs(process.argv.slice(2));
const host = args.host ?? process.env.HOST ?? "127.0.0.1";
const port = parsePort(args.port ?? process.env.PORT ?? "3000");
const cachePath = args.cachePath;
const server = createMcpHttpServer({ cachePath });

server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});

server.listen(port, host, () => {
  const address = server.address();
  const resolvedPort = typeof address === "object" && address ? address.port : port;

  console.log(JSON.stringify({
    event: "mcp_server_listening",
    host,
    port: resolvedPort,
    endpoint: `http://${formatHostForUrl(host)}:${resolvedPort}/mcp`,
    cachePath: cachePath ?? "data/cache/myhome-notices.json",
  }));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      continue;
    }

    parsed[key] = value;
    index += 1;
  }

  return parsed;
}

function parsePort(value) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error("--port must be an integer from 0 to 65535");
  }

  return parsed;
}

function formatHostForUrl(value) {
  return value.includes(":") && !value.startsWith("[") ? `[${value}]` : value;
}
