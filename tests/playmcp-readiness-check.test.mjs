import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("readiness check validates tool definitions and MCP smoke flow", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check-playmcp-ready.mjs"],
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
    checks: [
      {
        name: "tool_definitions",
        ok: true,
      },
      {
        name: "mcp_smoke",
        ok: true,
      },
    ],
    toolNames: [
      "search_notices",
      "get_notice_detail",
      "evaluate_eligibility",
    ],
    smoke: {
      endpointPath: "/mcp",
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
    },
  });
  assert.equal(result.stdout.includes("secret raw payload"), false);
  assert.equal(result.stdout.includes("1000000"), false);
});

test("readiness check can include a real MyHome cache health check", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "playmcp-readiness-cache-"));
  const cachePath = join(tempDir, "myhome-notices.json");
  const cache = sampleCache();

  try {
    writeFileSync(cachePath, JSON.stringify(cache), "utf8");

    const result = spawnSync(
      process.execPath,
      ["scripts/check-playmcp-ready.mjs", "--cachePath", cachePath],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");

    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.deepEqual(output.checks, [
      {
        name: "tool_definitions",
        ok: true,
      },
      {
        name: "mcp_smoke",
        ok: true,
      },
      {
        name: "myhome_cache",
        ok: true,
      },
    ]);
    assert.deepEqual(output.cache, {
      cachePath,
      summary: {
        generatedAt: cache.generatedAt,
        ageDays: 0,
        maxAgeDays: 7,
        noticeTypes: ["public_rental", "public_sale"],
        totalNotices: 1,
      },
    });
    assert.equal(result.stdout.includes("secret raw payload"), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function sampleCache() {
  return {
    generatedAt: new Date().toISOString(),
    source: {
      system: "myhome",
      contract: "data_go_kr_openapi",
      endpoint: "https://apis.data.go.kr/1613000/HWSPR02",
    },
    noticeTypes: ["public_rental", "public_sale"],
    notices: [
      {
        id: "myhome:public_rental:readiness:1",
        sourceNoticeGroupId: "myhome:public_rental:readiness",
        noticeType: "public_rental",
        source: {
          system: "myhome",
          contract: "data_go_kr_openapi",
          operation: "rsdtRcritNtcList",
          sourceNoticeId: "readiness",
          sourceUnitId: "1",
        },
        title: "Readiness cache notice",
        dates: {
          noticeDate: "2026-06-30",
          applicationStartDate: "2026-07-01",
          applicationEndDate: "2026-07-03",
        },
      },
    ],
  };
}
