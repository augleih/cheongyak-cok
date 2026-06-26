import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  buildMyHomeOpenApiUrl,
  fetchMyHomeOpenApiNotices,
} from "../scripts/lib/myhome-openapi-client.mjs";

test("builds official public rental OpenAPI URLs with allowed request parameters", () => {
  const url = buildMyHomeOpenApiUrl({
    noticeType: "public_rental",
    serviceKey: "test-service-key",
    params: {
      pageNo: 2,
      numOfRows: 50,
      brtcCode: "43",
      signguCode: "750",
      suplyTy: "08",
      lfstsTyAt: "N",
      bassMtRntchrgSe: "01",
      unknown: "ignored",
    },
  });

  assert.equal(
    `${url.origin}${url.pathname}`,
    "https://apis.data.go.kr/1613000/HWSPR02/rsdtRcritNtcList",
  );
  assert.equal(url.searchParams.get("serviceKey"), "test-service-key");
  assert.equal(url.searchParams.get("_type"), "json");
  assert.equal(url.searchParams.get("pageNo"), "2");
  assert.equal(url.searchParams.get("numOfRows"), "50");
  assert.equal(url.searchParams.get("brtcCode"), "43");
  assert.equal(url.searchParams.get("signguCode"), "750");
  assert.equal(url.searchParams.get("suplyTy"), "08");
  assert.equal(url.searchParams.get("lfstsTyAt"), "N");
  assert.equal(url.searchParams.get("bassMtRntchrgSe"), "01");
  assert.equal(url.searchParams.get("unknown"), null);
});

test("builds official public sale OpenAPI URLs with sale-only filters", () => {
  const url = buildMyHomeOpenApiUrl({
    noticeType: "public_sale",
    serviceKey: "test-service-key",
    params: {
      pageNo: 1,
      numOfRows: 10,
      brtcCode: "43",
      signguCode: "750",
      houseTy: "11",
      suplyTy: "08",
    },
  });

  assert.equal(
    `${url.origin}${url.pathname}`,
    "https://apis.data.go.kr/1613000/HWSPR02/ltRsdtRcritNtcList",
  );
  assert.equal(url.searchParams.get("houseTy"), "11");
  assert.equal(url.searchParams.get("suplyTy"), null);
});

test("fetches official OpenAPI JSON and returns canonical notices", async () => {
  const response = readFixture("public-rental-openapi-response.json");
  let requestedUrl;

  const notices = await fetchMyHomeOpenApiNotices({
    noticeType: "public_rental",
    serviceKey: "test-service-key",
    params: { pageNo: 1, numOfRows: 10 },
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        async json() {
          return response;
        },
        async text() {
          return JSON.stringify(response);
        },
      };
    },
  });

  assert.match(String(requestedUrl), /rsdtRcritNtcList/);
  assert.equal(notices[0].id, "myhome:public_rental:20622");
});

function readFixture(fileName) {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/myhome/${fileName}`, import.meta.url), "utf8"),
  );
}
