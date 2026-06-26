#!/usr/bin/env node

import { fetchMyHomeOpenApiNotices } from "./lib/myhome-openapi-client.mjs";
import { loadDotEnv } from "./lib/local-env.mjs";

const args = parseArgs(process.argv.slice(2));
const env = { ...loadDotEnv(".env"), ...process.env };
const serviceKey = env.MYHOME_SERVICE_KEY;

if (!args.noticeType || !["public_rental", "public_sale"].includes(args.noticeType)) {
  console.error(
    "Usage: node scripts/collect-myhome-notices.mjs --noticeType public_rental|public_sale [--pageNo 1] [--numOfRows 10]",
  );
  process.exit(2);
}

if (!serviceKey) {
  console.error("Missing MYHOME_SERVICE_KEY. Add it to .env or the process environment.");
  process.exit(2);
}

try {
  const notices = await fetchMyHomeOpenApiNotices({
    noticeType: args.noticeType,
    serviceKey,
    params: args.params,
  });

  console.log(JSON.stringify({ notices }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(argv) {
  const parsed = {
    noticeType: undefined,
    params: {},
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

    if (key === "noticeType") {
      parsed.noticeType = value;
    } else {
      parsed.params[key] = value;
    }
  }

  return parsed;
}
