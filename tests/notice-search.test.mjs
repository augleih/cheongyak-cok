import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  readNoticeCache,
  searchNotices,
} from "../scripts/lib/notice-search.mjs";

test("filters cached notices by keyword, source type, region, and category", () => {
  const result = searchNotices(sampleCache(), {
    keyword: "행복",
    noticeType: "public_rental",
    sidoName: "서울특별시",
    supplyTypeName: "행복주택",
  });

  assert.equal(result.generatedAt, "2026-06-26T00:00:00.000Z");
  assert.equal(result.total, 1);
  assert.deepEqual(
    result.notices.map((notice) => notice.id),
    ["myhome:public_rental:happy-seoul:1"],
  );
});

test("filters cached notices open on a given application date", () => {
  const result = searchNotices(sampleCache(), {
    applicationOpenOn: "2026-07-08",
  });

  assert.deepEqual(
    result.notices.map((notice) => notice.id),
    [
      "myhome:public_rental:buy-gyeongnam",
      "myhome:public_rental:happy-seoul:1",
      "myhome:public_sale:ulsan:1",
    ],
  );
});

test("applies limit after sorting by application end date", () => {
  const result = searchNotices(sampleCache(), {
    limit: 1,
  });

  assert.equal(result.total, 3);
  assert.equal(result.returned, 1);
  assert.deepEqual(
    result.notices.map((notice) => notice.id),
    ["myhome:public_rental:buy-gyeongnam"],
  );
});

test("reads notice cache JSON files before searching", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "notice-search-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");

    const cache = readNoticeCache(cachePath);
    const result = searchNotices(cache, {
      keyword: "울산",
    });

    assert.deepEqual(
      result.notices.map((notice) => notice.id),
      ["myhome:public_sale:ulsan:1"],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CLI searches notice cache files and prints JSON results", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "notice-search-"));
  const cachePath = join(tempDir, "myhome-notices.json");

  try {
    writeFileSync(cachePath, JSON.stringify(sampleCache()), "utf8");

    const result = spawnSync(
      process.execPath,
      [
        "scripts/search-notices.mjs",
        "--cachePath",
        cachePath,
        "--keyword",
        "울산",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(
      output.notices.map((notice) => notice.id),
      ["myhome:public_sale:ulsan:1"],
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function sampleCache() {
  return {
    generatedAt: "2026-06-26T00:00:00.000Z",
    notices: [
      {
        id: "myhome:public_rental:happy-seoul:1",
        noticeType: "public_rental",
        title: "서울 강남 행복주택 예비입주자 모집",
        provider: { name: "SH" },
        region: {
          sidoName: "서울특별시",
          sigunguName: "강남구",
        },
        categories: {
          houseType: { name: "아파트" },
          supplyType: { name: "행복주택" },
        },
        dates: {
          noticeDate: "2026-06-25",
          applicationStartDate: "2026-07-07",
          applicationEndDate: "2026-07-09",
        },
      },
      {
        id: "myhome:public_sale:ulsan:1",
        noticeType: "public_sale",
        title: "울산다운2 A-9 신혼희망타운 선착순 동호지정 공고",
        provider: { name: "LH" },
        region: {
          sidoName: "울산광역시",
          sigunguName: "울주군",
        },
        categories: {
          houseType: { name: "아파트" },
        },
        dates: {
          noticeDate: "2026-05-21",
          applicationStartDate: "2026-05-21",
          applicationEndDate: "2027-01-31",
        },
      },
      {
        id: "myhome:public_rental:buy-gyeongnam",
        noticeType: "public_rental",
        title: "경남 신혼 신생아 매입임대 전세형 예비입주자 모집",
        provider: { name: "LH" },
        region: {
          sidoName: "경상남도",
          sigunguName: "창원시 성산구",
        },
        categories: {
          houseType: { name: "다가구주택" },
          supplyType: { name: "매입임대" },
        },
        dates: {
          noticeDate: "2026-06-25",
          applicationStartDate: "2026-07-06",
          applicationEndDate: "2026-07-08",
        },
      },
    ],
  };
}
