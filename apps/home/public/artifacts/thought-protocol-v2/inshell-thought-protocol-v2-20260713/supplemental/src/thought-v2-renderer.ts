import {
  BINARY_FIELD_BITS,
  binaryFieldBits,
  binaryFieldPackedHex,
  MAX_AGENT_LINE_BYTES,
  MAX_AGENT_LINE_DISPLAY_UNITS,
  MAX_PROMPT_LINE_BYTES,
  MAX_PROMPT_LINE_DISPLAY_UNITS,
  measureThoughtLine,
  THOUGHT_RENDERER_ID,
  type ThoughtLineKind,
  type ThoughtLineMeasure,
} from "./thought-v2-protocol";

export type ThoughtV2LineKind = ThoughtLineKind;
export type ThoughtV2Measure = ThoughtLineMeasure;

export type ThoughtV2SvgInput = {
  promptLine: string;
  agentLine: string;
};

const SVG_WIDTH = 960;
const SVG_HEIGHT = 960;
const CANVAS_BG = "#000000";
const FIELD_COLOR = "#006100";
const FIELD_X = 96;
const FIELD_Y = 96;
const FIELD_WIDTH = 768;
const FIELD_HEIGHT = 768;
const FIELD_SIDE = 32;
const CELL_SIZE = 24;
const ONE_RADIUS = 6;
const ZERO_RADIUS = 7;
const ZERO_STROKE = 2;
const AGENT_BOX = { x: 96, y: 384, width: 768, height: 72, radius: 9 };
const AGENT_TEXT = { x: 480, y: 420, size: 44 };
const PROMPT_BOX = { x: 144, y: 816, width: 672, height: 48, radius: 9 };
const PROMPT_TEXT = { x: 480, y: 840, size: 16 };
const CAROUSEL_MIN_GAP = 240;
const CAROUSEL_FONT_GAP_MULTIPLIER = 6;
const FONT_STACK =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Noto Sans Mono', 'Noto Sans Mono CJK SC', 'Noto Sans Mono CJK JP', 'Noto Sans Mono CJK KR', 'Noto Sans', monospace, sans-serif";

export const THOUGHT_V2_RENDER_CONTRACT = {
  schemaVersion: 2,
  rendererId: THOUGHT_RENDERER_ID,
  canvas: { width: SVG_WIDTH, height: SVG_HEIGHT, defaultBg: CANVAS_BG },
  fontFamily: FONT_STACK,
  binaryBackground: {
    sourceOrder: ["promptLine", "agentLine"],
    sourceFit: "cycle-or-truncate-each-to-512-msb-first",
    interleave: "P0-A0-through-P511-A511",
    packedBytes: 128,
    encoding: "utf-8",
    layout: "fixed-32x32-row-major",
    x: FIELD_X,
    y: FIELD_Y,
    width: FIELD_WIDTH,
    height: FIELD_HEIGHT,
    side: FIELD_SIDE,
    capacity: BINARY_FIELD_BITS,
    fillRule: "independent-512-cycle-truncate-interleave",
    glyphs: { one: "filled circle", zero: "hollow ring" },
    cell: { width: CELL_SIZE, height: CELL_SIZE, oneRadius: ONE_RADIUS, zeroRadius: ZERO_RADIUS, zeroStroke: ZERO_STROKE },
    fill: FIELD_COLOR,
    opacity: 1,
  },
  agentLine: {
    targetWidth: AGENT_BOX.width,
    defaultFontSize: AGENT_TEXT.size,
    minFontSize: AGENT_TEXT.size,
    defaultTextColor: "#ffffff",
    defaultBgColor: CANVAS_BG,
    bg: AGENT_BOX,
    clip: AGENT_BOX,
    text: { ...AGENT_TEXT, textAnchor: "middle", dominantBaseline: "middle" },
    overflow: "svg-animate-carousel",
  },
  promptLine: {
    targetWidth: PROMPT_BOX.width,
    defaultFontSize: PROMPT_TEXT.size,
    minFontSize: PROMPT_TEXT.size,
    defaultTextColor: "#ffffff",
    defaultBgColor: CANVAS_BG,
    bg: PROMPT_BOX,
    clip: PROMPT_BOX,
    text: { ...PROMPT_TEXT, textAnchor: "middle", dominantBaseline: "middle" },
    overflow: "svg-animate-carousel",
  },
  carousel: { minGap: CAROUSEL_MIN_GAP, fontGapMultiplier: CAROUSEL_FONT_GAP_MULTIPLIER, minDurationSeconds: 14, pixelsPerSecond: 80 },
} as const;

export const THOUGHT_V2_LIMITS = {
  promptMaxBytes: MAX_PROMPT_LINE_BYTES,
  agentMaxBytes: MAX_AGENT_LINE_BYTES,
  promptMaxUnits: MAX_PROMPT_LINE_DISPLAY_UNITS,
  agentMaxUnits: MAX_AGENT_LINE_DISPLAY_UNITS,
} as const;

export {
  MAX_AGENT_LINE_BYTES,
  MAX_AGENT_LINE_DISPLAY_UNITS,
  MAX_PROMPT_LINE_BYTES,
  MAX_PROMPT_LINE_DISPLAY_UNITS,
};

