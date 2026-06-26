import { readFileSync } from "node:fs";

import { readNoticeCache, searchNotices } from "./notice-search.mjs";

const DEFAULT_CACHE_PATH = "data/cache/myhome-notices.json";
const MAX_LIMIT = 20;
const NOTICE_TYPES = new Set(["public_rental", "public_sale"]);
const STRING_FILTER_KEYS = [
  "keyword",
  "sidoName",
  "sigunguName",
  "houseTypeName",
  "supplyTypeName",
];
const TOOL_DEFINITIONS_URL = new URL("../../config/playmcp-tools.json", import.meta.url);

export const searchNoticesToolDefinition = readSearchNoticesToolDefinition();

export async function handleSearchNoticesTool(
  input = {},
  {
    cachePath = DEFAULT_CACHE_PATH,
    readCache = readNoticeCache,
  } = {},
) {
  const filters = normalizeSearchNoticesInput(input);
  const cache = await readCache(cachePath);
  const result = searchNotices(cache, filters);
  const structuredContent = formatSearchNoticesResult(result);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
}

export function normalizeSearchNoticesInput(input = {}) {
  if (!isPlainObject(input)) {
    throw new Error("search_notices input must be an object");
  }

  const filters = {};

  for (const key of STRING_FILTER_KEYS) {
    const value = normalizeOptionalString(input[key]);

    if (value) {
      filters[key] = value;
    }
  }

  const noticeType = normalizeOptionalString(input.noticeType);

  if (noticeType) {
    if (!NOTICE_TYPES.has(noticeType)) {
      throw new Error("noticeType must be public_rental or public_sale");
    }

    filters.noticeType = noticeType;
  }

  const applicationOpenOn = normalizeOptionalString(input.applicationOpenOn);

  if (applicationOpenOn) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applicationOpenOn)) {
      throw new Error("applicationOpenOn must use YYYY-MM-DD");
    }

    filters.applicationOpenOn = applicationOpenOn;
  }

  if (input.limit !== undefined) {
    filters.limit = normalizeLimit(input.limit);
  }

  return filters;
}

function formatSearchNoticesResult(result) {
  return {
    source: {
      system: "myhome",
      description: "MyHome-listed public housing notices cached by CheongyakCok.",
    },
    caution:
      "Results are based on cached MyHome-listed public housing notices. Review the official notice documents before applying.",
    generatedAt: result.generatedAt,
    total: result.total,
    returned: result.returned,
    notices: result.notices.map(compactNotice),
  };
}

function compactNotice(notice) {
  return compactObject({
    id: notice.id,
    sourceNoticeGroupId: notice.sourceNoticeGroupId,
    noticeType: notice.noticeType,
    title: notice.title,
    providerName: notice.provider?.name,
    region: compactObject({
      sidoName: notice.region?.sidoName,
      sigunguName: notice.region?.sigunguName,
    }),
    categories: compactObject({
      houseTypeName: notice.categories?.houseType?.name,
      supplyTypeName: notice.categories?.supplyType?.name,
    }),
    dates: compactObject({
      noticeDate: notice.dates?.noticeDate,
      applicationStartDate: notice.dates?.applicationStartDate,
      applicationEndDate: notice.dates?.applicationEndDate,
      winnerAnnouncementDate: notice.dates?.winnerAnnouncementDate,
    }),
    links: compactObject({
      sourceUrl: notice.links?.sourceUrl,
      pcUrl: notice.links?.pcUrl,
    }),
  });
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => !isEmptyField(field)),
  );
}

function isEmptyField(value) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  );
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > MAX_LIMIT
  ) {
    throw new Error("limit must be an integer from 1 to 20");
  }

  return parsed;
}

function readSearchNoticesToolDefinition() {
  const definition = JSON.parse(readFileSync(TOOL_DEFINITIONS_URL, "utf8"));
  const tool = definition.tools?.find(({ name }) => name === "search_notices");

  if (!tool) {
    throw new Error("search_notices tool definition is missing");
  }

  return tool;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
