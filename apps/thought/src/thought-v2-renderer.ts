export type ThoughtV2LineKind = "prompt" | "agent";

export type ThoughtV2Measure = {
  byteLength: number;
  displayUnits: number;
  errors: string[];
};

export type ThoughtV2SvgInput = {
  promptLine: string;
  agentLine: string;
  agentFontSize?: number;
  promptFontSize?: number;
  agentBgColor?: string;
  agentFrameColor?: string;
  canvasFrameColor?: string;
  canvasBgColor?: string;
  agentTextColor?: string;
  promptTextColor?: string;
  lineBgPadding?: number;
  promptBottomOffset?: number;
};

const SVG_WIDTH = 960;
const SVG_HEIGHT = 960;
const CANVAS_FRAME_SIZE = 16;
const CANVAS_FRAME_COLOR = "#181818";
const CANVAS_FRAME_OUTER_WIDTH = SVG_WIDTH + CANVAS_FRAME_SIZE * 2;
const CANVAS_FRAME_OUTER_HEIGHT = SVG_HEIGHT + CANVAS_FRAME_SIZE * 2;
const AGENT_X = 480;
const AGENT_TARGET_WIDTH = 784;
const AGENT_BASE_FONT = 44;
const AGENT_MIN_FONT = 44;
const LINE_FRAME_RADIUS = 4;
const AGENT_BG = { x: 87, y: 378, width: 786, height: 70, radius: LINE_FRAME_RADIUS };
const AGENT_CLIP = { x: 88, y: 378, width: 784, height: 70, radius: LINE_FRAME_RADIUS };
const AGENT_TEXT_Y = 413;
const AGENT_FRAME_STROKE_WIDTH = 1;
const PROMPT_X = 480;
const PROMPT_TARGET_WIDTH = 484;
const PROMPT_BASE_FONT = 16;
const PROMPT_MIN_FONT = 16;
const PROMPT_BG = { x: 237, y: 868, width: 486, height: 44, radius: LINE_FRAME_RADIUS };
const PROMPT_CLIP = { x: 238, y: 868, width: 484, height: 44, radius: LINE_FRAME_RADIUS };
const PROMPT_TEXT_Y = 890;
const DEFAULT_CANVAS_BG = "#000000";
const DEFAULT_AGENT_TEXT = "#ffffff";
const DEFAULT_PROMPT_TEXT = "#ffffff";
const DEFAULT_AGENT_BG = DEFAULT_CANVAS_BG;
const DEFAULT_AGENT_FRAME = "#ffffff";
const CAROUSEL_MIN_GAP = 240;
const CAROUSEL_FONT_GAP_MULTIPLIER = 6;

const PROMPT_MAX_BYTES = 1024;
const AGENT_MAX_BYTES = 1024;
const PROMPT_MAX_UNITS = 960;
const AGENT_MAX_UNITS = 960;

const FONT_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Noto Sans Mono', 'Noto Sans Mono CJK SC', 'Noto Sans Mono CJK JP', 'Noto Sans Mono CJK KR', 'Noto Sans', monospace, sans-serif";

const encoder = new TextEncoder();

export const THOUGHT_V2_ARTIFACT = {
  artifactId: "thought-v2-thin-line-frames-20260703T024833Z",
  channel: "experimental",
  manifestSha256: "c309e69e96e82f45b1b992933aa1e679ada29961599a8c7d7689b19816546b9e",
  files: {
    "render-contract.json": "78ac533df66a1c5fab76d2b672a2cb31671364a0155e2fccc5c8393aae610832",
    "reference/thought-v2-renderer.ts": "bb8ca6e4f53f925f04db44161267f9e68a8b7ada6082df0abde471e95bfa72fc",
    "reference/thought-v2-fixtures.ts": "b21d29494b21f17c016068ea2dc2d3a53bbbf1a2d1c64f209667343ee7234206",
    "samples/default.svg": "730ebb82303675cfe46da220188d406a02ac329f2722b31151a7812032bea2bb",
  },
} as const;

