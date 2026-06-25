#!/usr/bin/env node

import { readFileSync } from "node:fs";

import { validatePlayMcpToolDefinitions } from "./lib/playmcp-tool-validator.mjs";

const definitionPath = process.argv[2];

if (!definitionPath) {
  console.error("Usage: node scripts/validate-playmcp-tools.mjs <tool-definitions.json>");
  process.exit(2);
}

const rules = readJson("config/playmcp-tool-rules.json");
const definition = readJson(definitionPath);
const result = validatePlayMcpToolDefinitions(definition, rules);

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
