import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { normalizeMyHomeOpenApiResponse } from "../scripts/lib/myhome-openapi-normalizer.mjs";

test("normalizes public rental OpenAPI notices into canonical notices", () => {
  const response = readFixture("public-rental-openapi-response.json");

  const notices = normalizeMyHomeOpenApiResponse(response, {
    noticeType: "public_rental",
  });

  assert.equal(notices.length, 1);
  assert.deepEqual(notices[0], {
    id: "myhome:public_rental:20622",
    sourceNoticeGroupId: "myhome:public_rental:20622",
    noticeType: "public_rental",
    source: {
      system: "myhome",
      contract: "data_go_kr_openapi",
      endpoint: "HWSPR02",
      operation: "rsdtRcritNtcList",
      sourceNoticeId: "20622",
    },
    title: "[경남지역본부]26년 2차 신혼·신생아매입임대Ⅱ(전세형) 예비입주자 모집공고",
    provider: {
      name: "한국토지주택공사",
    },
    region: {
      sidoCode: "48",
      sidoName: "경상남도",
      sigunguCode: "170",
      sigunguName: "창원시",
    },
    categories: {
      houseType: {
        code: "16",
        name: "다가구주택",
      },
      supplyType: {
        code: "08",
        name: "전세임대",
      },
      leaseType: {
        isJeonseType: true,
      },
      monthlyRent: {
        code: "01",
        name: "5만원 미만",
      },
    },
    dates: {
      noticeDate: "2026-06-25",
      winnerAnnouncementDate: "2026-10-08",
    },
    status: {
      sourceLabel: "모집중",
    },
    links: {
      sourceUrl: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do",
    },
    attachments: [
      {
        fileId: "19efd6bdb3257",
        fileName: "입주자모집공고문.pdf",
      },
    ],
  });
});

test("normalizes public sale OpenAPI notices with a distinct source operation", () => {
  const response = readFixture("public-sale-openapi-response.json");

  const notices = normalizeMyHomeOpenApiResponse(response, {
    noticeType: "public_sale",
  });

  assert.equal(notices[0].id, "myhome:public_sale:1423");
  assert.equal(notices[0].source.operation, "ltRsdtRcritNtcList");
  assert.equal(notices[0].categories.houseType.code, "11");
  assert.equal(notices[0].categories.supplyType, undefined);
});

test("normalizes actual data.go.kr body.item responses", () => {
  const response = readFixture("public-rental-openapi-body-item-response.json");

  const notices = normalizeMyHomeOpenApiResponse(response, {
    noticeType: "public_rental",
  });

  assert.equal(notices.length, 1);
  assert.equal(notices[0].id, "myhome:public_rental:20623:1");
  assert.equal(notices[0].sourceNoticeGroupId, "myhome:public_rental:20623");
  assert.equal(notices[0].source.sourceUnitId, "1");
  assert.equal(notices[0].title, "세종서창, 해밀행복주택 예비입주자 모집공고문(2026.06.25)");
  assert.deepEqual(notices[0].region, {
    sidoName: "세종특별자치시",
  });
  assert.deepEqual(notices[0].categories.houseType, {
    name: "아파트",
  });
  assert.deepEqual(notices[0].categories.supplyType, {
    name: "행복주택",
  });
  assert.deepEqual(notices[0].dates, {
    noticeDate: "2026-06-25",
    winnerAnnouncementDate: "2026-10-12",
    applicationStartDate: "2026-07-07",
    applicationEndDate: "2026-07-09",
  });
  assert.equal(
    notices[0].links.pcUrl,
    "https://www.myhome.go.kr/hws/portal/sch/selectRsdtRcritNtcDetailView.do?pblancId=20623&houseSn=1",
  );
});

test("adds stable row suffixes when MyHome repeats pblancId and houseSn", () => {
  const notices = normalizeMyHomeOpenApiResponse(
    {
      response: {
        header: {
          resultCode: "00",
          resultMsg: "NORMAL SERVICE",
        },
        body: {
          item: [
            {
              pblancId: "20646",
              houseSn: 0,
              pblancNm: "Duplicate houseSn notice",
              brtcNm: "Incheon",
              signguNm: "Michuhol",
              sumSuplyCo: 4,
            },
            {
              pblancId: "20646",
              houseSn: 0,
              pblancNm: "Duplicate houseSn notice",
              brtcNm: "Incheon",
              signguNm: "Gyeyang",
              sumSuplyCo: 3,
            },
          ],
        },
      },
    },
    {
      noticeType: "public_rental",
    },
  );

  assert.equal(notices.length, 2);
  assert.equal(new Set(notices.map((notice) => notice.id)).size, 2);
  assert.match(notices[0].id, /^myhome:public_rental:20646:0:row-[a-f0-9]{12}$/);
  assert.match(notices[1].id, /^myhome:public_rental:20646:0:row-[a-f0-9]{12}$/);
  assert.equal(notices[0].source.sourceRowHash.length, 12);
  assert.equal(notices[1].source.sourceRowHash.length, 12);
});

test("treats data.go.kr NODATA_ERROR as an empty result set", () => {
  const notices = normalizeMyHomeOpenApiResponse(
    {
      response: {
        header: {
          resultCode: "03",
          resultMsg: "NODATA_ERROR",
        },
        body: {},
      },
    },
    {
      noticeType: "public_rental",
    },
  );

  assert.deepEqual(notices, []);
});

function readFixture(fileName) {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/myhome/${fileName}`, import.meta.url), "utf8"),
  );
}
