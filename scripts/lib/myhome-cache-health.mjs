const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_DAYS = 7;
const SUPPORTED_NOTICE_TYPES = new Set(["public_rental", "public_sale"]);
const RAW_NOTICE_FIELDS = [
  "raw",
  "rawApiResponse",
  "rawParsingOutput",
  "rawResponse",
  "rawSourcePayload",
];

export const DEFAULT_MYHOME_CACHE_PATH = "data/cache/myhome-notices.json";

export function validateMyHomeNoticeCache(cache, options = {}) {
  const maxAgeDays = normalizeMaxAgeDays(options.maxAgeDays);
  const now = normalizeDateTime(options.now) ?? new Date();
  const errors = [];
  const summary = {
    generatedAt: stringValue(cache?.generatedAt),
    ageDays: undefined,
    maxAgeDays,
    noticeTypes: Array.isArray(cache?.noticeTypes) ? cache.noticeTypes : [],
    totalNotices: Array.isArray(cache?.notices) ? cache.notices.length : 0,
  };

  if (!isPlainObject(cache)) {
    errors.push(error(
      "cache_not_object",
      "$",
      "Cache must be a JSON object",
    ));
    return result(summary, errors);
  }

  validateGeneratedAt(cache.generatedAt, now, maxAgeDays, summary, errors);
  validateTopLevelSource(cache.source, errors);
  validateNoticeTypes(cache.noticeTypes, errors);
  validateNotices(cache.notices, errors);

  return result(summary, errors);
}

function validateGeneratedAt(value, now, maxAgeDays, summary, errors) {
  if (!stringValue(value)) {
    errors.push(error(
      "generated_at_missing",
      "generatedAt",
      "Cache generatedAt is required",
    ));
    return;
  }

  const generatedAt = normalizeDateTime(value);

  if (!generatedAt) {
    errors.push(error(
      "generated_at_invalid",
      "generatedAt",
      "Cache generatedAt must be an ISO date-time",
    ));
    return;
  }

  const ageDays = Math.max(0, Math.floor((now.getTime() - generatedAt.getTime()) / DAY_MS));
  summary.ageDays = ageDays;

  if (ageDays > maxAgeDays) {
    errors.push(error(
      "cache_stale",
      "generatedAt",
      `Cache generatedAt is older than ${maxAgeDays} days`,
    ));
  }
}

function validateTopLevelSource(source, errors) {
  if (!isPlainObject(source)) {
    errors.push(error(
      "source_missing",
      "source",
      "Cache source metadata is required",
    ));
    return;
  }

  if (source.system !== "myhome") {
    errors.push(error(
      "source_invalid",
      "source.system",
      "Cache source system must be myhome",
    ));
  }

  if (source.contract !== "data_go_kr_openapi") {
    errors.push(error(
      "source_invalid",
      "source.contract",
      "Cache source contract must be data_go_kr_openapi",
    ));
  }
}

function validateNoticeTypes(noticeTypes, errors) {
  if (!Array.isArray(noticeTypes)) {
    errors.push(error(
      "notice_types_invalid",
      "noticeTypes",
      "Cache noticeTypes must be an array",
    ));
    return;
  }

  if (noticeTypes.length === 0) {
    errors.push(error(
      "notice_types_empty",
      "noticeTypes",
      "Cache noticeTypes must not be empty",
    ));
  }

  noticeTypes.forEach((noticeType, index) => {
    if (!SUPPORTED_NOTICE_TYPES.has(noticeType)) {
      errors.push(error(
        "notice_type_unsupported",
        `noticeTypes[${index}]`,
        "Cache noticeTypes contains an unsupported notice type",
      ));
    }
  });
}

function validateNotices(notices, errors) {
  if (!Array.isArray(notices)) {
    errors.push(error(
      "notices_invalid",
      "notices",
      "Cache notices must be an array",
    ));
    return;
  }

  if (notices.length === 0) {
    errors.push(error(
      "notices_empty",
      "notices",
      "Cache notices must not be empty",
    ));
    return;
  }

  notices.forEach((notice, index) => {
    validateNotice(notice, index, errors);
  });
}

function validateNotice(notice, index, errors) {
  const basePath = `notices[${index}]`;

  if (!isPlainObject(notice)) {
    errors.push(error(
      "notice_not_object",
      basePath,
      "Notice must be a JSON object",
    ));
    return;
  }

  validateRequiredNoticeField(notice?.id, `${basePath}.id`, errors);
  validateRequiredNoticeField(
    notice?.sourceNoticeGroupId,
    `${basePath}.sourceNoticeGroupId`,
    errors,
  );
  validateNoticeType(notice?.noticeType, `${basePath}.noticeType`, errors);
  validateRequiredNoticeField(notice?.title, `${basePath}.title`, errors);
  validateRequiredNoticeField(notice?.source?.system, `${basePath}.source.system`, errors);
  validateRequiredNoticeField(
    notice?.source?.contract,
    `${basePath}.source.contract`,
    errors,
  );
  validateRequiredNoticeField(
    notice?.source?.operation,
    `${basePath}.source.operation`,
    errors,
  );
  validateRequiredNoticeField(
    notice?.source?.sourceNoticeId,
    `${basePath}.source.sourceNoticeId`,
    errors,
  );
  validateNoticeDates(notice?.dates, basePath, errors);
  validateNoRawNoticeFields(notice, basePath, errors);
}

function validateRequiredNoticeField(value, path, errors) {
  if (!stringValue(value)) {
    errors.push(error(
      "notice_missing_required_field",
      path,
      "Notice is missing a required field",
    ));
  }
}

function validateNoticeType(value, path, errors) {
  if (!stringValue(value)) {
    errors.push(error(
      "notice_missing_required_field",
      path,
      "Notice is missing a required field",
    ));
    return;
  }

  if (!SUPPORTED_NOTICE_TYPES.has(value)) {
    errors.push(error(
      "notice_type_unsupported",
      path,
      "Notice has an unsupported notice type",
    ));
  }
}

function validateNoticeDates(dates, basePath, errors) {
  if (!isPlainObject(dates)) {
    return;
  }

  for (const field of [
    "noticeDate",
    "applicationStartDate",
    "applicationEndDate",
    "winnerAnnouncementDate",
  ]) {
    const value = dates[field];

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (!isIsoDate(value)) {
      errors.push(error(
        "notice_invalid_date",
        `${basePath}.dates.${field}`,
        "Notice date must use YYYY-MM-DD format",
      ));
    }
  }
}

function validateNoRawNoticeFields(notice, basePath, errors) {
  for (const field of RAW_NOTICE_FIELDS) {
    if (Object.hasOwn(notice, field)) {
      errors.push(error(
        "notice_raw_field",
        `${basePath}.${field}`,
        "Notice cache must not include raw source payload fields",
      ));
    }
  }
}

function result(summary, errors) {
  return {
    ok: errors.length === 0,
    summary,
    errors,
  };
}

function error(code, path, message) {
  return { code, path, message };
}

function normalizeMaxAgeDays(value) {
  const parsed = Number(value ?? DEFAULT_MAX_AGE_DAYS);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : DEFAULT_MAX_AGE_DAYS;
}

function normalizeDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized || undefined;
}
