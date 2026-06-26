import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDotEnv } from "../scripts/lib/local-env.mjs";

test("parses .env content without requiring shell-specific syntax", () => {
  const env = parseDotEnv(`
    # local secrets
    MYHOME_SERVICE_KEY="test-service-key"
    EMPTY_VALUE=
    SPACED = value with spaces
  `);

  assert.deepEqual(env, {
    MYHOME_SERVICE_KEY: "test-service-key",
    EMPTY_VALUE: "",
    SPACED: "value with spaces",
  });
});
