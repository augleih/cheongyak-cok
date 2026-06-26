import { normalizeMyHomeOpenApiResponse } from "./myhome-openapi-normalizer.mjs";

export const MYHOME_OPENAPI_BASE_URL = "https://apis.data.go.kr/1613000/HWSPR02";

const NOTICE_PATHS = {
  public_rental: "/rsdtRcritNtcList",
  public_sale: "/ltRsdtRcritNtcList",
};

const ALLOWED_PARAMS = {
  public_rental: [
    "brtcCode",
    "signguCode",
    "numOfRows",
    "pageNo",
    "suplyTy",
    "lfstsTyAt",
    "bassMtRntchrgSe",
  ],
  public_sale: [
    "brtcCode",
    "signguCode",
    "numOfRows",
    "pageNo",
    "houseTy",
  ],
};

export function buildMyHomeOpenApiUrl({ noticeType, serviceKey, params = {} }) {
  const path = NOTICE_PATHS[noticeType];

  if (!path) {
    throw new Error(`Unsupported MyHome noticeType: ${noticeType}`);
  }

  if (!serviceKey) {
    throw new Error("MYHOME_SERVICE_KEY is required for MyHome OpenAPI requests");
  }

  const url = new URL(`${MYHOME_OPENAPI_BASE_URL}${path}`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("_type", "json");

  for (const paramName of ALLOWED_PARAMS[noticeType]) {
    const value = params[paramName];

    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(paramName, String(value));
    }
  }

  return url;
}

export async function fetchMyHomeOpenApiNotices({
  noticeType,
  serviceKey,
  params = {},
  fetchImpl = globalThis.fetch,
}) {
  if (!fetchImpl) {
    throw new Error("fetch is not available in this runtime");
  }

  const url = buildMyHomeOpenApiUrl({ noticeType, serviceKey, params });
  const response = await fetchImpl(url);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`MyHome OpenAPI HTTP error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  return normalizeMyHomeOpenApiResponse(data, { noticeType });
}
