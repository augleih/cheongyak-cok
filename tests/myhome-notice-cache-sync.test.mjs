import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { syncMyHomeNoticeCache } from "../scripts/lib/myhome-notice-cache-sync.mjs";

test("writes raw MyHome OpenAPI snapshots and canonical notice cache", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "myhome-cache-sync-"));
  const requestedUrls = [];

  try {
    const result = await syncMyHomeNoticeCache({
      outputDir,
      runId: "test-run",
      generatedAt: "2026-06-26T00:00:00.000Z",
      serviceKey: "test-service-key",
      pageSize: 1,
      noticeTypes: ["public_rental", "public_sale"],
      fetchImpl: async (url) => {
        requestedUrls.push(String(url));
        return okJsonResponse(
          String(url).includes("rsdtRcritNtcList")
            ? readFixture("public-rental-openapi-response.json")
            : readFixture("public-sale-openapi-response.json"),
        );
      },
    });

    assert.equal(result.totalNotices, 2);
    assert.deepEqual(result.noticeTypes, ["public_rental", "public_sale"]);
    assert.equal(result.rawSnapshotCount, 2);

    assert.equal(requestedUrls.length, 2);
    assert.match(requestedUrls[0], /rsdtRcritNtcList/);
    assert.match(requestedUrls[1], /ltRsdtRcritNtcList/);

    const rentalRawPath = join(
      outputDir,
      "raw",
      "myhome",
      "test-run",
      "public_rental-page-1.json",
    );
    const saleRawPath = join(
      outputDir,
      "raw",
      "myhome",
      "test-run",
      "public_sale-page-1.json",
    );
    const cachePath = join(outputDir, "cache", "myhome-notices.json");

    assert.equal(existsSync(rentalRawPath), true);
    assert.equal(existsSync(saleRawPath), true);
    assert.equal(existsSync(cachePath), true);

    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    assert.equal(cache.generatedAt, "2026-06-26T00:00:00.000Z");
    assert.deepEqual(
      cache.notices.map((notice) => notice.id),
      ["myhome:public_rental:20622", "myhome:public_sale:1423"],
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("paginates until the OpenAPI total count is collected", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "myhome-cache-sync-"));
  const requestedPageNumbers = [];

  try {
    const result = await syncMyHomeNoticeCache({
      outputDir,
      runId: "paged-run",
      generatedAt: "2026-06-26T00:00:00.000Z",
      serviceKey: "test-service-key",
      pageSize: 1,
      noticeTypes: ["public_rental"],
      fetchImpl: async (url) => {
        const pageNo = Number(url.searchParams.get("pageNo"));
        requestedPageNumbers.push(pageNo);
        return okJsonResponse({
          response: {
            header: {
              resultCode: "00",
              resultMsg: "NORMAL SERVICE",
            },
            body: {
              totalCount: "2",
              numOfRows: "1",
              pageNo: String(pageNo),
              item: [
                {
                  pblancId: "9000",
                  houseSn: pageNo,
                  pblancNm: `paged notice ${pageNo}`,
                },
              ],
            },
          },
        });
      },
    });

    assert.deepEqual(requestedPageNumbers, [1, 2]);
    assert.equal(result.totalNotices, 2);

    const cache = JSON.parse(
      readFileSync(join(outputDir, "cache", "myhome-notices.json"), "utf8"),
    );
    assert.deepEqual(
      cache.notices.map((notice) => notice.id),
      ["myhome:public_rental:9000:1", "myhome:public_rental:9000:2"],
    );
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

function okJsonResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function readFixture(fileName) {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/myhome/${fileName}`, import.meta.url), "utf8"),
  );
}
