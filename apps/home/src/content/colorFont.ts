export const COLOR_FONT_REPOSITORY_URL =
  "https://github.com/inshell-art/inshell.art/blob/main/spec/COLOR_FONT.v1.json";

export const COLOR_FONT_GLYPHS = [
  { letter: "A", index: 1, name: "aqua", hex: "#00ffff" },
  { letter: "B", index: 2, name: "blue", hex: "#0000ff" },
  { letter: "C", index: 3, name: "coffee", hex: "#6f4e37" },
  { letter: "D", index: 4, name: "denim", hex: "#6699ff" },
  { letter: "E", index: 5, name: "eggshell", hex: "#fff9e3" },
  { letter: "F", index: 6, name: "fuchsia", hex: "#ff00ff" },
  { letter: "G", index: 7, name: "green", hex: "#008000" },
  { letter: "H", index: 8, name: "honey", hex: "#ffcc00" },
  { letter: "I", index: 9, name: "indigo", hex: "#4b0082" },
  { letter: "J", index: 10, name: "jade green", hex: "#00a86b" },
  { letter: "K", index: 11, name: "khaki", hex: "#c3b091" },
  { letter: "L", index: 12, name: "lime", hex: "#00ff00" },
  { letter: "M", index: 13, name: "maroon", hex: "#800000" },
  { letter: "N", index: 14, name: "navy", hex: "#0a1172" },
  { letter: "O", index: 15, name: "orange", hex: "#ffa500" },
  { letter: "P", index: 16, name: "pink", hex: "#ffaadd" },
  { letter: "Q", index: 17, name: "quicksilver", hex: "#a6a6a6" },
  { letter: "R", index: 18, name: "red", hex: "#ff0000" },
  { letter: "S", index: 19, name: "salmon", hex: "#fa8072" },
  { letter: "T", index: 20, name: "teal", hex: "#008080" },
  { letter: "U", index: 21, name: "ultramarine", hex: "#5533ff" },
  { letter: "V", index: 22, name: "violet", hex: "#aa55ff" },
  { letter: "W", index: 23, name: "wheat", hex: "#f5deb3" },
  { letter: "X", index: 24, name: "xray", hex: "#bbcccc" },
  { letter: "Y", index: 25, name: "yellow", hex: "#ffff00" },
  { letter: "Z", index: 26, name: "zombie gray", hex: "#778877" },
] as const;

export const COLOR_FONT_RAW = COLOR_FONT_GLYPHS.map(
  ({ letter, index, name, hex }) => `${letter}:${index}:${name}:${hex}`
).join("\n");

export const COLOR_FONT = {
  title: "color font",
  subtitle: "Contract-defined A-Z color glyph system.",
  id: "inshell.colorfont.v1",
  version: "v1",
  hash: "0x5d16e42e857c3d93524b679426a87d59ec414466b581a904a72992d64c21a12f",
  format: "LETTER:INDEX:ALIAS_TERM:HEX",
  mirror: "GitHub COLOR_FONT.v1.json",
  repositoryUrl: COLOR_FONT_REPOSITORY_URL,
  copy: [
    "The color rectangle is the glyph.",
    "The color font is the typeface.",
    "A-Z map to fixed contract-defined colors.",
    "Text becomes color, rhythm, density, and gap.",
  ],
  raw: COLOR_FONT_RAW,
  glyphs: COLOR_FONT_GLYPHS,
} as const;
