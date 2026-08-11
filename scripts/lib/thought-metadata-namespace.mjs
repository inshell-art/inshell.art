const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

const assertSchema = (condition, message) => {
  if (!condition) throw new Error(message);
};

const resolveLocalRef = (rootSchema, ref) => {
  assertSchema(ref.startsWith("#/"), `unsupported non-local schema reference: ${ref}`);
  return ref.slice(2).split("/").reduce(
    (value, segment) => value[segment.replaceAll("~1", "/").replaceAll("~0", "~")],
    rootSchema,
  );
};

export const validateJsonSchemaValue = (
  value,
  schema,
  rootSchema = schema,
  location = "$",
) => {
  if (schema.$ref) {
    validateJsonSchemaValue(value, resolveLocalRef(rootSchema, schema.$ref), rootSchema, location);
    return;
  }
  if (schema.const !== undefined) {
    assertSchema(same(value, schema.const), `${location} does not match const`);
  }
  if (schema.enum) {
    assertSchema(
      schema.enum.some((candidate) => same(value, candidate)),
      `${location} is outside enum`,
    );
  }
  if (schema.type) {
    const actualType = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
    assertSchema(actualType === schema.type, `${location} must be ${schema.type}; received ${actualType}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined) {
      assertSchema([...value].length >= schema.minLength, `${location} is shorter than minLength`);
    }
    if (schema.maxLength !== undefined) {
      assertSchema([...value].length <= schema.maxLength, `${location} exceeds maxLength`);
    }
    if (schema.pattern) {
      assertSchema(new RegExp(schema.pattern, "u").test(value), `${location} does not match pattern`);
    }
    if (schema["x-thought-utf8-max-bytes"] !== undefined) {
      assertSchema(
        Buffer.byteLength(value, "utf8") <= schema["x-thought-utf8-max-bytes"],
        `${location} exceeds UTF-8 byte limit`,
      );
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const required of schema.required ?? []) {
      assertSchema(Object.hasOwn(value, required), `${location}.${required} is required`);
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(value, key)) {
        validateJsonSchemaValue(value[key], child, rootSchema, `${location}.${key}`);
      }
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value)) {
        assertSchema(known.has(key), `${location}.${key} is not allowed`);
      }
    }
  }
  for (const child of schema.allOf ?? []) {
    validateJsonSchemaValue(value, child, rootSchema, location);
  }
  if (schema.if && isJsonSchemaValueValid(value, schema.if, rootSchema)) {
    validateJsonSchemaValue(value, schema.then ?? {}, rootSchema, location);
  }
};

export const isJsonSchemaValueValid = (value, schema, rootSchema = schema) => {
  try {
    validateJsonSchemaValue(value, schema, rootSchema);
    return true;
  } catch {
    return false;
  }
};