export const THOUGHT_V2_RENDER_CONTRACT = {
  schemaVersion: 1,
  canvas: {
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
    defaultBg: DEFAULT_CANVAS_BG,
    frame: {
      width: CANVAS_FRAME_SIZE,
      defaultColor: CANVAS_FRAME_COLOR,
      outerWidth: CANVAS_FRAME_OUTER_WIDTH,
      outerHeight: CANVAS_FRAME_OUTER_HEIGHT,
    },
  },
  fontFamily: FONT_STACK,
  agentLine: {
    targetWidth: AGENT_TARGET_WIDTH,
    defaultFontSize: AGENT_BASE_FONT,
    defaultTextColor: DEFAULT_AGENT_TEXT,
    defaultBgColor: DEFAULT_AGENT_BG,
    defaultFrameColor: DEFAULT_AGENT_FRAME,
    bg: AGENT_BG,
    clip: AGENT_CLIP,
    frameStrokeWidth: AGENT_FRAME_STROKE_WIDTH,
    text: {
      x: AGENT_X,
      y: AGENT_TEXT_Y,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
  },
  promptLine: {
    targetWidth: PROMPT_TARGET_WIDTH,
    defaultFontSize: PROMPT_BASE_FONT,
    defaultTextColor: DEFAULT_PROMPT_TEXT,
    bg: PROMPT_BG,
    clip: PROMPT_CLIP,
    text: {
      x: PROMPT_X,
      y: PROMPT_TEXT_Y,
      textAnchor: "middle",
      dominantBaseline: "middle",
    },
  },
  carousel: {
    minGap: CAROUSEL_MIN_GAP,
    fontGapMultiplier: CAROUSEL_FONT_GAP_MULTIPLIER,
    minDurationSeconds: 14,
    pixelsPerSecond: 80,
  },
} as const;

export const THOUGHT_V2_LIMITS = {
  promptMaxBytes: PROMPT_MAX_BYTES,
  agentMaxBytes: AGENT_MAX_BYTES,
  promptMaxUnits: PROMPT_MAX_UNITS,
  agentMaxUnits: AGENT_MAX_UNITS,
} as const;

export const THOUGHT_V2_CANVAS_SIZE = SVG_WIDTH;
export const THOUGHT_V2_DEFAULT_AGENT_BG = DEFAULT_AGENT_BG;
export const THOUGHT_V2_DEFAULT_AGENT_FRAME = DEFAULT_AGENT_FRAME;
export const THOUGHT_V2_DEFAULT_PROMPT_TEXT = DEFAULT_PROMPT_TEXT;

export const thoughtV2DefaultAgentLineBox = (): {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  textY: number;
  frameColor: string;
  frameStrokeWidth: number;
} => ({
  x: AGENT_BG.x,
  y: AGENT_BG.y,
  width: AGENT_BG.width,
  height: AGENT_BG.height,
  rx: AGENT_BG.radius,
  textY: AGENT_TEXT_Y,
  frameColor: DEFAULT_AGENT_FRAME,
  frameStrokeWidth: AGENT_FRAME_STROKE_WIDTH,
});

export const thoughtV2DefaultPromptLineBox = (): {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  textY: number;
  frameColor: string;
  frameStrokeWidth: number;
} => ({
  x: PROMPT_BG.x,
  y: PROMPT_BG.y,
  width: PROMPT_BG.width,
  height: PROMPT_BG.height,
  rx: PROMPT_BG.radius,
  textY: PROMPT_TEXT_Y,
  frameColor: DEFAULT_PROMPT_TEXT,
  frameStrokeWidth: 1,
});

export const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const escapeXmlAttribute = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const isRejectedSpace = (codepoint: number): boolean =>
  codepoint === 0x00a0 ||
  codepoint === 0x1680 ||
  codepoint === 0x180e ||
  (codepoint >= 0x2000 && codepoint <= 0x200a) ||
  codepoint === 0x2028 ||
  codepoint === 0x2029 ||
  codepoint === 0x202f ||
  codepoint === 0x205f ||
  codepoint === 0x3000;

const isInvisibleControl = (codepoint: number): boolean =>
  (codepoint >= 0x200b && codepoint <= 0x200f) ||
  (codepoint >= 0x202a && codepoint <= 0x202e) ||
  (codepoint >= 0x2060 && codepoint <= 0x206f) ||
  codepoint === 0xfeff;

const displayUnitsOf = (codepoint: number): number => {
  if (codepoint >= 0x21 && codepoint <= 0x7e) return 6;
  if (
    (codepoint >= 0x1100 && codepoint <= 0x11ff) ||
    (codepoint >= 0x2e80 && codepoint <= 0xa4cf) ||
    (codepoint >= 0xac00 && codepoint <= 0xd7af) ||
    (codepoint >= 0xf900 && codepoint <= 0xfaff) ||
    (codepoint >= 0xfe10 && codepoint <= 0xfe6f) ||
    (codepoint >= 0xff00 && codepoint <= 0xffef) ||
    (codepoint >= 0x20000 && codepoint <= 0x3fffd)
  ) {
    return 10;
  }
  return 8;
};

export const measureThoughtV2Line = (value: string, kind: ThoughtV2LineKind): ThoughtV2Measure => {
  const errors: string[] = [];
  const byteLength = encoder.encode(value).length;
  const maxBytes = kind === "prompt" ? PROMPT_MAX_BYTES : AGENT_MAX_BYTES;
  const maxUnits = kind === "prompt" ? PROMPT_MAX_UNITS : AGENT_MAX_UNITS;

  if (byteLength === 0) errors.push(`${kind} line is empty`);
  if (byteLength > maxBytes) errors.push(`${kind} line is ${byteLength}/${maxBytes} bytes`);

  let displayUnits = 0;
  let index = 0;
  let previousWasSpace = false;
  for (const char of value) {
    const codepoint = char.codePointAt(0);
    if (codepoint === undefined) continue;

    if (codepoint >= 0xd800 && codepoint <= 0xdfff) {
      errors.push(`${kind} line contains an invalid surrogate`);
      index += char.length;
      continue;
    }

    if (codepoint === 0x20) {
      if (index === 0 || index + char.length === value.length || previousWasSpace) {
        errors.push(`${kind} line has invalid spacing`);
      }
      previousWasSpace = true;
      displayUnits += 4;
      index += char.length;
      continue;
    }

    previousWasSpace = false;
    if (codepoint <= 0x1f || codepoint === 0x7f || (codepoint >= 0x80 && codepoint <= 0x9f)) {
      errors.push(`${kind} line contains a control character U+${codepoint.toString(16).toUpperCase()}`);
    }
    if (isRejectedSpace(codepoint) || isInvisibleControl(codepoint)) {
      errors.push(`${kind} line contains disallowed character U+${codepoint.toString(16).toUpperCase()}`);
    }
    displayUnits += displayUnitsOf(codepoint);
    index += char.length;
  }

  if (displayUnits > maxUnits) errors.push(`${kind} line is ${displayUnits}/${maxUnits} display units`);

  return { byteLength, displayUnits, errors };
};

const fontSize = (
  displayUnits: number,
  targetWidth: number,
  baseFont: number,
  minFont: number,
): { size: number; squeezed: boolean } => {
  const fit = Math.floor((targetWidth * 10) / displayUnits);
  if (fit >= baseFont) return { size: baseFont, squeezed: false };
  if (fit < minFont) return { size: minFont, squeezed: true };
  return { size: fit, squeezed: true };
};

const explicitFontSize = (
  displayUnits: number,
  targetWidth: number,
  explicitSize: number | undefined,
): { size: number; squeezed: boolean } | null => {
  if (explicitSize === undefined || !Number.isFinite(explicitSize) || explicitSize <= 0) return null;
  const size = Math.floor(explicitSize);
  return {
    size,
    squeezed: (displayUnits * size) / 10 > targetWidth,
  };
};

const normalizePaint = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  return fallback;
};

