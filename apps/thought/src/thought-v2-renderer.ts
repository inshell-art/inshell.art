import mono76 from "../contract-release/releases/thought-v2-canonical-portable-release-20260807-r2/dependencies/mono-76/glyphs.json";
import {
  escapeXml,
  measureThoughtV2Line,
  THOUGHT_V2_ARTIFACT,
  THOUGHT_V2_LIMITS,
  THOUGHT_V2_RENDER_CONTRACT,
} from "@inshell/shared";
import type { ThoughtV2LineKind, ThoughtV2Measure, ThoughtV2SvgInput } from "@inshell/shared";

export { escapeXml, measureThoughtV2Line, THOUGHT_V2_ARTIFACT, THOUGHT_V2_LIMITS, THOUGHT_V2_RENDER_CONTRACT };
export type { ThoughtV2LineKind, ThoughtV2Measure, ThoughtV2SvgInput };

const glyphs = new Map(mono76.glyphs.map((glyph) => [glyph.character, glyph]));
const MAX_COLUMNS = 29;
const ADVANCE = mono76.metrics.fixedAdvanceWidth;
const SCALE = 2.88;
const wrapLine = (value: string) => {
  const rows: string[] = [];
  let row = "";
  for (const word of value.split(" ")) {
    if (word.length > MAX_COLUMNS) {
      if (row) rows.push(row);
      row = "";
      for (let index = 0; index < word.length; index += MAX_COLUMNS) {
        const chunk = word.slice(index, index + MAX_COLUMNS);
        if (chunk.length === MAX_COLUMNS || index + MAX_COLUMNS < word.length) rows.push(chunk);
        else row = chunk;
      }
      continue;
    }
    const next = row ? `${row} ${word}` : word;
    if (next.length > MAX_COLUMNS) {
      rows.push(row);
      row = word;
    } else row = next;
  }
  if (row || rows.length === 0) rows.push(row);
  return rows;
};
const renderRows = (rows: string[], field: "prompt" | "agent") => rows.map((row, rowIndex) => {
  const width = row.length * ADVANCE * SCALE;
  const x = field === "prompt" ? 57.6 + 844.8 - width : 57.6;
  const y = field === "prompt" ? 171.52 + rowIndex * 64 : 811.52 - (rows.length - rowIndex - 1) * 64;
  const uses = [...row].map((character, index) => {
    if (character === " ") return "";
    const glyph = glyphs.get(character);
    return glyph ? `<use href="#g-${character.codePointAt(0)!.toString(16)}" x="${index * ADVANCE + mono76.composition.defaultOriginShiftX}"/>` : "";
  }).join("");
  return `<g transform="translate(${x} ${y}) scale(${SCALE} -${SCALE})">${uses}</g>`;
}).join("");
export const buildThoughtV2Svg = ({ promptLine, agentLine }: ThoughtV2SvgInput): string => {
  const promptRows = wrapLine(promptLine);
  const agentRows = wrapLine(agentLine);
  const defs = [...glyphs.entries()].filter(([character]) => character !== " ").map(([character, glyph]) => `<path id="g-${character.codePointAt(0)!.toString(16)}" d="${escapeXml(glyph.d)}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" data-renderer="inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom"><rect id="work-frame" width="1024" height="1024" fill="#006100"/><g id="work-canvas" transform="translate(32 32)"><rect id="canvas-bg" width="960" height="960" fill="#000000"/><defs>${defs}</defs><g id="prompt-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="${escapeXml(promptLine)}" data-rows="${promptRows.length}">${renderRows(promptRows, "prompt")}</g><g id="agent-line" fill="none" stroke="#00ff00" stroke-width="1.23" stroke-linecap="round" stroke-linejoin="round" data-source="${escapeXml(agentLine)}" data-rows="${agentRows.length}">${renderRows(agentRows, "agent")}</g></g></svg>`;
};
