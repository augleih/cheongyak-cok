import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  handleSearchNoticesTool,
  searchNoticesToolDefinition,
} from "../scripts/lib/search-notices-tool.mjs";
import { validatePlayMcpToolDefinitions } from "../scripts/lib/playmcp-tool-validator.mjs";

test("returns compact MCP content from cached notice search results", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "search-notices-tool-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");

    const result = await handleSearchNoticesTool(
      {
        keyword: "happy",
        noticeType: "public_rental",
        sidoName: "Seoul",
        sigunguName: "Gangnam",
        houseTypeName: "Apartment",
        supplyTypeName: "Public rental",
        applicationOpenOn: "2026-07-08",
        limit: 5,
        ignoredInput: "not part of the public schema",
      },
      { cachePath },
    );

    assert.deepEqual(result.content.map((item) => item.type), ["text"]);
    assert.equal(
      result.structuredContent.caution,
      "Results are based on cached MyHome-listed public housing notices. Review the official notice documents before applying.",
    );
    assert.equal(result.structuredContent.generatedAt, "2026-06-26T00:00:00.000Z");
    assert.equal(result.structuredContent.total, 1);
    assert.equal(result.structuredContent.returned, 1);
    assert.deepEqual(result.structuredContent.source, {
      system: "myhome",
      description: "MyHome-listed public housing notices cached by CheongyakCok.",
    });
    assert.deepEqual(result.structuredContent.notices, [
      {
        id: "myhome:public_rental:happy-seoul:1",
        sourceNoticeGroupId: "myhome:public_rental:happy-seoul",
        noticeType: "public_rental",
        title: "Seoul Happy Housing",
        providerName: "SH",
        region: {
          sidoName: "Seoul",
          sigunguName: "Gangnam",
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
      },
    ]);

    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
    assert.equal(JSON.stringify(result.structuredContent).includes("secret raw payload"), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reads the default notice cache path and normalizes supported filters", async () => {
  const readPaths = [];

  const result = await handleSearchNoticesTool(
    {
      applicationOpenOn: "2026-07-08",
      limit: "1",
    },
    {
      readCache: (path) => {
        readPaths.push(path);
        return sampleCache();
      },
    },
  );

  assert.deepEqual(readPaths, ["data/cache/myhome-notices.json"]);
  assert.equal(result.structuredContent.total, 2);
  assert.equal(result.structuredContent.returned, 1);
  assert.deepEqual(
    result.structuredContent.notices.map((notice) => notice.id),
    ["myhome:public_rental:other-seoul:1"],
  );
});

test("rejects invalid public inputs before reading the cache", async () => {
  const readCache = () => {
    throw new Error("cache should not be read for invalid input");
  };

  await assert.rejects(
    () => handleSearchNoticesTool({ noticeType: "private_sale" }, { readCache }),
    /noticeType must be public_rental or public_sale/,
  );
  await assert.rejects(
    () => handleSearchNoticesTool({ applicationOpenOn: "20260708" }, { readCache }),
    /applicationOpenOn must use YYYY-MM-DD/,
  );
  await assert.rejects(
    () => handleSearchNoticesTool({ limit: 21 }, { readCache }),
    /limit must be an integer from 1 to 20/,
  );
});

test("defines PlayMCP-compliant search_notices metadata", () => {
  const rules = JSON.parse(readFileSync("config/playmcp-tool-rules.json", "utf8"));
  const validation = validatePlayMcpToolDefinitions(
    {
      serverName: "cheongyak-cok",
      tools: [searchNoticesToolDefinition],
    },
    rules,
  );

  assert.deepEqual(validation, { ok: true, errors: [] });
  assert.equal(searchNoticesToolDefinition.name, "search_notices");
  assert.equal(searchNoticesToolDefinition.inputSchema.additionalProperties, false);
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
        rawApiResponse: "secret raw payload",
      },
      {
        id: "myhome:public_rental:other-seoul:1",
        noticeType: "public_rental",
        title: "Other Seoul Housing",
        dates: {
          noticeDate: "2026-06-24",
          applicationStartDate: "2026-07-06",
          applicationEndDate: "2026-07-08",
        },
      },
      {
        id: "myhome:public_sale:old-busan:1",
        noticeType: "public_sale",
        title: "Old Busan Sale",
        dates: {
          noticeDate: "2026-05-01",
          applicationStartDate: "2026-06-01",
          applicationEndDate: "2026-06-02",
        },
      },
    ],
  };
}
