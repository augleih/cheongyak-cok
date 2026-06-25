import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { validatePlayMcpToolDefinitions } from "../scripts/lib/playmcp-tool-validator.mjs";

const baseRules = {
  server: {
    forbiddenNameSubstring: "kakao",
    forbiddenNameSubstringCaseInsensitive: true,
  },
  tools: {
    maxCount: 20,
    recommendedMinCount: 3,
    recommendedMaxCount: 10,
    namePattern: "^[A-Za-z0-9_-]{1,128}$",
    forbiddenNameSubstring: "kakao",
    forbiddenNameSubstringCaseInsensitive: true,
    descriptionMaxLength: 1024,
    descriptionMustInclude: ["CheongyakCok", "청약콕"],
    requiredProperties: ["name", "description", "inputSchema", "annotations"],
    requiredAnnotations: [
      "title",
      "readOnlyHint",
      "destructiveHint",
      "openWorldHint",
      "idempotentHint",
    ],
    publicToolAllowList: [
      "search_notices",
      "get_notice_detail",
      "evaluate_eligibility",
    ],
    publicToolDenyList: ["refresh_notice_cache"],
  },
};

const validTool = {
  name: "search_notices",
  description:
    "Search MyHome-listed public housing notices for CheongyakCok(청약콕).",
  inputSchema: { type: "object", properties: {} },
  annotations: {
    title: "Search notices",
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true,
  },
};

test("rejects server and public tool names containing the forbidden substring", () => {
  const result = validatePlayMcpToolDefinitions(
    {
      serverName: "kakao-cheongyak-cok",
      tools: [{ ...validTool, name: "kakao_search" }],
    },
    baseRules,
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["server.forbiddenNameSubstring", "tools.forbiddenNameSubstring"],
  );
});

test("rejects public tools missing required properties and annotations", () => {
  const result = validatePlayMcpToolDefinitions(
    {
      serverName: "cheongyak-cok",
      tools: [
        {
          name: "search_notices",
          description:
            "Search MyHome-listed public housing notices for CheongyakCok(청약콕).",
          annotations: {
            title: "Search notices",
          },
        },
      ],
    },
    baseRules,
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    [
      "tools.requiredProperty",
      "tools.requiredAnnotation",
      "tools.requiredAnnotation",
      "tools.requiredAnnotation",
      "tools.requiredAnnotation",
    ],
  );
  assert.deepEqual(
    result.errors.map((error) => error.path),
    [
      "tools[0].inputSchema",
      "tools[0].annotations.readOnlyHint",
      "tools[0].annotations.destructiveHint",
      "tools[0].annotations.openWorldHint",
      "tools[0].annotations.idempotentHint",
    ],
  );
});

test("rejects public tool definitions over the maximum tool count", () => {
  const result = validatePlayMcpToolDefinitions(
    {
      serverName: "cheongyak-cok",
      tools: [
        validTool,
        { ...validTool, name: "get_notice_detail" },
      ],
    },
    {
      ...baseRules,
      tools: {
        ...baseRules.tools,
        maxCount: 1,
      },
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["tools.maxCount"],
  );
  assert.equal(result.errors[0].path, "tools");
});

test("rejects denied public tools and tools outside the allow list", () => {
  const result = validatePlayMcpToolDefinitions(
    {
      serverName: "cheongyak-cok",
      tools: [
        { ...validTool, name: "refresh_notice_cache" },
        { ...validTool, name: "unknown_notice_tool" },
      ],
    },
    baseRules,
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["tools.publicToolDenyList", "tools.publicToolAllowList"],
  );
  assert.deepEqual(
    result.errors.map((error) => error.path),
    ["tools[0].name", "tools[1].name"],
  );
});

test("rejects invalid tool names and descriptions missing required text", () => {
  const result = validatePlayMcpToolDefinitions(
    {
      serverName: "cheongyak-cok",
      tools: [
        {
          ...validTool,
          name: "bad name",
          description: "Search MyHome-listed public housing notices.",
        },
      ],
    },
    baseRules,
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    [
      "tools.namePattern",
      "tools.descriptionMustInclude",
      "tools.descriptionMustInclude",
    ],
  );
  assert.deepEqual(
    result.errors.map((error) => error.path),
    [
      "tools[0].name",
      "tools[0].description",
      "tools[0].description",
    ],
  );
});

test("rejects public tool descriptions over the configured maximum length", () => {
  const result = validatePlayMcpToolDefinitions(
    {
      serverName: "cheongyak-cok",
      tools: [
        {
          ...validTool,
          description:
            "CheongyakCok(청약콕) validates a deliberately long description.",
        },
      ],
    },
    {
      ...baseRules,
      tools: {
        ...baseRules.tools,
        descriptionMaxLength: 20,
      },
    },
  );

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.errors.map((error) => error.code),
    ["tools.descriptionMaxLength"],
  );
  assert.equal(result.errors[0].path, "tools[0].description");
});

test("CLI exits with failure and prints validation errors for invalid definitions", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "playmcp-validator-"));
  const definitionPath = join(tempDir, "tools.json");

  writeFileSync(
    definitionPath,
    JSON.stringify({
      serverName: "cheongyak-cok",
      tools: [{ ...validTool, name: "refresh_notice_cache" }],
    }),
  );

  try {
    const result = spawnSync(
      process.execPath,
      ["scripts/validate-playmcp-tools.mjs", definitionPath],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 1);
    assert.match(result.stdout, /tools\.publicToolDenyList/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
