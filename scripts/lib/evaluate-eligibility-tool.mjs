import { readFileSync } from "node:fs";

import { readNoticeCache } from "./notice-search.mjs";

const DEFAULT_CACHE_PATH = "data/cache/myhome-notices.json";
const TOOL_DEFINITIONS_URL = new URL("../../config/playmcp-tools.json", import.meta.url);
const DEFAULT_NEEDS_CONFIRMATION = [
  "official_notice_document",
  "household_no_home_status",
  "income_limits",
  "asset_limits",
  "supply_track_and_priority_rules",
  "duplicate_application_restrictions",
  "required_documents",
];

export const evaluateEligibilityToolDefinition = readEvaluateEligibilityToolDefinition();

export async function handleEvaluateEligibilityTool(
  input = {},
  {
    cachePath = DEFAULT_CACHE_PATH,
    readCache = readNoticeCache,
  } = {},
) {
  const { noticeId, profile } = normalizeEvaluateEligibilityInput(input);
  const cache = await readCache(cachePath);
  const notice = findNoticeById(cache, noticeId);
  const structuredContent = formatEligibilityResult({
    cache,
    noticeId,
    notice,
    profile,
  });

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

export function normalizeEvaluateEligibilityInput(input = {}) {
  if (!isPlainObject(input)) {
    throw new Error("evaluate_eligibility input must be an object");
  }

  const noticeId = String(input.noticeId ?? "").trim();

  if (!noticeId) {
    throw new Error("noticeId is required");
  }

  if (input.profile !== undefined && !isPlainObject(input.profile)) {
    throw new Error("profile must be an object when provided");
  }

  return {
    noticeId,
    profile: input.profile ?? {},
  };
}

function formatEligibilityResult({
  cache,
  noticeId,
  notice,
  profile,
}) {
  const base = {
    source: {
      system: "myhome",
      description: "MyHome-listed public housing notices cached by CheongyakCok.",
    },
    caution:
      "This is not a final eligibility decision. Review the official notice documents before applying.",
    generatedAt: cache?.generatedAt,
    profileFieldsProvided: profileFieldPaths(profile),
  };

  if (!notice) {
    return {
      ...base,
      found: false,
      notice: null,
      eligibility: {
        status: "unknown",
        reason: `No cached MyHome-listed public housing notice found for noticeId: ${noticeId}`,
        evidence: [],
        needsConfirmation: ["notice_id"],
      },
    };
  }

  return {
    ...base,
    found: true,
    notice: compactNoticeSummary(notice),
    eligibility: {
      status: "unknown",
      reason:
        "Based on the current inputs, eligibility cannot be determined from the cached MyHome list alone. Detailed criteria must be checked in the official notice document before applying.",
      evidence: [noticeSummaryEvidence(cache, notice)],
      needsConfirmation: DEFAULT_NEEDS_CONFIRMATION,
    },
  };
}

function findNoticeById(cache, noticeId) {
  const notices = Array.isArray(cache?.notices) ? cache.notices : [];
  return notices.find((notice) => notice?.id === noticeId);
}

function compactNoticeSummary(notice) {
  return compactObject({
    id: notice.id,
    noticeType: notice.noticeType,
    title: notice.title,
    providerName: notice.provider?.name,
    applicationStartDate: notice.dates?.applicationStartDate,
    applicationEndDate: notice.dates?.applicationEndDate,
  });
}

function noticeSummaryEvidence(cache, notice) {
  return compactObject({
    sourceName: "MyHome cached notice",
    noticeId: notice.id,
    noticeVersion: cache?.generatedAt,
    documentUrl: notice.links?.sourceUrl ?? notice.links?.pcUrl,
    section: "notice_summary",
    excerpt: notice.title,
    confidence: "medium",
    extractedAt: cache?.generatedAt,
  });
}

function profileFieldPaths(profile) {
  return collectFieldPaths(profile).sort();
}

function collectFieldPaths(value, prefix = "") {
  if (!isPlainObject(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, field]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isPlainObject(field) ? collectFieldPaths(field, path) : [path];
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

function readEvaluateEligibilityToolDefinition() {
  const definition = JSON.parse(readFileSync(TOOL_DEFINITIONS_URL, "utf8"));
  const tool = definition.tools?.find(({ name }) => name === "evaluate_eligibility");

  if (!tool) {
    throw new Error("evaluate_eligibility tool definition is missing");
  }

  return tool;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}
