import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { validateMyHomeNoticeCache } from "../scripts/lib/myhome-cache-health.mjs";

test("validates a fresh MyHome notice cache summary", () => {
  const result = validateMyHomeNoticeCache(sampleCache(), {
    now: "2026-06-26T00:00:00.000Z",
    maxAgeDays: 7,
  });

  assert.deepEqual(result, {
    ok: true,
    summary: {
      generatedAt: "2026-06-26T00:00:00.000Z",
      ageDays: 0,
      maxAgeDays: 7,
      noticeTypes: ["public_rental", "public_sale"],
      totalNotices: 1,
    },
    errors: [],
  });
});

test("reports stale and malformed cache problems without raw values", () => {
  const result = validateMyHomeNoticeCache(
    {
      generatedAt: "2026-06-01T00:00:00.000Z",
      source: {
        system: "myhome",
        contract: "data_go_kr_openapi",
      },
      noticeTypes: ["public_rental"],
      notices: [
        {
          id: "myhome:public_rental:broken:1",
          sourceNoticeGroupId: "myhome:public_rental:broken",
          noticeType: "public_rental",
          source: {
            system: "myhome",
            contract: "data_go_kr_openapi",
            operation: "rsdtRcritNtcList",
            sourceNoticeId: "broken",
          },
          title: "",
          dates: {
            noticeDate: "20260625",
          },
          rawApiResponse: "secret raw payload",
        },
      ],
    },
    {
      now: "2026-06-26T00:00:00.000Z",
      maxAgeDays: 7,
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    {
      code: "cache_stale",
      path: "generatedAt",
      message: "Cache generatedAt is older than 7 days",
    },
    {
      code: "notice_missing_required_field",
      path: "notices[0].title",
      message: "Notice is missing a required field",
    },
    {
      code: "notice_invalid_date",
      path: "notices[0].dates.noticeDate",
      message: "Notice date must use YYYY-MM-DD format",
    },
    {
      code: "notice_raw_field",
      path: "notices[0].rawApiResponse",
      message: "Notice cache must not include raw source payload fields",
    },
  ]);
  assert.equal(JSON.stringify(result).includes("secret raw payload"), false);
});

test("reports duplicate canonical notice ids", () => {
  const cache = sampleCache();
  cache.notices.push({
    ...cache.notices[0],
    title: "Same id, different row",
  });

  const result = validateMyHomeNoticeCache(cache, {
    now: "2026-06-26T00:00:00.000Z",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [
    {
      code: "cache_duplicate_notice_id",
      path: "notices[1].id",
      message: "Notice id must be unique within the cache",
    },
  ]);
});

test("CLI checks a cache file and prints a compact JSON result", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "myhome-cache-health-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");

    const result = spawnSync(
      process.execPath,
      [
        "scripts/check-myhome-cache.mjs",
        "--cachePath",
        cachePath,
        "--now",
        "2026-06-26T00:00:00.000Z",
        "--maxAgeDays",
        "7",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      ok: true,
      cachePath,
      summary: {
        generatedAt: "2026-06-26T00:00:00.000Z",
        ageDays: 0,
        maxAgeDays: 7,
        noticeTypes: ["public_rental", "public_sale"],
        totalNotices: 1,
      },
      errors: [],
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function sampleCache() {
  return {
    generatedAt: "2026-06-26T00:00:00.000Z",
    source: {
      system: "myhome",
      contract: "data_go_kr_openapi",
      endpoint: "https://apis.data.go.kr/1613000/HWSPR02",
    },
    noticeTypes: ["public_rental", "public_sale"],
    notices: [
      {
        id: "myhome:public_rental:happy-seoul:1",
        sourceNoticeGroupId: "myhome:public_rental:happy-seoul",
        noticeType: "public_rental",
        source: {
          system: "myhome",
          contract: "data_go_kr_openapi",
          operation: "rsdtRcritNtcList",
          sourceNoticeId: "happy-seoul",
          sourceUnitId: "1",
        },
        title: "Happy Housing Seoul",
        dates: {
          noticeDate: "2026-06-25",
          applicationStartDate: "2026-07-07",
          applicationEndDate: "2026-07-09",
        },
      },
    ],
  };
}
