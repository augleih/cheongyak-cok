# MCP Server

CheongyakCok exposes public tools through a Streamable HTTP MCP endpoint at `/mcp`.

## Local Run

Start the server with the cached MyHome notice file:

```bash
node scripts/serve-mcp.mjs --host 127.0.0.1 --port 3100 --cachePath data/cache/myhome-notices.json
```

The process prints one JSON startup line:

```json
{"event":"mcp_server_listening","host":"127.0.0.1","port":3100,"endpoint":"http://127.0.0.1:3100/mcp","cachePath":"data/cache/myhome-notices.json"}
```

Use port `auto` or `0` to let the operating system choose an available local port. Copy the printed `endpoint` value into Inspector or PlayMCP.

## Readiness Check

Run the bundled readiness check before PlayMCP submission or manual Inspector checks:

```bash
node scripts/check-playmcp-ready.mjs
```

The readiness check validates the public tool definitions and runs the local MCP smoke flow.

To include the real MyHome cache health check in the same readiness result, pass the cache path:

```bash
node scripts/check-playmcp-ready.mjs --cachePath data/cache/myhome-notices.json
```

## Cache Health Check

After running the background MyHome sync, check the cache before pointing the MCP server at it:

```bash
node scripts/check-myhome-cache.mjs --cachePath data/cache/myhome-notices.json
```

The cache health check verifies freshness, source metadata, notice type coverage, canonical notice identity fields, duplicate notice ids, date formats, and absence of raw source payload fields. Use `--maxAgeDays 7` to adjust the freshness threshold.

## Smoke Script

Run the local smoke script before Inspector or PlayMCP checks:

```bash
node scripts/smoke-mcp-server.mjs
```

The script starts the MCP server on an ephemeral local port with a temporary normalized cache, then verifies `initialize`, `notifications/initialized`, `tools/list`, `search_notices`, `get_notice_detail`, and `evaluate_eligibility`.

## Smoke Requests

Initialize:

```bash
curl -sS http://127.0.0.1:3100/mcp \
  -H "accept: application/json, text/event-stream" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"smoke","version":"0.0.0"}}}'
```

List tools:

```bash
curl -sS http://127.0.0.1:3100/mcp \
  -H "accept: application/json, text/event-stream" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Call `search_notices`:

```bash
curl -sS http://127.0.0.1:3100/mcp \
  -H "accept: application/json, text/event-stream" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_notices","arguments":{"keyword":"공공주택","limit":3}}}'
```

Call `get_notice_detail` with an id returned by `search_notices`:

```bash
curl -sS http://127.0.0.1:3100/mcp \
  -H "accept: application/json, text/event-stream" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_notice_detail","arguments":{"id":"myhome:public_rental:example:1"}}}'
```

Call `evaluate_eligibility` with an id returned by `search_notices`:

```bash
curl -sS http://127.0.0.1:3100/mcp \
  -H "accept: application/json, text/event-stream" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"evaluate_eligibility","arguments":{"noticeId":"myhome:public_rental:example:1","profile":{"household":{"hasNoHome":true}}}}}'
```

## Runtime Boundaries

- The public MCP tool reads only the normalized cache.
- The public MCP tool does not call the live MyHome OpenAPI.
- The public MCP tool does not crawl sites, parse documents, run LLM extraction, or bulk reindex.
- Local development binds to `127.0.0.1` by default.
- Requests with a non-local `Origin` header are rejected unless the server is created with an explicit `allowedOrigins` list.