const rawLineVisualWidth = (displayUnits: number, fontSizeValue: number) =>
  Math.ceil((displayUnits * fontSizeValue) / 10);

const rectNumber = (value: number): string => {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
};

const indentLines = (value: string, spaces: string): string =>
  value
    .split("\n")
    .map((line) => `${spaces}${line}`)
    .join("\n");

const carouselTextLine = (
  baseId: string,
  displayUnits: number,
  x: number,
  y: number,
  targetWidth: number,
  clipId: string,
  clipX: number,
  font: { size: number },
  fill: string,
  value: string,
  dominantBaseline = "middle",
): string => {
  const textWidth = rawLineVisualWidth(displayUnits, font.size);
  if (textWidth <= targetWidth) {
    return textLine(baseId, x, y, clipId, font, fill, value, dominantBaseline);
  }

  const gap = Math.max(CAROUSEL_MIN_GAP, font.size * CAROUSEL_FONT_GAP_MULTIPLIER);
  const travel = textWidth + gap;
  const duration = Math.max(14, Math.ceil(travel / 80));
  const textAttrs = `y="${rectNumber(y)}" dominant-baseline="${dominantBaseline}" font-family="${escapeXmlAttribute(
    FONT_STACK,
  )}" font-size="${font.size}" fill="${escapeXml(fill)}" clip-path="url(#${clipId})"`;
  const escapedValue = escapeXml(value);
  const startX = rectNumber(clipX);
  const endX = rectNumber(clipX - travel);
  const copyX = rectNumber(clipX + travel);
  return [
    `<g id="${baseId.replace("-text", "-carousel")}">`,
    `  <text id="${baseId}" x="${startX}" ${textAttrs}>${escapedValue}<animate attributeName="x" values="${startX};${endX}" dur="${duration}s" repeatCount="indefinite"/></text>`,
    `  <text id="${baseId}-copy" x="${copyX}" ${textAttrs}>${escapedValue}<animate attributeName="x" values="${copyX};${startX}" dur="${duration}s" repeatCount="indefinite"/></text>`,
    `</g>`,
  ].join("\n");
};

