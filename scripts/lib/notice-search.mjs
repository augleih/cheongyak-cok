import { readFileSync } from "node:fs";

const DEFAULT_LIMIT = 10;

export function readNoticeCache(path = "data/cache/myhome-notices.json") {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function searchNotices(cache, filters = {}) {
  const notices = Array.isArray(cache?.notices) ? cache.notices : [];
  const matched = notices
    .filter((notice) => matchesFilters(notice, filters))
    .sort(compareByApplicationEndDate);
  const limit = normalizeLimit(filters.limit);
  const limited = matched.slice(0, limit);

  return {
    generatedAt: cache?.generatedAt,
    total: matched.length,
    returned: limited.length,
    notices: limited,
  };
}

function matchesFilters(notice, filters) {
  return (
    matchesKeyword(notice, filters.keyword) &&
    matchesExact(notice?.noticeType, filters.noticeType) &&
    matchesText(notice?.region?.sidoName, filters.sidoName) &&
    matchesText(notice?.region?.sigunguName, filters.sigunguName) &&
    matchesText(notice?.categories?.houseType?.name, filters.houseTypeName) &&
    matchesText(notice?.categories?.supplyType?.name, filters.supplyTypeName) &&
    matchesOpenDate(notice, filters.applicationOpenOn)
  );
}

function matchesKeyword(notice, keyword) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return true;
  }

  return searchText(notice).includes(normalizedKeyword);
}

function searchText(notice) {
  return normalizeText(
    [
      notice?.title,
      notice?.provider?.name,
      notice?.region?.sidoName,
      notice?.region?.sigunguName,
      notice?.categories?.houseType?.name,
      notice?.categories?.supplyType?.name,
      notice?.status?.sourceLabel,
    ].filter(Boolean).join(" "),
  );
}

function matchesExact(value, expected) {
  if (!expected) {
    return true;
  }

  return value === expected;
}

function matchesText(value, expected) {
  const normalizedExpected = normalizeText(expected);

  if (!normalizedExpected) {
    return true;
  }

  return normalizeText(value).includes(normalizedExpected);
}

function matchesOpenDate(notice, applicationOpenOn) {
  if (!applicationOpenOn) {
    return true;
  }

  const startDate = notice?.dates?.applicationStartDate;
  const endDate = notice?.dates?.applicationEndDate;

  if (!startDate || !endDate) {
    return false;
  }

  return startDate <= applicationOpenOn && applicationOpenOn <= endDate;
}

function compareByApplicationEndDate(left, right) {
  const leftEnd = left?.dates?.applicationEndDate ?? "9999-12-31";
  const rightEnd = right?.dates?.applicationEndDate ?? "9999-12-31";

  if (leftEnd !== rightEnd) {
    return leftEnd.localeCompare(rightEnd);
  }

  const leftNoticeDate = left?.dates?.noticeDate ?? "";
  const rightNoticeDate = right?.dates?.noticeDate ?? "";
  return rightNoticeDate.localeCompare(leftNoticeDate);
}

function normalizeText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ko-KR");
}

function normalizeLimit(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.floor(parsed);
}
