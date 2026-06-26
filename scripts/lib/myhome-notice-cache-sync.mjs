import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  MYHOME_OPENAPI_BASE_URL,
  buildMyHomeOpenApiUrl,
} from "./myhome-openapi-client.mjs";
import { normalizeMyHomeOpenApiResponse } from "./myhome-openapi-normalizer.mjs";

const DEFAULT_NOTICE_TYPES = ["public_rental", "public_sale"];

export async function syncMyHomeNoticeCache({
  outputDir = "data",
  runId,
  generatedAt = new Date().toISOString(),
  serviceKey,
  pageSize = 100,
  noticeTypes = DEFAULT_NOTICE_TYPES,
  maxPages,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!serviceKey) {
    throw new Error("MYHOME_SERVICE_KEY is required for MyHome notice cache sync");
  }

  if (!fetchImpl) {
    throw new Error("fetch is not available in this runtime");
  }

  const resolvedRunId = runId ?? generatedAt.replace(/[:.]/g, "-");
  const rawDir = join(outputDir, "raw", "myhome", resolvedRunId);
  const cacheDir = join(outputDir, "cache");
  const notices = [];
  let rawSnapshotCount = 0;

  mkdirSync(rawDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  for (const noticeType of noticeTypes) {
    for (let pageNo = 1; ; pageNo += 1) {
      const response = await fetchMyHomePage({
        noticeType,
        serviceKey,
        pageNo,
        pageSize,
        fetchImpl,
      });

      const rawPath = join(rawDir, `${noticeType}-page-${pageNo}.json`);
      writeJson(rawPath, response);
      rawSnapshotCount += 1;

      notices.push(
        ...normalizeMyHomeOpenApiResponse(response, {
          noticeType,
        }),
      );

      if (isLastPage(response, pageNo, pageSize, maxPages)) {
        break;
      }
    }
  }

  const cache = {
    generatedAt,
    runId: resolvedRunId,
    source: {
      system: "myhome",
      contract: "data_go_kr_openapi",
      endpoint: MYHOME_OPENAPI_BASE_URL,
    },
    noticeTypes,
    notices,
  };

  writeJson(join(cacheDir, "myhome-notices.json"), cache);

  return {
    generatedAt,
    runId: resolvedRunId,
    noticeTypes,
    rawSnapshotCount,
    totalNotices: notices.length,
    cachePath: join(cacheDir, "myhome-notices.json"),
    rawDir,
  };
}

async function fetchMyHomePage({
  noticeType,
  serviceKey,
  pageNo,
  pageSize,
  fetchImpl,
}) {
  const url = buildMyHomeOpenApiUrl({
    noticeType,
    serviceKey,
    params: {
      pageNo,
      numOfRows: pageSize,
    },
  });
  const response = await fetchImpl(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MyHome OpenAPI HTTP error ${response.status}: ${body.slice(0, 200)}`);
  }

  return response.json();
}

function isLastPage(response, pageNo, pageSize, maxPages) {
  if (response?.response?.header?.resultCode === "03") {
    return true;
  }

  if (typeof maxPages === "number" && pageNo >= maxPages) {
    return true;
  }

  const body = response?.response?.body ?? {};
  const totalCount = numberValue(body.totalCount);
  const responsePageSize = numberValue(body.numOfRows) ?? pageSize;
  const responsePageNo = numberValue(body.pageNo) ?? pageNo;

  if (typeof totalCount !== "number") {
    return true;
  }

  return responsePageNo * responsePageSize >= totalCount;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
