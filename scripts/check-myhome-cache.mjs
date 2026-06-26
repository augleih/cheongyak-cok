#!/usr/bin/env node

import { readFileSync } from "node:fs";

import {
  DEFAULT_MYHOME_CACHE_PATH,
  validateMyHomeNoticeCache,
} from "./lib/myhome-cache-health.mjs";

const args = parseArgs(process.argv.slice(2));
const cachePath = args.cachePath ?? DEFAULT_MYHOME_CACHE_PATH;
const output = checkCacheFile({
  cachePath,
  maxAgeDays: args.maxAgeDays,
  now: args.now,
});

console.log(JSON.stringify(output, null, 2));
process.exit(output.ok ? 0 : 1);

function checkCacheFile({ cachePath, maxAgeDays, now }) {
  let cache;

  try {
    cache = JSON.parse(readFileSync(cachePath, "utf8"));
  } catch {
    return {
      ok: false,
      cachePath,
      summary: {
        generatedAt: undefined,
        ageDays: undefined,
        maxAgeDays: normalizeMaxAgeDays(maxAgeDays),
        noticeTypes: [],
        totalNotices: 0,
      },
      errors: [
        {
          code: "cache_unreadable",
          path: "cachePath",
          message: "Cache file could not be read as JSON",
        },
      ],
    };
  }

  const result = validateMyHomeNoticeCache(cache, {
    maxAgeDays,
    now,
  });

  return {
    ok: result.ok,
    cachePath,
    summary: result.summary,
    errors: result.errors,
  };
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      continue;
    }

    const key = arg.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      continue;
    }

    index += 1;

    if (key === "cachePath") {
      parsed.cachePath = value;
    } else if (key === "maxAgeDays") {
      parsed.maxAgeDays = Number(value);
    } else if (key === "now") {
      parsed.now = value;
    }
  }

  return parsed;
}

function normalizeMaxAgeDays(value) {
  const parsed = Number(value ?? 7);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 7;
}
