export const MONO_76_PACKED_MAGIC = "IM76";
export const MONO_76_PACKED_VERSION = 1;
export const MONO_76_PACKED_HEADER_BYTES = 8;
export const MONO_76_PACKED_OFFSET_COUNT = 77;
export const MONO_76_PACKED_PATH_OFFSET =
  MONO_76_PACKED_HEADER_BYTES + MONO_76_PACKED_OFFSET_COUNT * 2;
export const MONO_76_REPERTOIRE =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,?!:;'\"-()/&";

const bytesOf = (value) => {
  if (value instanceof Uint8Array) return value;
  if (typeof value === "string") {
    const hex = value.startsWith("0x") ? value.slice(2) : value;
    if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) {
      throw new TypeError("packed string must be even-length hexadecimal");
    }
    return Uint8Array.from(
      hex.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16))
    );
  }
  throw new TypeError("packed data must be a Uint8Array or hexadecimal string");
};

const uint16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];

export const inspectMono76Packed = (value) => {
  const bytes = bytesOf(value);
  if (bytes.length < MONO_76_PACKED_PATH_OFFSET) {
    throw new RangeError("packed data is shorter than its fixed header");
  }
  const magic = new TextDecoder().decode(bytes.slice(0, 4));
  const version = bytes[4];
  const weight = uint16(bytes, 5);
  const glyphCount = bytes[7];
  if (
    magic !== MONO_76_PACKED_MAGIC
    || version !== MONO_76_PACKED_VERSION
    || glyphCount !== 76
    || weight !== 400
  ) {
    throw new RangeError("packed data has an unsupported Inshell Mono 76 header");
  }
  const offsets = Array.from(
    { length: MONO_76_PACKED_OFFSET_COUNT },
    (_, index) => uint16(bytes, MONO_76_PACKED_HEADER_BYTES + index * 2)
  );
  const pathBytes = bytes.length - MONO_76_PACKED_PATH_OFFSET;
  if (
    offsets[0] !== 0
    || offsets.at(-1) !== pathBytes
    || offsets.some((offset, index) =>
      offset > pathBytes || (index > 0 && offset < offsets[index - 1])
    )
  ) {
    throw new RangeError("packed path offsets are invalid");
  }
  return { bytes, magic, version, weight, glyphCount, offsets, pathBytes };
};

export const decodeMono76PackedGlyph = (value, character) => {
  const inspected = inspectMono76Packed(value);
  const index = [...MONO_76_REPERTOIRE].indexOf(character);
  if (index < 0) {
    const point = String(character).codePointAt(0);
    const label = point === undefined
      ? "empty input"
      : `U+${point.toString(16).toUpperCase().padStart(4, "0")}`;
    throw new RangeError(`unsupported Inshell Mono 76 character ${label}`);
  }
  const start = MONO_76_PACKED_PATH_OFFSET + inspected.offsets[index];
  const end = MONO_76_PACKED_PATH_OFFSET + inspected.offsets[index + 1];
  return new TextDecoder().decode(inspected.bytes.slice(start, end));
};
