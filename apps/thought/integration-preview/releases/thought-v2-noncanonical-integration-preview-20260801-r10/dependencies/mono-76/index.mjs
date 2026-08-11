const readJsonUrl = async (url) => {
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(url, "utf8"));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to load ${url}: ${response.status}`);
  return response.json();
};

const readBytesUrl = async (url) => {
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return new Uint8Array(await readFile(url));
  }
  const response = await fetch(url);
  if (!response.ok) throw new Error(`failed to load ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const MONO_76_REPERTOIRE = " ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,?!:;'\"-()/&";
export const MONO_76_VERSION = "1.0.0";
export const MONO_76_RELEASE_TAG = "v1.0.0";
export const MONO_76_DEFAULT_ORIGIN_SHIFT_X = 1;
let fontPromise;

export const assertMono76Font = (font) => {
  if (
    !font
    || font.schema !== "inshell.mono-76.centerline-face.v1"
    || font.release?.version !== MONO_76_VERSION
    || font.repertoire !== MONO_76_REPERTOIRE
    || font.glyphs?.length !== 76
    || font.glyphs.map(({ character }) => character).join("")
      !== MONO_76_REPERTOIRE
    || font.metrics?.fixedAdvanceWidth !== 10
    || font.renderStyle?.fill !== "none"
  ) {
    throw new TypeError("invalid Inshell Mono 76 font");
  }
  return font;
};

export const loadMono76Font = () => {
  fontPromise ??= readJsonUrl(new URL("./glyphs.json", import.meta.url))
    .then(assertMono76Font);
  return fontPromise;
};

export const loadMono76Manifest = () =>
  readJsonUrl(new URL("./manifest.json", import.meta.url));

export const loadMono76Packed = () =>
  readBytesUrl(new URL("./onchain/packed.bin", import.meta.url));

export const unsupportedMono76Characters = (font, text) => {
  assertMono76Font(font);
  if (typeof text !== "string") throw new TypeError("text must be a string");
  const supported = new Set(font.glyphs.map(({ character }) => character));
  return [...new Set([...text].filter((character) => !supported.has(character)))];
};

export const supportsMono76Text = (font, text) =>
  unsupportedMono76Characters(font, text).length === 0;

export const assertMono76Text = (font, text) => {
  const unsupported = unsupportedMono76Characters(font, text);
  if (unsupported.length > 0) {
    throw new RangeError(
      `unsupported Inshell Mono 76 characters: ${unsupported.join(" ")}`
    );
  }
  return text;
};

export const renderMono76Line = (
  font,
  text,
  {
    background = null,
    className = "",
    height = null,
    originShiftX = font.composition.defaultOriginShiftX,
    padding = 2,
    stroke = "#00ff35",
    strokes = null,
    title = text,
    width = null
  } = {}
) => {
  assertMono76Font(font);
  assertMono76Text(font, text);
  if (!Number.isFinite(padding) || padding < 0) {
    throw new RangeError("padding must be a non-negative finite number");
  }
  if (!Number.isFinite(originShiftX)) {
    throw new RangeError("originShiftX must be finite");
  }
  const characters = [...text];
  if (strokes !== null && strokes.length !== characters.length) {
    throw new RangeError("strokes must contain one color per character");
  }
  const glyphs = new Map(font.glyphs.map((glyph) => [glyph.character, glyph]));
  const advance = font.metrics.fixedAdvanceWidth;
  const viewHeight = font.metrics.svgViewBoxHeight;
  const baselineY = font.metrics.svgBaselineY;
  const viewWidth = Math.max(1, characters.length * advance + padding * 2);
  const paths = characters.map((character, index) => {
    const glyph = glyphs.get(character);
    if (!glyph.d) return "";
    const color = strokes?.[index] ?? stroke;
    const x = padding + originShiftX + index * advance;
    return `<path d="${glyph.d}" stroke="${escapeXml(color)}" transform="translate(${x} ${baselineY}) scale(1 -1)"/>`;
  }).join("");
  const backgroundRect = background === null
    ? ""
    : `<rect width="${viewWidth}" height="${viewHeight}" fill="${escapeXml(background)}"/>`;
  const titleElement = title === null ? "" : `<title>${escapeXml(title)}</title>`;
  const classAttribute = className ? ` class="${escapeXml(className)}"` : "";
  const widthAttribute = width === null ? "" : ` width="${escapeXml(width)}"`;
  const heightAttribute = height === null ? "" : ` height="${escapeXml(height)}"`;
  const style = font.renderStyle;
  return `<svg xmlns="http://www.w3.org/2000/svg"${classAttribute}${widthAttribute}${heightAttribute} viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="${escapeXml(text)}" data-font="Inshell Mono 76" data-version="${MONO_76_VERSION}">${titleElement}${backgroundRect}<g fill="none" stroke-width="${style.strokeWidth}" stroke-linecap="${style.strokeLinecap}" stroke-linejoin="${style.strokeLinejoin}">${paths}</g></svg>\n`;
};

export const renderMono76Text = async (text, options = {}) =>
  renderMono76Line(await loadMono76Font(), text, options);
