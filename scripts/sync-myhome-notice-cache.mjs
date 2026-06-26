#!/usr/bin/env node

import { loadDotEnv } from "./lib/local-env.mjs";
import { syncMyHomeNoticeCache } from "./lib/myhome-notice-cache-sync.mjs";

const args = parseArgs(process.argv.slice(2));
const env = { ...loadDotEnv(".env"), ...process.env };
const serviceKey = env.MYHOME_SERVICE_KEY;

if (!serviceKey) {
  console.error("Missing MYHOME_SERVICE_KEY. Add it to .env or the process environment.");
  process.exit(2);
}

try {
  const result = await syncMyHomeNoticeCache({
    outputDir: args.outputDir ?? "data",
    serviceKey,
    pageSize: args.pageSize ?? 100,
    maxPages: args.maxPages,
    noticeTypes: args.noticeTypes ?? ["public_rental", "public_sale"],
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
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

    if (key === "pageSize" || key === "maxPages") {
      parsed[key] = Number(value);
    } else if (key === "noticeTypes") {
      parsed.noticeTypes = value.split(",").map((entry) => entry.trim()).filter(Boolean);
    } else if (key === "outputDir") {
      parsed.outputDir = value;
    }
  }

  return parsed;
}
