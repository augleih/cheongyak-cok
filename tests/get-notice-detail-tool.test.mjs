import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  getNoticeDetailToolDefinition,
  handleGetNoticeDetailTool,
} from "../scripts/lib/get-notice-detail-tool.mjs";
import { validatePlayMcpToolDefinitions } from "../scripts/lib/playmcp-tool-validator.mjs";

test("returns compact cached notice detail by canonical id", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "get-notice-detail-tool-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");

    const result = await handleGetNoticeDetailTool(
      { id: "myhome:public_rental:happy-seoul:1" },
      { cachePath },
    );

    assert.deepEqual(result.content.map((item) => item.type), ["text"]);
    assert.equal(result.structuredContent.found, true);
    assert.equal(result.structuredContent.generatedAt, "2026-06-26T00:00:00.000Z");
    assert.equal(
      result.structuredContent.caution,
      "Details are based on cached MyHome-listed public housing notices. Review the official notice documents before applying.",
    );
    assert.deepEqual(result.structuredContent.source, {
      system: "myhome",
      description: "MyHome-listed public housing notices cached by CheongyakCok.",
    });
    assert.deepEqual(result.structuredContent.notice, {
      id: "myhome:public_rental:happy-seoul:1",
      sourceNoticeGroupId: "myhome:public_rental:happy-seoul",
      noticeType: "public_rental",
      title: "Seoul Happy Housing",
      providerName: "SH",
      region: {
        sidoName: "Seoul",
        sigunguName: "Gangnam",
        address: "Seoul Gangnam 1",
      },
      categories: {
        houseTypeName: "Apartment",
        supplyTypeName: "Public rental",
      },
      dates: {
        noticeDate: "2026-06-25",
        applicationStartDate: "2026-07-07",
        applicationEndDate: "2026-07-09",
        winnerAnnouncementDate: "2026-10-12",
      },
      links: {
        sourceUrl: "https://apply.example/happy-seoul",
        pcUrl: "https://myhome.example/happy-seoul",
      },
      complexityLevel: "simple_list_only",
      extractionStatus: {
        status: "openapi_only",
        requiresDocumentParsing: false,
        requiresHumanReview: false,
      },
    });

    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.equal(JSON.stringify(result.structuredContent).includes("secret raw payload"), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("returns a cautious not-found detail result without throwing", async () => {
  const result = await handleGetNoticeDetailTool(
    { id: "myhome:public_rental:missing" },
    {
      readCache: () => sampleCache(),
    },
  );

  assert.equal(result.structuredContent.found, false);
  assert.equal(result.structuredContent.notice, null);
  assert.equal(
    result.structuredContent.message,
    "No cached MyHome-listed public housing notice found for id: myhome:public_rental:missing",
  );
});

test("rejects invalid detail inputs before reading the cache", async () => {
  const readCache = () => {
    throw new Error("cache should not be read for invalid input");
  };

  await assert.rejects(
    () => handleGetNoticeDetailTool({}, { readCache }),
    /id is required/,
  );
  await assert.rejects(
    () => handleGetNoticeDetailTool({ id: "   " }, { readCache }),
    /id is required/,
  );
});

test("defines PlayMCP-compliant get_notice_detail metadata", () => {
  const rules = JSON.parse(readFileSync("config/playmcp-tool-rules.json", "utf8"));
  const definitions = JSON.parse(readFileSync("config/playmcp-tools.json", "utf8"));
  const validation = validatePlayMcpToolDefinitions(definitions, rules);

  assert.deepEqual(validation, { ok: true, errors: [] });
  assert.equal(getNoticeDetailToolDefinition.name, "get_notice_detail");
  assert.deepEqual(getNoticeDetailToolDefinition.inputSchema.required, ["id"]);
  assert.equal(getNoticeDetailToolDefinition.inputSchema.additionalProperties, false);
});

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
          address: "Seoul Gangnam 1",
        },
        categories: {
          houseType: { name: "Apartment" },
          supplyType: { name: "Public rental" },
        },
        dates: {
          noticeDate: "2026-06-25",
          applicationStartDate: "2026-07-07",
          applicationEndDate: "2026-07-09",
          winnerAnnouncementDate: "2026-10-12",
        },
        links: {
          sourceUrl: "https://apply.example/happy-seoul",
          pcUrl: "https://myhome.example/happy-seoul",
        },
        complexityLevel: "simple_list_only",
        extractionStatus: {
          status: "openapi_only",
          requiresDocumentParsing: false,
          requiresHumanReview: false,
        },
        rawApiResponse: "secret raw payload",
      },
      {
        id: "myhome:public_sale:busan:1",
        noticeType: "public_sale",
        title: "Busan Sale",
      },
    ],
  };
}
