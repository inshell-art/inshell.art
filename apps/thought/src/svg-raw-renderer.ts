export type ThoughtSvgOptions = {
  tokenId?: number | string;
  text: string;
  viewBoxSize?: number;
  background?: string;
  blockSize?: number;
  blockGap?: number;
  blockY?: number;
  textY?: number;
  fontSize?: number;
  fontFamily?: string;
  textFill?: string;
  textOpacity?: string;
  fontWeight?: string;
};

const DEFAULT_VIEWBOX_SIZE = 960;
const DEFAULT_BLOCK_SIZE = 29;
const DEFAULT_BLOCK_GAP = 6;
const DEFAULT_TEXT_Y = 932;
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_FONT_FAMILY = "Source Code Pro, monospace";
const DEFAULT_FONT_WEIGHT = "200";
const DEFAULT_TEXT_FILL = "#fff";
const DEFAULT_TEXT_OPACITY = ".72";

export const INSHELL_COLOR_FONT: Record<string, string> = {
  A: "00ffff",
  B: "0000ff",
  C: "6f4e37",
  D: "6699ff",
  E: "fff9e3",
  F: "ff00ff",
  G: "008000",
  H: "ffcc00",
  I: "4b0082",
  J: "00a86b",
  K: "c3b091",
  L: "00ff00",
  M: "800000",
  N: "0a1172",
  O: "ffa500",
  P: "ffaadd",
  Q: "a6a6a6",
  R: "ff0000",
  S: "fa8072",
  T: "008080",
  U: "5533ff",
  V: "aa55ff",
  W: "f5deb3",
  X: "bbcccc",
  Y: "ffff00",
  Z: "778877",
};

export function canonicalThoughtText(value: string) {
  return value.replace(/[^A-Za-z]+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const svgNumber = (value: number) =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));

export function buildThoughtRawSvg(options: ThoughtSvgOptions) {
  const text = canonicalThoughtText(options.text);
  const viewBoxSize = options.viewBoxSize ?? DEFAULT_VIEWBOX_SIZE;
  const blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE;
  const blockGap = options.blockGap ?? DEFAULT_BLOCK_GAP;
  const blockY = options.blockY;
  const textY = options.textY ?? DEFAULT_TEXT_Y;
  const fontSize = options.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = options.fontFamily ?? DEFAULT_FONT_FAMILY;
  const fontWeight = options.fontWeight ?? DEFAULT_FONT_WEIGHT;
  const textFill = options.textFill ?? DEFAULT_TEXT_FILL;
  const textOpacity = options.textOpacity ?? DEFAULT_TEXT_OPACITY;
  const background = options.background ?? "#050505";
  const tokenId = options.tokenId ?? "dev";

  const chars = Array.from(text);
  const rowWidth =
    chars.length * blockSize + (chars.length > 1 ? (chars.length - 1) * blockGap : 0);
  const startX = Math.floor((viewBoxSize - rowWidth) / 2);
  const rectY = blockY ?? Math.floor((viewBoxSize - blockSize) / 2);
  const rects = chars
    .map((char, index) => {
      if (char === " ") {
        return "";
      }
      const fill = INSHELL_COLOR_FONT[char] ?? INSHELL_COLOR_FONT.Z;
      const x = startX + index * (blockSize + blockGap);
      return `<rect x="${svgNumber(x)}" y="${svgNumber(rectY)}" width="${svgNumber(blockSize)}" height="${svgNumber(blockSize)}" fill="#${fill}"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgNumber(viewBoxSize)} ${svgNumber(viewBoxSize)}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"><title>THOUGHT ${escapeXml(String(tokenId))}</title><defs><clipPath id="canvasClip"><rect x="0" y="0" width="${svgNumber(viewBoxSize)}" height="${svgNumber(viewBoxSize)}"/></clipPath></defs><rect id="background" x="0" y="0" width="${svgNumber(viewBoxSize)}" height="${svgNumber(viewBoxSize)}" fill="${background}"/><g clip-path="url(#canvasClip)"><g id="rects">${rects}</g><g id="text"><text x="${svgNumber(viewBoxSize / 2)}" y="${svgNumber(textY)}" fill="${textFill}" fill-opacity="${textOpacity}" font-family="${escapeXml(fontFamily)}" font-size="${svgNumber(fontSize)}" font-weight="${escapeXml(fontWeight)}" text-anchor="middle" dominant-baseline="alphabetic">${escapeXml(text)}</text></g></g></svg>`;
}
