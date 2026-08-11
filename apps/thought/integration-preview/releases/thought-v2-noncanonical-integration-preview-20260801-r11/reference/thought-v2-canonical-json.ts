export type JsonPrimitive = null | boolean | number | string;

export type CanonicalJson =
  | JsonPrimitive
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

const normalizeCanonicalJson = (value: CanonicalJson): CanonicalJson => {
  if (Array.isArray(value)) return value.map(normalizeCanonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeCanonicalJson(value[key]!)]),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("non-finite JSON number");
  }
  return value;
};

/**
 * Serializes the closed THOUGHT JSON models with deterministic RFC 8785/JCS
 * object-key ordering. The protocol models contain only JSON values whose
 * ECMAScript primitive serialization is already JCS-compatible.
 */
export const canonicalJsonStringify = (value: CanonicalJson): string =>
  JSON.stringify(normalizeCanonicalJson(value));
