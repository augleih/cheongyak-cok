export function validatePlayMcpToolDefinitions(definition, rules) {
  const errors = [];

  const serverName = definition?.serverName ?? "";
  const serverForbidden = rules?.server?.forbiddenNameSubstring;

  if (
    serverForbidden &&
    containsSubstring(
      serverName,
      serverForbidden,
      rules?.server?.forbiddenNameSubstringCaseInsensitive,
    )
  ) {
    errors.push({
      code: "server.forbiddenNameSubstring",
      message: `serverName must not include "${serverForbidden}"`,
      path: "serverName",
    });
  }

  const tools = definition?.tools ?? [];
  const maxCount = rules?.tools?.maxCount;

  if (typeof maxCount === "number" && tools.length > maxCount) {
    errors.push({
      code: "tools.maxCount",
      message: `tool count must be at most ${maxCount}`,
      path: "tools",
    });
  }

  for (const [index, tool] of tools.entries()) {
    const forbidden = rules?.tools?.forbiddenNameSubstring;
    const hasForbiddenName =
      forbidden &&
      containsSubstring(
        tool?.name ?? "",
        forbidden,
        rules?.tools?.forbiddenNameSubstringCaseInsensitive,
      );

    if (hasForbiddenName) {
      errors.push({
        code: "tools.forbiddenNameSubstring",
        message: `tool name must not include "${forbidden}"`,
        path: `tools[${index}].name`,
      });
    }

    const toolName = tool?.name ?? "";
    const namePattern = rules?.tools?.namePattern;
    const hasInvalidName =
      namePattern && !new RegExp(namePattern).test(toolName);

    if (hasInvalidName) {
      errors.push({
        code: "tools.namePattern",
        message: `tool name must match ${namePattern}`,
        path: `tools[${index}].name`,
      });
    }

    const denyList = rules?.tools?.publicToolDenyList ?? [];
    const allowList = rules?.tools?.publicToolAllowList ?? [];
    const isDenied = denyList.includes(toolName);

    if (isDenied) {
      errors.push({
        code: "tools.publicToolDenyList",
        message: `public tool "${toolName}" is denied`,
        path: `tools[${index}].name`,
      });
    } else if (
      !hasForbiddenName &&
      !hasInvalidName &&
      allowList.length > 0 &&
      !allowList.includes(toolName)
    ) {
      errors.push({
        code: "tools.publicToolAllowList",
        message: `public tool "${toolName}" is not in the allow list`,
        path: `tools[${index}].name`,
      });
    }

    for (const property of rules?.tools?.requiredProperties ?? []) {
      if (!hasOwn(tool, property)) {
        errors.push({
          code: "tools.requiredProperty",
          message: `tool is missing required property "${property}"`,
          path: `tools[${index}].${property}`,
        });
      }
    }

    for (const annotation of rules?.tools?.requiredAnnotations ?? []) {
      if (!hasOwn(tool?.annotations, annotation)) {
        errors.push({
          code: "tools.requiredAnnotation",
          message: `tool annotations are missing required field "${annotation}"`,
          path: `tools[${index}].annotations.${annotation}`,
        });
      }
    }

    const description = tool?.description ?? "";
    const maxDescriptionLength = rules?.tools?.descriptionMaxLength;

    if (
      typeof maxDescriptionLength === "number" &&
      description.length > maxDescriptionLength
    ) {
      errors.push({
        code: "tools.descriptionMaxLength",
        message: `tool description must be at most ${maxDescriptionLength} characters`,
        path: `tools[${index}].description`,
      });
    }

    for (const requiredText of rules?.tools?.descriptionMustInclude ?? []) {
      if (!description.includes(requiredText)) {
        errors.push({
          code: "tools.descriptionMustInclude",
          message: `tool description must include "${requiredText}"`,
          path: `tools[${index}].description`,
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function containsSubstring(value, substring, caseInsensitive) {
  if (!caseInsensitive) {
    return value.includes(substring);
  }

  return value.toLowerCase().includes(substring.toLowerCase());
}

function hasOwn(value, property) {
  return Object.hasOwn(value ?? {}, property);
}
