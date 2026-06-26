import { readFileSync } from "node:fs";

import { readNoticeCache } from "./notice-search.mjs";

const DEFAULT_CACHE_PATH = "data/cache/myhome-notices.json";
const TOOL_DEFINITIONS_URL = new URL("../../config/playmcp-tools.json", import.meta.url);

export const getNoticeDetailToolDefinition = readGetNoticeDetailToolDefinition();

export async function handleGetNoticeDetailTool(
  input = {},
  {
    cachePath = DEFAULT_CACHE_PATH,
    readCache = readNoticeCache,
  } = {},
) {
  const { id } = normalizeGetNoticeDetailInput(input);
  const cache = await readCache(cachePath);
  const notice = findNoticeById(cache, id);
  const structuredContent = formatGetNoticeDetailResult(cache, id, notice);

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

export function normalizeGetNoticeDetailInput(input = {}) {
  if (!isPlainObject(input)) {
    throw new Error("get_notice_detail input must be an object");
  }

  const id = String(input.id ?? "").trim();

  if (!id) {
    throw new Error("id is required");
  }

  return { id };
}

function findNoticeById(cache, id) {
  const notices = Array.isArray(cache?.notices) ? cache.notices : [];
  return notices.find((notice) => notice?.id === id);
}

function formatGetNoticeDetailResult(cache, id, notice) {
  const base = {
    source: {
      system: "myhome",
      description: "MyHome-listed public housing notices cached by CheongyakCok.",
    },
    caution:
      "Details are based on cached MyHome-listed public housing notices. Review the official notice documents before applying.",
    generatedAt: cache?.generatedAt,
  };

  if (!notice) {
    return {
      ...base,
      found: false,
      notice: null,
      message: `No cached MyHome-listed public housing notice found for id: ${id}`,
    };
  }

  return {
    ...base,
    found: true,
    notice: compactNoticeDetail(notice),
  };
}

function compactNoticeDetail(notice) {
  return compactObject({
    id: notice.id,
    sourceNoticeGroupId: notice.sourceNoticeGroupId,
    noticeType: notice.noticeType,
    title: notice.title,
    providerName: notice.provider?.name,
    region: compactObject({
      sidoName: notice.region?.sidoName,
      sigunguName: notice.region?.sigunguName,
      address: notice.region?.address,
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
    complexityLevel: notice.complexityLevel,
    extractionStatus: notice.extractionStatus,
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

function readGetNoticeDetailToolDefinition() {
  const definition = JSON.parse(readFileSync(TOOL_DEFINITIONS_URL, "utf8"));
  const tool = definition.tools?.find(({ name }) => name === "get_notice_detail");

  if (!tool) {
    throw new Error("get_notice_detail tool definition is missing");
  }

  return tool;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
