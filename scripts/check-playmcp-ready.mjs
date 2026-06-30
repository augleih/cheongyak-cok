#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const validation = runNodeScript("scripts/validate-playmcp-tools.mjs", [
  "config/playmcp-tools.json",
]);
const validationJson = readJsonOutput(validation);
const validationOk = validation.status === 0 && validationJson?.ok === true;

const smoke = runNodeScript("scripts/smoke-mcp-server.mjs", []);
const smokeJson = readJsonOutput(smoke);
const smokeOk = smoke.status === 0 && smokeJson?.ok === true;

const checks = [
  checkSummary("tool_definitions", validationOk, validation, validationJson),
  checkSummary("mcp_smoke", smokeOk, smoke, smokeJson),
];

let cacheJson;
if (args.cachePath) {
  const cacheArgs = ["--cachePath", args.cachePath];

  if (args.maxAgeDays !== undefined) {
    cacheArgs.push("--maxAgeDays", String(args.maxAgeDays));
  }

  const cache = runNodeScript("scripts/check-myhome-cache.mjs", cacheArgs);
  cacheJson = readJsonOutput(cache);
  const cacheOk = cache.status === 0 && cacheJson?.ok === true;
  checks.push(checkSummary("myhome_cache", cacheOk, cache, cacheJson));
}

const ok = checks.every((check) => check.ok);
const output = {
  ok,
  checks: checks.map(({ name, ok: checkOk }) => ({
    name,
    ok: checkOk,
  })),
};

if (smokeOk) {
  output.toolNames = smokeJson.toolNames;
  output.smoke = {
    endpointPath: smokeJson.endpointPath,
    calls: smokeJson.calls,
  };
}

if (cacheJson) {
  output.cache = {
    cachePath: cacheJson.cachePath,
    summary: cacheJson.summary,
  };
}

if (!ok) {
  output.failures = checks
    .filter((check) => !check.ok)
    .map(({ name, status, stdout, stderr, parsed }) => ({
      name,
      status,
      parsed,
      stdout,
      stderr,
    }));
}

console.log(JSON.stringify(output, null, 2));
process.exit(ok ? 0 : 1);

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
    }
  }

  return parsed;
}

function runNodeScript(script, args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
  });
}

function readJsonOutput(result) {
  if (!result.stdout) {
    return undefined;
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    return undefined;
  }
}

function checkSummary(name, ok, result, parsed) {
  return {
    name,
    ok,
    status: result.status,
    parsed,
    stdout: excerpt(result.stdout),
    stderr: excerpt(result.stderr),
  };
}

function excerpt(text) {
  return text?.trim().slice(0, 1000) || "";
}
