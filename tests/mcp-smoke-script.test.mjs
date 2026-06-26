import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("CLI smoke script verifies MCP discovery and tool calls", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/smoke-mcp-server.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");

  const output = JSON.parse(result.stdout);
  assert.deepEqual(output, {
    ok: true,
    endpointPath: "/mcp",
    toolNames: [
      "search_notices",
      "get_notice_detail",
      "evaluate_eligibility",
    ],
    calls: {
      search_notices: {
        returned: 1,
        firstNoticeId: "myhome:public_rental:smoke-happy:1",
      },
      get_notice_detail: {
        found: true,
        noticeId: "myhome:public_rental:smoke-happy:1",
      },
      evaluate_eligibility: {
        found: true,
        status: "unknown",
        needsConfirmationCount: 7,
      },
    },
  });
  assert.equal(result.stdout.includes("secret raw payload"), false);
  assert.equal(result.stdout.includes("1000000"), false);
});