export const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const measureThoughtV2Line = measureThoughtLine;
export const fixedBinaryFieldOf = binaryFieldBits;
export { binaryFieldPackedHex };

const visualWidth = (displayUnits: number, fontSize: number): number =>
  Math.ceil((displayUnits * fontSize) / 10);

const carouselId = (baseId: string): string => baseId.replace("-text", "-carousel");

const textLine = (
  baseId: string,
  displayUnits: number,
  x: number,
  y: number,
  width: number,
  clipId: string,
  clipX: number,
  fontSize: number,
  value: string,
): string => {
  const escaped = escapeXml(value);
  const textWidth = visualWidth(displayUnits, fontSize);
  if (textWidth <= width) {
    return `<text id="${baseId}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_STACK}" font-size="${fontSize}" fill="#ffffff" clip-path="url(#${clipId})">${escaped}</text>`;
  }

  const gap = Math.max(CAROUSEL_MIN_GAP, fontSize * CAROUSEL_FONT_GAP_MULTIPLIER);
  const travel = textWidth + gap;
  const duration = Math.max(14, Math.ceil(travel / 80));
  const copyX = clipX + travel;
  const attrs = `y="${y}" dominant-baseline="middle" font-family="${FONT_STACK}" font-size="${fontSize}" fill="#ffffff" clip-path="url(#${clipId})"`;
  const first = `<text id="${baseId}" x="${clipX}" ${attrs}>${escaped}<animate attributeName="x" values="${clipX};-${travel - clipX}" dur="${duration}s" repeatCount="indefinite"/></text>`;
  const copy = `<text id="${baseId}-copy" x="${copyX}" ${attrs}>${escaped}<animate attributeName="x" values="${copyX};${clipX}" dur="${duration}s" repeatCount="indefinite"/></text>`;
  return `<g id="${carouselId(baseId)}">${first}${copy}</g>`;
};

const binaryBackground = (promptLine: string, agentLine: string): string => {
  const bits = binaryFieldBits(promptLine, agentLine);
  const oneCount = bits.split("").filter((bit) => bit === "1").length;
  const uses: string[] = [];
  for (let index = 0; index < bits.length; index += 1) {
    if (bits[index] !== "1") continue;
    const column = index % FIELD_SIDE;
    const row = Math.floor(index / FIELD_SIDE);
    const x = FIELD_X + column * CELL_SIZE + CELL_SIZE / 2;
    const y = FIELD_Y + row * CELL_SIZE + CELL_SIZE / 2;
    uses.push(`<use href="#binary-one" x="${x}" y="${y}"/>`);
  }
  return `<g id="binary-background" opacity="1" fill="${FIELD_COLOR}" aria-label="Interleaved UTF-8 binary field: 512 prompt positions and 512 Agent positions; filled circles are one bits and hollow rings are zero bits" data-grid-columns="32" data-grid-rows="32" data-bit-capacity="1024" data-prompt-bit-positions="512" data-agent-bit-positions="512" data-one-cells="${oneCount}" data-zero-cells="${BINARY_FIELD_BITS - oneCount}" data-pack="msb-first-128-bytes" data-cell-size="24" data-origin-x="96" data-origin-y="96"><defs><circle id="binary-one" r="6" fill="${FIELD_COLOR}"/><pattern id="binary-zero-pattern" x="96" y="96" width="24" height="24" patternUnits="userSpaceOnUse"><circle id="binary-zero" cx="12" cy="12" r="7" fill="none" stroke="${FIELD_COLOR}" stroke-width="2"/></pattern></defs><rect id="binary-zero-field" x="96" y="96" width="768" height="768" fill="url(#binary-zero-pattern)"/>${uses.join("")}<rect id="agent-text-clear" x="96" y="384" width="768" height="72" fill="${CANVAS_BG}"/><rect id="prompt-text-clear" x="144" y="816" width="672" height="48" fill="${CANVAS_BG}"/></g>`;
};

export const buildThoughtV2Svg = ({ promptLine, agentLine }: ThoughtV2SvgInput): string => {
  const prompt = measureThoughtLine(promptLine, "prompt");
  const agent = measureThoughtLine(agentLine, "agent");
  const errors = [...prompt.errors, ...agent.errors];
  if (errors.length > 0) throw new Error(errors.join("; "));

  const agentText = textLine("agent-line-text", agent.displayUnits, AGENT_TEXT.x, AGENT_TEXT.y, AGENT_BOX.width, "agent-line-clip", AGENT_BOX.x, AGENT_TEXT.size, agentLine);
  const promptText = textLine("prompt-line-text", prompt.displayUnits, PROMPT_TEXT.x, PROMPT_TEXT.y, PROMPT_BOX.width, "prompt-line-clip", PROMPT_BOX.x, PROMPT_TEXT.size, promptLine);
  const clips = `<defs><clipPath id="agent-line-clip"><rect x="96" y="384" width="768" height="72" rx="9"/></clipPath><clipPath id="prompt-line-clip"><rect x="144" y="816" width="672" height="48" rx="9"/></clipPath></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="960" viewBox="0 0 960 960"><rect id="canvas-bg" width="960" height="960" fill="${CANVAS_BG}"/>${binaryBackground(promptLine, agentLine)}${clips}<g id="agent-line-area">${agentText}</g><g id="prompt-line-area">${promptText}</g></svg>`;
};
