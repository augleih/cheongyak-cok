import { existsSync, readFileSync } from "node:fs";

export function loadDotEnv(path = ".env") {
  if (!existsSync(path)) {
    return {};
  }

  return parseDotEnv(readFileSync(path, "utf8"));
}

export function parseDotEnv(content) {
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = unquote(line.slice(separatorIndex + 1).trim());

    if (key) {
      env[key] = value;
    }
  }

  return env;
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
