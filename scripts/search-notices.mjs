#!/usr/bin/env node

import { readNoticeCache, searchNotices } from "./lib/notice-search.mjs";

const args = parseArgs(process.argv.slice(2));

try {
  const cache = readNoticeCache(args.cachePath ?? "data/cache/myhome-notices.json");
  const result = searchNotices(cache, args.filters);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {
    cachePath: undefined,
    filters: {},
  };

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
    } else if (key === "limit") {
      parsed.filters.limit = Number(value);
    } else {
      parsed.filters[key] = value;
    }
  }

  return parsed;
}
