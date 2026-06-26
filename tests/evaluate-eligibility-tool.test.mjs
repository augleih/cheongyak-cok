import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  evaluateEligibilityToolDefinition,
  handleEvaluateEligibilityTool,
} from "../scripts/lib/evaluate-eligibility-tool.mjs";
import { validatePlayMcpToolDefinitions } from "../scripts/lib/playmcp-tool-validator.mjs";

test("returns an unknown eligibility result with evidence from cached notice summary", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "evaluate-eligibility-tool-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");

    const result = await handleEvaluateEligibilityTool(
      {
        noticeId: "myhome:public_rental:happy-seoul:1",
        profile: {
          household: { hasNoHome: true },
          income: { monthlyAverage: 1000000 },
        },
      },
      { cachePath },
    );

    assert.deepEqual(result.content.map((item) => item.type), ["text"]);
    assert.equal(result.structuredContent.found, true);
    assert.deepEqual(result.structuredContent.profileFieldsProvided, [
      "household.hasNoHome",
      "income.monthlyAverage",
    ]);
    assert.deepEqual(result.structuredContent.notice, {
      id: "myhome:public_rental:happy-seoul:1",
      noticeType: "public_rental",
      title: "Seoul Happy Housing",
      providerName: "SH",
      applicationStartDate: "2026-07-07",
      applicationEndDate: "2026-07-09",
    });
    assert.deepEqual(result.structuredContent.eligibility, {
      status: "unknown",
      reason:
        "Based on the current inputs, eligibility cannot be determined from the cached MyHome list alone. Detailed criteria must be checked in the official notice document before applying.",
      evidence: [
        {
          sourceName: "MyHome cached notice",
          noticeId: "myhome:public_rental:happy-seoul:1",
          noticeVersion: "2026-06-26T00:00:00.000Z",
          documentUrl: "https://apply.example/happy-seoul",
          section: "notice_summary",
          excerpt: "Seoul Happy Housing",
          confidence: "medium",
          extractedAt: "2026-06-26T00:00:00.000Z",
        },
      ],
      needsConfirmation: [
        "official_notice_document",
        "household_no_home_status",
        "income_limits",
        "asset_limits",
        "supply_track_and_priority_rules",
        "duplicate_application_restrictions",
        "required_documents",
      ],
    });
    assert.equal(
      result.structuredContent.caution,
      "This is not a final eligibility decision. Review the official notice documents before applying.",
    );
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.equal(JSON.stringify(result.structuredContent).includes("secret raw payload"), false);
    assert.equal(JSON.stringify(result.structuredContent).includes("1000000"), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("returns an unknown result when the notice id is not in the cache", async () => {
  const result = await handleEvaluateEligibilityTool(
    { noticeId: "myhome:public_rental:missing" },
    { readCache: () => sampleCache() },
  );

  assert.equal(result.structuredContent.found, false);
  assert.equal(result.structuredContent.notice, null);
  assert.deepEqual(result.structuredContent.eligibility, {
    status: "unknown",
    reason:
      "No cached MyHome-listed public housing notice found for noticeId: myhome:public_rental:missing",
    evidence: [],
    needsConfirmation: ["notice_id"],
  });
});

test("rejects invalid eligibility inputs before reading the cache", async () => {
  const readCache = () => {
    throw new Error("cache should not be read for invalid input");
  };

  await assert.rejects(
    () => handleEvaluateEligibilityTool({}, { readCache }),
    /noticeId is required/,
  );
  await assert.rejects(
    () => handleEvaluateEligibilityTool({ noticeId: "   " }, { readCache }),
    /noticeId is required/,
  );
  await assert.rejects(
    () => handleEvaluateEligibilityTool({ noticeId: "x", profile: "not object" }, { readCache }),
    /profile must be an object when provided/,
  );
});

test("defines PlayMCP-compliant evaluate_eligibility metadata", () => {
  const rules = JSON.parse(readFileSync("config/playmcp-tool-rules.json", "utf8"));
  const definitions = JSON.parse(readFileSync("config/playmcp-tools.json", "utf8"));
  const validation = validatePlayMcpToolDefinitions(definitions, rules);

  assert.deepEqual(validation, { ok: true, errors: [] });
  assert.equal(evaluateEligibilityToolDefinition.name, "evaluate_eligibility");
  assert.deepEqual(evaluateEligibilityToolDefinition.inputSchema.required, ["noticeId"]);
  assert.equal(evaluateEligibilityToolDefinition.inputSchema.additionalProperties, false);
});

function sampleCache() {
  return {
    generatedAt: "2026-06-26T00:00:00.000Z",
    notices: [
      {
        id: "myhome:public_rental:happy-seoul:1",
        noticeType: "public_rental",
        title: "Seoul Happy Housing",
        provider: { name: "SH" },
        dates: {
          applicationStartDate: "2026-07-07",
          applicationEndDate: "2026-07-09",
        },
        links: {
          sourceUrl: "https://apply.example/happy-seoul",
        },
        rawApiResponse: "secret raw payload",
      },
    ],
  };
}