const textLine = (
  id: string,
  x: number,
  y: number,
  clipId: string,
  font: { size: number },
  fill: string,
  value: string,
  dominantBaseline = "middle",
): string =>
  `<text id="${id}" x="${rectNumber(x)}" y="${rectNumber(
    y,
  )}" text-anchor="middle" dominant-baseline="${dominantBaseline}" font-family="${escapeXmlAttribute(
    FONT_STACK,
  )}" font-size="${font.size}" fill="${escapeXml(fill)}" clip-path="url(#${clipId})">${escapeXml(value)}</text>`;

export const buildThoughtV2Svg = ({
  promptLine,
  agentLine,
  agentFontSize,
  promptFontSize,
  agentFrameColor,
  canvasFrameColor,
  canvasBgColor,
  agentTextColor,
  promptTextColor,
}: ThoughtV2SvgInput): string => {
  const promptMeasure = measureThoughtV2Line(promptLine, "prompt");
  const agentMeasure = measureThoughtV2Line(agentLine, "agent");
  const promptErrors = promptLine.length === 0
    ? promptMeasure.errors.filter((error) => error !== "prompt line is empty")
    : promptMeasure.errors;
  const errors = [...promptErrors, ...agentMeasure.errors];
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const agentFont =
    explicitFontSize(agentMeasure.displayUnits, AGENT_TARGET_WIDTH, agentFontSize) ??
    fontSize(agentMeasure.displayUnits, AGENT_TARGET_WIDTH, AGENT_BASE_FONT, AGENT_MIN_FONT);
  const promptFont =
    explicitFontSize(promptMeasure.displayUnits, PROMPT_TARGET_WIDTH, promptFontSize) ??
    fontSize(promptMeasure.displayUnits, PROMPT_TARGET_WIDTH, PROMPT_BASE_FONT, PROMPT_MIN_FONT);
  const canvasBg = normalizePaint(canvasBgColor, DEFAULT_CANVAS_BG);
  const agentText = normalizePaint(agentTextColor, DEFAULT_AGENT_TEXT);
  const promptText = normalizePaint(promptTextColor, DEFAULT_PROMPT_TEXT);
  const agentFrame = normalizePaint(agentFrameColor, agentText || DEFAULT_AGENT_FRAME);
  const canvasFrame = normalizePaint(canvasFrameColor, CANVAS_FRAME_COLOR);

  const agentLineSvg = carouselTextLine(
    "agent-line-text",
    agentMeasure.displayUnits,
    AGENT_X,
    AGENT_TEXT_Y,
    AGENT_TARGET_WIDTH,
    "agent-line-clip",
    AGENT_CLIP.x,
    agentFont,
    agentText,
    agentLine,
  );
  const promptLineSvg = carouselTextLine(
    "prompt-line-text",
    promptMeasure.displayUnits,
    PROMPT_X,
    PROMPT_TEXT_Y,
    PROMPT_TARGET_WIDTH,
    "prompt-line-clip",
    PROMPT_CLIP.x,
    promptFont,
    promptText,
    promptLine,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_FRAME_OUTER_WIDTH}" height="${CANVAS_FRAME_OUTER_HEIGHT}" viewBox="0 0 ${CANVAS_FRAME_OUTER_WIDTH} ${CANVAS_FRAME_OUTER_HEIGHT}">`,
    `  <rect id="canvas-frame" width="${CANVAS_FRAME_OUTER_WIDTH}" height="${CANVAS_FRAME_OUTER_HEIGHT}" fill="${escapeXml(canvasFrame)}"/>`,
    `  <svg id="thought-canvas" x="${CANVAS_FRAME_SIZE}" y="${CANVAS_FRAME_SIZE}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`,
    `    <rect id="canvas-bg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="${escapeXml(canvasBg)}"/>`,
    ``,
    `    <defs>`,
    `      <clipPath id="agent-line-clip">`,
    `        <rect x="${AGENT_CLIP.x}" y="${AGENT_CLIP.y}" width="${AGENT_CLIP.width}" height="${AGENT_CLIP.height}" rx="${AGENT_CLIP.radius}"/>`,
    `      </clipPath>`,
    `      <clipPath id="prompt-line-clip">`,
    `        <rect x="${PROMPT_CLIP.x}" y="${PROMPT_CLIP.y}" width="${PROMPT_CLIP.width}" height="${PROMPT_CLIP.height}" rx="${PROMPT_CLIP.radius}"/>`,
    `      </clipPath>`,
    `    </defs>`,
    ``,
    `    <g id="agent-line-area">`,
    `      <rect id="agent-line-bg" x="${AGENT_BG.x}" y="${AGENT_BG.y}" width="${AGENT_BG.width}" height="${AGENT_BG.height}" rx="${AGENT_BG.radius}" fill="${escapeXml(canvasBg)}" stroke="${escapeXml(agentFrame)}" stroke-width="${AGENT_FRAME_STROKE_WIDTH}"/>`,
    indentLines(agentLineSvg, "      "),
    `    </g>`,
    ``,
    `    <g id="prompt-line-area">`,
    `      <rect id="prompt-line-bg" x="${PROMPT_BG.x}" y="${PROMPT_BG.y}" width="${PROMPT_BG.width}" height="${PROMPT_BG.height}" rx="${PROMPT_BG.radius}" fill="${escapeXml(canvasBg)}" stroke="${escapeXml(promptText)}" stroke-width="1"/>`,
    indentLines(promptLineSvg, "      "),
    `    </g>`,
    `  </svg>`,
    `</svg>`,
  ].join("\n");
};
