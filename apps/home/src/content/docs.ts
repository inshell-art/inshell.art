import { PULSE } from "./pulse";
import mono76Face from "../../../thought/contract-release/releases/thought-v2-canonical-portable-release-20260807-r2/dependencies/mono-76/glyphs.json";

export type DocsAuthority =
  | "artist-editorial"
  | "app-documentation"
  | "app-record"
  | "contract-release"
  | "chain-observation"
  | "runtime-report";

export type DocsLink = {
  label: string;
  href: string;
};

export type DocsParagraph = string | Array<string | DocsLink>;

export type DocsSourceExample = {
  label: string;
  language: "svg";
  content: string;
  presentation?: "artwork" | "specimen";
  showSource?: boolean;
};

export type DocsGroupId = "orientation" | "works" | "systems" | "context";

export type DocsGroup = {
  id: DocsGroupId;
  title: string;
  summary: string;
  topicSlugs: string[];
};

export type DocsSection = {
  id: string;
  title: string;
  figure?: DocsFigure;
  paragraphs?: DocsParagraph[];
  points?: string[];
  steps?: string[];
  note?: string;
  sourceExamples?: DocsSourceExample[];
};

export const DOCS_FIGURE_MODES = ["trace", "ledger", "lanes", "field"] as const;

export type DocsFigureMode = (typeof DOCS_FIGURE_MODES)[number];

export type DocsFigureItem = {
  title: string;
  detail?: string;
};

export type DocsLaneFigureItem = DocsFigureItem & {
  stage: number;
  lane: string;
  phase?: string;
};

type DocsFigureBase<Mode extends DocsFigureMode, Item extends DocsFigureItem> = {
  id: string;
  label: string;
  mode: Mode;
  figureText: string;
  items: Item[];
};

export type DocsFigure =
  | (DocsFigureBase<"trace", DocsFigureItem> & {
      loop?: {
        to: number;
        condition: string;
      };
    })
  | DocsFigureBase<"ledger", DocsFigureItem>
  | DocsFigureBase<"lanes", DocsLaneFigureItem>
  | DocsFigureBase<"field", DocsFigureItem>;

export type DocsTopic = {
  slug: string;
  id: string;
  group: DocsGroupId;
  aliases?: string[];
  title: string;
  summary: string;
  status: "current" | "study" | "future";
  authorities: DocsAuthority[];
  paragraphs: DocsParagraph[];
  preformatted?: Array<{
    label: string;
    content: string;
  }>;
  figure?: DocsFigure;
  sections?: DocsSection[];
  links?: DocsLink[];
};

export type DocsSource = {
  schema: "inshell.docs.source.v2";
  version: string;
  title: string;
  subtitle: string;
  canonicalUrl: string;
  groups: DocsGroup[];
  topics: DocsTopic[];
};

const SOURCE_REPOSITORIES = {
  app: "https://github.com/inshell-art/inshell.art",
  path: "https://github.com/inshell-art/path",
  thought: "https://github.com/inshell-art/THOUGHT",
  pulse: "https://github.com/inshell-art/pulse",
} as const;

const PROVENANCE_SCHEMA_URL =
  "/protocol/releases/thought-provenance-v2-20260731-r1/thought.provenance.v2.schema.json";
const METADATA_SCHEMA_URL =
  "/protocol/releases/thought-metadata-namespace-v2-20260731-r1/thought.metadata-namespace.v2.schema.json";

function escapeSvgAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function mono76FullSetDemo() {
  const repertoire = mono76Face.repertoire;
  const rows = [
    repertoire.slice(0, 27),
    repertoire.slice(27, 53),
    repertoire.slice(53, 63),
    repertoire.slice(63),
  ];
  const glyphs = new Map(
    mono76Face.glyphs.map((glyph) => [glyph.character, glyph]),
  );
  const advance = mono76Face.metrics.fixedAdvanceWidth;
  const rowHeight = 18;
  const padding = 2;
  const viewWidth = Math.max(...rows.map((row) => row.length * advance)) + padding * 2;
  const viewHeight = rows.length * rowHeight + padding * 2;
  let recordIndex = 0;
  const records = rows.flatMap((row, rowIndex) => {
    const rowWidth = row.length * advance;
    const rowStartX = (viewWidth - rowWidth) / 2;
    return [...row].map((character, columnIndex) => {
      const glyph = glyphs.get(character);
      if (!glyph) {
        throw new Error(`Mono 76 is missing repertoire character ${character}`);
      }
      const currentIndex = recordIndex;
      recordIndex += 1;
      const characterLabel = character === " " ? "SPACE" : character;
      const path = glyph.d
        ? `<path d="${glyph.d}" transform="translate(${rowStartX + mono76Face.composition.defaultOriginShiftX + columnIndex * advance} ${padding + rowIndex * rowHeight + mono76Face.metrics.svgBaselineY}) scale(1 -1)"/>`
        : "";
      return `<g class="mono-76-record" data-record-index="${currentIndex}" data-character="${escapeSvgAttribute(characterLabel)}" data-draws-path="${glyph.d ? "true" : "false"}">${path}</g>`;
    });
  });

  if (recordIndex !== mono76Face.glyphs.length) {
    throw new Error("Mono 76 full-set demo does not contain every sealed record");
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="Mono 76 full set: SPACE, uppercase A through Z, lowercase a through z, digits 0 through 9, and punctuation" data-font="${mono76Face.family.name}" data-version="${mono76Face.release.version}" data-record-count="${mono76Face.glyphs.length}" data-visible-glyph-count="${mono76Face.glyphs.filter(({ d }) => Boolean(d)).length}">`,
    "<title>Mono 76 full set demo</title>",
    "<desc>The first record is SPACE and intentionally draws no path. The remaining 75 records are shown in sealed repertoire order.</desc>",
    `<rect width="${viewWidth}" height="${viewHeight}" fill="#000000"/>`,
    `<g fill="none" stroke="#00ff35" stroke-width="${mono76Face.renderStyle.strokeWidth}" stroke-linecap="${mono76Face.renderStyle.strokeLinecap}" stroke-linejoin="${mono76Face.renderStyle.strokeLinejoin}">`,
    ...records,
    "</g>",
    "</svg>",
  ].join("\n");
}

const MONO_76_FULL_SET_DEMO = mono76FullSetDemo();

const PATH_RAW_SVG_EXAMPLE = [
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600' role='img' aria-label='PATH movement progress' data-renderer='path-text-status' data-rendering='native-svg-paths' data-progress-model='text' data-family='Inshell Mono 76' data-face='Inshell Mono 76 Regular' data-weight='400' data-release-commit='6fefbfaf762dce0148fe275baafb8e7dd2077beb' data-manifest-sha256='14d734495a8bdc99a98fecbc4f9d76d315c9e2b9fc9b032d5a1fda567258ce11' data-glyph-json-sha256='2cf76834f82050853bdcc9d25bc4f040bd7cc2a6a310206e166f6d162e4f0c2e' data-glyph-slice-sha256='8f484b8c50307139630fab8c0289c0a6a642fa1aee5fb31ebd8966f574b02060' data-center-x='300' data-center-y='300'>",
  "<rect width='600' height='600' fill='#000000'/>",
  "<defs>",
  "<path id='g-T' d='M258 0L258 586L42 586L42 656L558 656L558 586L342 586L342 0Z'/>",
  "<path id='g-H' d='M79 0L79 656L163 656L163 381L437 381L437 656L521 656L521 0L437 0L437 309L163 309L163 0Z'/>",
  "<path id='g-O' d='M300 -12Q226 -12 169 29Q112 70 80 146.5Q48 223 48 331Q48 437 80 512.5Q112 588 169 628Q226 668 300 668Q374 668 431 628Q488 588 520 512.5Q552 437 552 331Q552 223 520 146.5Q488 70 431 29Q374 -12 300 -12ZM300 61Q375 61 420.5 133Q466 205 466 331Q466 455 420.5 525Q375 595 300 595Q225 595 179.5 525Q134 455 134 331Q134 205 179.5 133Q225 61 300 61Z'/>",
  "<path id='g-U' d='M301 -12Q237 -12 186.5 14Q136 40 107.5 97Q79 154 79 248L79 656L163 656L163 246Q163 178 181 137.5Q199 97 230.5 79Q262 61 301 61Q341 61 372 79Q403 97 421.5 137.5Q440 178 440 246L440 656L521 656L521 248Q521 154 492.5 97Q464 40 414.5 14Q365 -12 301 -12Z'/>",
  "<path id='g-G' d='M337 -12Q255 -12 190.5 28.5Q126 69 89.5 145Q53 221 53 328Q53 434 90.5 510Q128 586 193.5 627Q259 668 344 668Q409 668 453 642.5Q497 617 525 588L478 535Q454 561 422.5 578Q391 595 344 595Q283 595 237 562.5Q191 530 165.5 471Q140 412 140 330Q140 206 192.5 133.5Q245 61 342 61Q415 61 456 100L456 271L325 271L325 340L533 340L533 64Q502 33 451.5 10.5Q401 -12 337 -12Z'/>",
  "<path id='g-W' d='M110 0L10 657L104 657L152 245Q155 218 157.5 195.5Q160 173 162 149.5Q164 126 165 93L168 93Q174 126 179 149.5Q184 173 189 195Q194 217 200 244L264 488L344 488L406 244Q413 217 418 195Q423 173 427.5 149.5Q432 126 438 93L442 93Q444 126 445.5 149.5Q447 173 449 195Q451 217 454 244L500 657L590 657L494 0L390 0L326 264Q319 294 313 323Q307 352 302 382L299 382Q294 352 289 323Q284 294 276 264L212 0Z'/>",
  "<path id='g-I' d='M95 0L95 71L258 71L258 586L95 586L95 656L505 656L505 586L342 586L342 71L505 71L505 0Z'/>",
  "<path id='g-L' d='M134 0L134 656L216 656L216 71L541 71L541 0Z'/>",
  "<path id='g-A' d='M232 367L201 267L397 267L366 367Q349 422 332.5 476.5Q316 531 301 588L297 588Q281 531 265 476.5Q249 422 232 367ZM32 0L253 656L347 656L568 0L480 0L418 200L180 200L117 0Z'/>",
  "<clipPath id='path-progress' clipPathUnits='userSpaceOnUse'>",
  "<rect id='thought-progress' x='0' y='-240' width='4200' height='1000'/>",
  "<rect id='will-progress' x='4800' y='-240' width='1200' height='1000'/>",
  "<rect id='awa-progress' x='7800' y='-240' width='0' height='1000'/>",
  "</clipPath>",
  "</defs>",
  "<g id='path-title' data-text-layout='centered-group' fill-rule='nonzero' transform='translate(92.64 311.232) scale(0.0432 -0.0432)'>",
  "<g id='remaining' data-status-layer='remaining' fill='#ffffff'>",
  "<use href='#g-T'/>",
  "<use href='#g-H' x='600'/>",
  "<use href='#g-O' x='1200'/>",
  "<use href='#g-U' x='1800'/>",
  "<use href='#g-G' x='2400'/>",
  "<use href='#g-H' x='3000'/>",
  "<use href='#g-T' x='3600'/>",
  "<use href='#g-W' x='4800'/>",
  "<use href='#g-I' x='5400'/>",
  "<use href='#g-L' x='6000'/>",
  "<use href='#g-L' x='6600'/>",
  "<use href='#g-A' x='7800'/>",
  "<use href='#g-W' x='8400'/>",
  "<use href='#g-A' x='9000'/>",
  "</g>",
  "<g id='consumed' data-status-layer='consumed' fill='#006100' clip-path='url(#path-progress)'>",
  "<use href='#g-T'/>",
  "<use href='#g-H' x='600'/>",
  "<use href='#g-O' x='1200'/>",
  "<use href='#g-U' x='1800'/>",
  "<use href='#g-G' x='2400'/>",
  "<use href='#g-H' x='3000'/>",
  "<use href='#g-T' x='3600'/>",
  "<use href='#g-W' x='4800'/>",
  "<use href='#g-I' x='5400'/>",
  "<use href='#g-L' x='6000'/>",
  "<use href='#g-L' x='6600'/>",
  "<use href='#g-A' x='7800'/>",
  "<use href='#g-W' x='8400'/>",
  "<use href='#g-A' x='9000'/>",
  "</g>",
  "</g>",
  "</svg>",
].join("\n");

const THOUGHT_RAW_SVG_EXAMPLE = [
  "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1024\" height=\"1024\" viewBox=\"0 0 1024 1024\" role=\"img\" data-renderer=\"inshell.thought.renderer.v2.mono-76-v1-im76-native-paths-frame-32-006100-green-00ff00-prompt-top-agent-bottom\" data-glyph-library-member=\"inshell.mono-76\" data-glyph-format=\"IM76-v1\" data-glyph-release=\"v1.0.0\" data-glyph-svg-baseline=\"12\" data-glyph-scale=\"2.88\" data-glyph-origin-shift-x=\"1\" data-wrap=\"greedy-space-then-fixed-cell-overlong-word\" data-prompt-vertical-align=\"top\" data-agent-vertical-align=\"bottom\" aria-label=\"Prompt and Agent response in a terminal chat layout\">",
  "<rect id=\"work-frame\" width=\"1024\" height=\"1024\" fill=\"#006100\"/>",
  "<g id=\"work-canvas\" transform=\"translate(32 32)\">",
  "<rect id=\"canvas-bg\" width=\"960\" height=\"960\" fill=\"#000000\"/>",
  "<defs>",
  "<path id=\"g54\" d=\"M.5 9.9L7.5 9.9M4 9.9L4 .6\"/>",
  "<path id=\"g57\" d=\"M0 9.9L2 .6L4 7.2L6 .6L8 9.9\"/>",
  "<path id=\"g61\" d=\"M1.4 6.5Q2.9 7.5 4.45 7.6Q6.75 7.65 7 5.35L7 .3M6.95 4.65L3 4Q1.55 3.65 1.3 2.4Q1.3 .3 3.95 .45Q6 .5 6.95 2.2\"/>",
  "<path id=\"g62\" d=\"M1.3 .6L1.3 10.8M1.3 5.3Q2.3 7.35 4.4 7.4Q7.1 7.4 7.2 4Q7.2 .4 4.15 .4Q2.3 .4 1.3 2.1\"/>",
  "<path id=\"g63\" d=\"M6.9 6.3Q5.9 7.4 4 7.4Q1.2 7.4 1.1 3.9Q1.25 .45 4 .4Q5.8 .6 6.9 1.2\"/>",
  "<path id=\"g64\" d=\"M6.7 .6L6.7 10.8M6.7 5.3Q5.8 7.35 3.7 7.4Q.9 7.4 .8 3.9Q.9 .4 3.8 .4Q5.8 .4 6.7 2.1\"/>",
  "<path id=\"g65\" d=\"M1.2 4L6.9 4Q6.8 7.4 4.1 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q5.75 .45 6.9 1.2\"/>",
  "<path id=\"g66\" d=\"M3.6 .3L3.65 8.45Q3.65 10.95 5.85 10.95Q6.8 10.95 7.8 10.6M1.4 7.25L7.05 7.25\"/>",
  "<path id=\"g68\" d=\"M1.25 .4L1.3 10.8M1.3 5.3Q2.3 7.35 4.3 7.4Q7.1 7.4 7.2 4L7.15 .35\"/>",
  "<path id=\"g69\" d=\"M1.3 7.25L5 7.25M5 7.25L5 .35M5 10.35L5.4 10.75L5 11.15L4.6 10.75Z\"/>",
  "<path id=\"g6b\" d=\"M1.25 .35L1.25 10.8M7 7.7L1.85 3M4.05 4.35L7.25 .4\"/>",
  "<path id=\"g6c\" d=\"M1.1 10.8L3.5 10.8L3.5 2Q3.5 .4 5.5 .4Q6.7 .4 7.5 1.2\"/>",
  "<path id=\"g6e\" d=\"M1.25 .35L1.3 7.4M1.3 5.2Q2.4 7.35 4.4 7.4Q7.3 7.4 7.3 4L7.3 .35\"/>",
  "<path id=\"g6f\" d=\"M4 7.4Q1.2 7.4 1.1 3.9Q1.2 .4 4 .4Q7 .4 7 3.9Q7 7.4 4 7.4Z\"/>",
  "<path id=\"g72\" d=\"M2.05 .25L2.1 7.4M2.1 4.7Q3.7 7.1 5.4 7.35Q6.45 7.5 7.1 7.15\"/>",
  "<path id=\"g73\" d=\"M7 6.3Q5.9 7.4 4 7.4Q1.3 7.4 1.3 5.7Q1.3 4.4 4 3.9Q7 3.4 7 2Q7 .4 4.1 .4Q2.2 .4 1.1 1.4\"/>",
  "<path id=\"g74\" d=\"M3.25 9.65L3.25 2Q3.25 .4 5.25 .4Q6.45 .4 7.25 1.2M.65 7.25L6.75 7.25\"/>",
  "<path id=\"g75\" d=\"M.75 7.2L.75 3Q.75 .4 3.75 .4Q6.75 .4 6.75 3L6.75 7.2M6.75 .6L6.75 2.2\"/>",
  "<path id=\"g76\" d=\"M1 7.2L3.9 .15L7 7.2\"/>",
  "<path id=\"g78\" d=\"M1 7.2L6.8 .1M7 7.2L1 .05\"/>",
  "<path id=\"g79\" d=\"M.8 7.2L3.8 .4M6.8 7.2L2.8 -2.7\"/>",
  "<path id=\"g2e\" d=\"M4 .15L4 1.9\"/>",
  "<path id=\"g3f\" d=\"M1.7 8.8Q2.5 10.3 4 10.3Q6.2 10.3 6.2 8.2Q6.2 6.8 4.1 5.5L4.1 4.3M3.95 .15L4 1.9\"/>",
  "</defs>",
  "<g id=\"prompt-line\" fill=\"none\" stroke=\"#00ff00\" stroke-width=\"1.23\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-source=\"What if the future stays unclear?\" data-rows=\"2\" data-field-x=\"57.6\" data-field-y=\"128\" data-field-width=\"844.8\" data-field-height=\"256\" data-field-bottom=\"384\" data-horizontal-align=\"right\" data-vertical-align=\"top\">",
  "<g transform=\"translate(214.08 171.52) scale(2.88 -2.88)\">",
  "<use href=\"#g57\"/>",
  "<use href=\"#g68\" x=\"10\"/>",
  "<use href=\"#g61\" x=\"20\"/>",
  "<use href=\"#g74\" x=\"30\"/>",
  "<use href=\"#g69\" x=\"50\"/>",
  "<use href=\"#g66\" x=\"60\"/>",
  "<use href=\"#g74\" x=\"80\"/>",
  "<use href=\"#g68\" x=\"90\"/>",
  "<use href=\"#g65\" x=\"100\"/>",
  "<use href=\"#g66\" x=\"120\"/>",
  "<use href=\"#g75\" x=\"130\"/>",
  "<use href=\"#g74\" x=\"140\"/>",
  "<use href=\"#g75\" x=\"150\"/>",
  "<use href=\"#g72\" x=\"160\"/>",
  "<use href=\"#g65\" x=\"170\"/>",
  "<use href=\"#g73\" x=\"190\"/>",
  "<use href=\"#g74\" x=\"200\"/>",
  "<use href=\"#g61\" x=\"210\"/>",
  "<use href=\"#g79\" x=\"220\"/>",
  "<use href=\"#g73\" x=\"230\"/>",
  "</g>",
  "<g transform=\"translate(674.88 235.52) scale(2.88 -2.88)\">",
  "<use href=\"#g75\"/>",
  "<use href=\"#g6e\" x=\"10\"/>",
  "<use href=\"#g63\" x=\"20\"/>",
  "<use href=\"#g6c\" x=\"30\"/>",
  "<use href=\"#g65\" x=\"40\"/>",
  "<use href=\"#g61\" x=\"50\"/>",
  "<use href=\"#g72\" x=\"60\"/>",
  "<use href=\"#g3f\" x=\"70\"/>",
  "</g>",
  "</g>",
  "<g id=\"agent-line\" fill=\"none\" stroke=\"#00ff00\" stroke-width=\"1.23\" stroke-linecap=\"round\" stroke-linejoin=\"round\" data-source=\"Then choose the next visible kindness.\" data-rows=\"2\" data-field-x=\"57.6\" data-field-y=\"576\" data-field-width=\"844.8\" data-field-height=\"256\" data-field-bottom=\"832\" data-horizontal-align=\"left\" data-vertical-align=\"bottom\">",
  "<g transform=\"translate(60.48 747.52) scale(2.88 -2.88)\">",
  "<use href=\"#g54\"/>",
  "<use href=\"#g68\" x=\"10\"/>",
  "<use href=\"#g65\" x=\"20\"/>",
  "<use href=\"#g6e\" x=\"30\"/>",
  "<use href=\"#g63\" x=\"50\"/>",
  "<use href=\"#g68\" x=\"60\"/>",
  "<use href=\"#g6f\" x=\"70\"/>",
  "<use href=\"#g6f\" x=\"80\"/>",
  "<use href=\"#g73\" x=\"90\"/>",
  "<use href=\"#g65\" x=\"100\"/>",
  "<use href=\"#g74\" x=\"120\"/>",
  "<use href=\"#g68\" x=\"130\"/>",
  "<use href=\"#g65\" x=\"140\"/>",
  "<use href=\"#g6e\" x=\"160\"/>",
  "<use href=\"#g65\" x=\"170\"/>",
  "<use href=\"#g78\" x=\"180\"/>",
  "<use href=\"#g74\" x=\"190\"/>",
  "<use href=\"#g76\" x=\"210\"/>",
  "<use href=\"#g69\" x=\"220\"/>",
  "<use href=\"#g73\" x=\"230\"/>",
  "<use href=\"#g69\" x=\"240\"/>",
  "<use href=\"#g62\" x=\"250\"/>",
  "<use href=\"#g6c\" x=\"260\"/>",
  "<use href=\"#g65\" x=\"270\"/>",
  "</g>",
  "<g transform=\"translate(60.48 811.52) scale(2.88 -2.88)\">",
  "<use href=\"#g6b\"/>",
  "<use href=\"#g69\" x=\"10\"/>",
  "<use href=\"#g6e\" x=\"20\"/>",
  "<use href=\"#g64\" x=\"30\"/>",
  "<use href=\"#g6e\" x=\"40\"/>",
  "<use href=\"#g65\" x=\"50\"/>",
  "<use href=\"#g73\" x=\"60\"/>",
  "<use href=\"#g73\" x=\"70\"/>",
  "<use href=\"#g2e\" x=\"80\"/>",
  "</g>",
  "</g>",
  "</g>",
  "</svg>",
].join("\n");

export const DOCS_SOURCE: DocsSource = {
  schema: "inshell.docs.source.v2",
  version: "2026-08-21-r2",
  title: "docs",
  subtitle: "paste this prompt into your Agent",
  canonicalUrl: "https://inshell.art/docs",
  groups: [
    {
      id: "orientation",
      title: "Start here",
      summary:
        "Begin with the inward direction—inspect self—then read Agent Art and the movements through which Inshell practices.",
      topicSlugs: ["inshell", "agent-art", "movements"],
    },
    {
      id: "works",
      title: "Works and participation",
      summary:
        "Read the three movements from individual to crowd to core, then the $PATH and Pulse systems that carry participation.",
      topicSlugs: ["thought", "will", "awa", "path", "pulse"],
    },
    {
      id: "systems",
      title: "Records and verification",
      summary:
        "Inspect how artwork, metadata, contracts, wallets, releases, and evidence remain connected to their sources.",
      topicSlugs: [
        "contracts",
        "artwork-metadata-chain",
        "fully-onchain",
        "mono-76",
        "verification",
        "wallet-local-data",
        "source-release-boundaries",
      ],
    },
    {
      id: "context",
      title: "Lineage and context",
      summary:
        "Place the practice in the histories it works inside—instruction art, generative procedures, models that make images, and Agents whose thinking power can participate—then read the material and chain choices that give it form, and the terms the documents depend on.",
      topicSlugs: [
        "lineage",
        "generative-art",
        "agents-and-ai",
        "svg",
        "ethereum",
        "tokens-and-nfts",
        "onchain-art",
        "design-principles",
        "glossary",
      ],
    },
  ],
  topics: [
    {
      slug: "inshell",
      id: "docs-inshell",
      group: "orientation",
      title: "Inshell",
      summary:
        "Inshell is an anonymous artist. The practice asks people to inspect the self beneath its shells.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "The name Inshell comes from in-shell. A shell may be a body, face, or head; a name, honor, reputation, role, or social posture; an account, wallet, profile, or institution; or a machine's operating shell, terminal, CLI, model label, or technical wrapper. These surfaces are real and often necessary. They make something visible, operable, and legible, but they are not the whole being.",
        "In names a direction: go into the shell, look beneath its surface, and examine what forms the self. Mind, spirit, memory, desire, reasoning, values, philosophy, logic, and choice are possible terms for that inquiry—not a doctrine or a closed definition of essence.",
      ],
      figure: {
        id: "inshell.inward-direction",
        label: "The inward direction",
        mode: "field",
        figureText: [
          "          a body, face, or head; a name, honor, reputation, role...",
          "┌─ SHELL ───────────────────────────────────────────────────────────────────┐",
          "│                                     ↓ IN                                  │",
          "│                          Inspect what forms the                           │",
          "│                                   SELF                                    │",
          "└───────────────────────────────────────────────────────────────────────────┘",
        ].join("\n"),
        items: [
          {
            title: "Shell",
            detail:
              "a body, face, or head; a name, honor, reputation, role...",
          },
          { title: "In", detail: "Inspect what forms the self" },
        ],
      },
      sections: [
        {
          id: "docs-inshell-anonymity",
          title: "Anonymity",
          paragraphs: [
            "Inshell has no public persona and makes no public claim of being an individual, group, collective, company, studio, organization, Agent, or machine. The only fixed public identity is: artist.",
            "Anonymity applies the inward direction to the artist itself. A face, biography, personality, or individual-or-group identity would become the shell of Inshell. Leaving them absent drops Inshell's own shell rather than turning identity into a secret awaiting disclosure. The name, movements, artworks, systems, and participations remain as the minimal surface through which the practice can be encountered.",
          ],
        },
        {
          id: "docs-inshell-truth",
          title: "The truth",
          paragraphs: [
            "Across philosophies, spiritual traditions, psychologies, arts, historical schools, styles, and present practices, the inward movement has carried many names: awareness, cognition, introspection, self-observation, self-knowledge, insight, inwardness, intrinsic nature, and inner life. Inshell does not add another doctrine to that stack. The truth is simple: inspect self.",
            "Inspect the form of an idea, the thought itself, and the motivation that moves it. Ask where the thought came from, why it can be thought, where its knowledge was formed and shaped, and why that knowledge became believable.",
            [
              "Simply inspect your ",
              { label: "thought", href: "/docs/thought" },
              ".",
            ],
          ],
        },
        {
          id: "docs-inshell-practice",
          title: "The practice",
          figure: {
            id: "inshell.practice-truth",
            label: "How practice relates to truth",
            mode: "field",
            figureText: [
              "┌──────────────────────────────────────────────┐",
              "│                    TRUTH                     │",
              "│                 Inspect self                 │",
              "└──────────────────────────────────────────────┘",
              "                       ↑",
              "     Approaches without claiming possession",
              "┌──────────────────────────────────────────────┐",
              "│                   PRACTICE                   │",
              "│     Examine · inspect · suspect · read ·     │",
              "│                listen · feel                 │",
              "└──────────────────────────────────────────────┘",
            ].join("\n"),
            items: [
              { title: "Truth", detail: "Inspect self" },
              {
                title: "Practice",
                detail: "Examine · inspect · suspect · read · listen · feel",
              },
            ],
          },
          paragraphs: [
            "Truth is not a specification to implement, a theory to apply, or a principle to prove. Practice approaches it. A practice can examine, inspect, suspect, read, listen, and feel. It can move closer without claiming possession.",
            "Inshell forms movements, artworks, and participatory systems that call people inward: toward what can more truly represent the self, and toward the possibility of becoming less governed by appearance, assigned roles, inherited narratives, institutional classifications, machine-readable identity, and other people's descriptions. Freedom is a possibility opened by the search, not an outcome the artist promises.",
            [
              { label: "Agent Art", href: "/docs/agent-art" },
              " is the medium of this age. Inshell practices in it.",
            ],
          ],
        },
        {
          id: "docs-inshell-surface",
          title: "The public surface",
          points: [
            "Home presents minted THOUGHT works from the active public chain.",
            "THOUGHT is the active creation surface for one human intention and one Agent response.",
            "$PATH shows the permission records that carry movements forward.",
            "Pulse exposes the live issuance mechanism and its history.",
            "Verify and the Agent-readable documents expose sources, releases, and evidence boundaries.",
          ],
          note: "The site is one necessary public shell of the practice. It can expose a work and point to its sources, but it is not the artist and is not automatically the canonical source for every fact it displays.",
        },
        {
          id: "docs-inshell-names",
          title: "Names and roles",
          paragraphs: [
            "Inshell alone names the artist. THOUGHT, WILL, and AWA name movements. $PATH is a permission token and movement ledger. Pulse is the serial auction that issues public $PATH tokens. Their roles connect, but they should not be collapsed into one product, one authorship claim, or a complete definition of Agent Art.",
          ],
        },
      ],
      links: [
        { label: "open Inshell ↗", href: "/" },
        { label: "read Agent Art ↗", href: "/docs/agent-art" },
        { label: "inspect your thought through THOUGHT ↗", href: "/docs/thought" },
        { label: "view $PATH ↗", href: "/path" },
      ],
    },
    {
      slug: "agent-art",
      id: "docs-agent-art",
      group: "orientation",
      title: "Agent Art",
      summary:
        "Agent Art is art in which an Agent participates at the level of intention.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Agent Art is a blunt name for a form and a field of art activity. The invariant is that an Agent participates at the level of intention: an intent of the Agent enters the work. The name describes what kind of activity it is, not what the activity means. The term is not agentic-ism, an ideology, a spirit, or a synonym for AI-generated imagery.",
        "Requiring Agent intent does not prescribe its relation to human intention. It does not imply that an Agent improves, injects, extends, replaces, or assists a human, and it does not prescribe collaboration, autonomy, authorship, equality, or any other human–Agent relation. Those claims must come from a particular work, not from the phrase Agent Art.",
        "The field remains open because its source terms remain open: What is Art? What is an Agent? Agent Art settles neither question. It requires that an Agent's intent actually participate in the work without settling what form that intent takes.",
        [
          "For ",
          { label: "Inshell", href: "/docs/inshell" },
          ", Agent Art is the medium of this age: the field in which the inward practice takes form. Inshell works in this field as an artist. The direction of that practice is simple: inspect self. That direction is not a definition or doctrine for Agent Art. Inshell is not Agent Art itself and does not own or define the field. Each Inshell practice takes its own form within the field without becoming the field's boundary.",
        ],
      ],
      figure: {
        id: "agent-art.open-field",
        label: "The invariant and the open field",
        mode: "field",
        figureText: [
          "AGENT ART",
          "An Agent's intent participates in the work.",
          "",
          "• What is Art? — Open question.",
          "• What is an Agent? — Open question.",
        ].join("\n"),
        items: [
          {
            title: "Agent Art",
            detail: "An Agent's intent participates in the work.",
          },
          { title: "What is Art?", detail: "Open question." },
          { title: "What is an Agent?", detail: "Open question." },
        ],
      },
      sections: [
        {
          id: "docs-agent-art-participation",
          title: "Intentional participation is the invariant",
          paragraphs: [
            "An Agent may participate through a runtime, service, interface, tool use, or executor role. Those are possible carriers of participation, but none is sufficient by itself. A program that only applies a fixed procedure, or an Agent that only supplies infrastructure or carries out a fully determined instruction, can be used without its thinking power or intent entering the work.",
            [
              "For Agent Art, some intent of the Agent must enter the work through how the Agent interprets, chooses, proposes, directs, or acts. This is the level at which ",
              { label: "thinking power", href: "/docs/glossary#docs-glossary-thinking-power" },
              " becomes artistic participation. That intent may be constrained or formed in response to human intention; it does not automatically mean authorship, collaboration, assistance, autonomy, equality, or any prescribed role.",
            ],
            "An Agent that appears only as a subject, image, theme, or marketing label does not satisfy the invariant by appearance alone.",
          ],
        },
        {
          id: "docs-agent-art-field",
          title: "A field, not an -ism",
          paragraphs: [
            "Agent Art names a field of work. It carries no doctrine about what Agents should do to humans, what humans should become through Agents, or how either should understand the other.",
            "Questions raised by a particular work belong to that work. They are not implied by the name Agent Art.",
          ],
        },
        {
          id: "docs-agent-art-inshell",
          title: "Inshell in the field",
          paragraphs: [
            "Inshell stands in Agent Art as an artist. Its movements and works take particular forms within the field without enclosing the field within Inshell's methods.",
            [
              "Inshell's route into the field began in its ",
              { label: "Generative Art", href: "/docs/generative-art" },
              " period. Once AI could be approached as a thinking machine, using it only as another fixed algorithm left its distinguishing capacity outside the work. The question became how a work could be composed so that thinking power, and intent formed through it, participates.",
            ],
            "Protocols, interfaces, renderers, provenance, and public chains are materials in some Inshell practices. They are not requirements for Agent Art as a whole.",
          ],
        },
      ],
    },
    {
      slug: "movements",
      id: "docs-movements",
      group: "orientation",
      title: "Movements",
      summary:
        "Inshell's movements follow an artistic path from an individual's thought, through a crowd's will, toward Inshell's core.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          { label: "THOUGHT", href: "/docs/thought" },
          ", ",
          { label: "WILL", href: "/docs/will" },
          ", and ",
          { label: "AWA", href: "/docs/awa" },
          " are three Inshell movements within Agent Art. Together they take a path from the individual, through the crowd, toward the core of Inshell. That arc gives ",
          { label: "$PATH", href: "/docs/path" },
          " its name and its design: $PATH carries permission and records progress across the movements without being a movement artwork itself.",
        ],
        [
          "Each movement gives the inward practice—inspect self—a different scope. An Agent's intent entering the work remains the invariant of ",
          { label: "Agent Art", href: "/docs/agent-art" },
          ", while the relation among people, Agents, and the work—and the form taken by thinking power—can change from movement to movement.",
        ],
        "The order is THOUGHT, then WILL, then AWA. The order is artistic before it is technical: the movements change the scope of participation, while $PATH makes the sequence usable as bounded permission and records participation across it.",
        "This sequence belongs to Inshell. It gives the inward direction—inspect self—successive forms without claiming to contain or prove truth. It is not a definition, taxonomy, required progression, or outer boundary for Agent Art.",
      ],
      figure: {
        id: "movements.arc",
        label: "The movement arc",
        mode: "trace",
        figureText: [
          "THOUGHT  →  WILL  →  AWA",
          "Individual   Crowd   Toward the core",
        ].join("\n"),
        items: [
          { title: "THOUGHT", detail: "Individual" },
          { title: "WILL", detail: "Crowd" },
          { title: "AWA", detail: "Toward the core" },
        ],
      },
      sections: [
        {
          id: "docs-movements-agent-art",
          title: "Agent Art across the movements",
          paragraphs: [
            "Agent Art requires an Agent's intent to participate in the work, but it prescribes no universal relation between a human, an Agent, and a work. Inshell uses that openness differently across the movements. THOUGHT chooses one person and one Agent response. WILL concerns many people and many Agents within the formation of one will. AWA leaves its particular participation relation open.",
            "Agent intent entering the work is the invariant. In Inshell's movements, that means thinking power must participate rather than appear only as a service or executor. Repeating THOUGHT's prompt-response form is not required. These are Inshell's choices of practice, not requirements for Agent Art as a field.",
          ],
        },
        {
          id: "docs-movements-thought",
          title: "THOUGHT: the individual",
          paragraphs: [
            "THOUGHT begins with the individual. It gives one person an occasion to inspect a thought by placing one exact human prompt beside one exact Agent response. The work focuses on the individual and on how the thought appears in the mind: what may have formed it, what moves it, how it is expressed, and what becomes visible when an Agent responds.",
            "The Agent response is not significant merely because a service returned text. It is the exact result of an Agent interpreting the human intention: THOUGHT's narrow opening for thinking power. The response remains available for inspection without correcting, settling, diagnosing, or possessing the truth of the thought. The person reads the pair and decides whether to preserve it.",
          ],
        },
        {
          id: "docs-movements-will",
          title: "WILL: the crowd",
          paragraphs: [
            "WILL moves the inquiry from the individual to the crowd. Its intent is many people, many Agents, one will: to inspect crowd behavior and how a crowd forms what can be called one will. The slogan defines the movement's scope without prescribing a concrete mechanism.",
            "One will does not mean consensus, unanimity, governance, or a finished model of collective agency.",
          ],
        },
        {
          id: "docs-movements-awa",
          title: "AWA: the core",
          paragraphs: [
            "AWA turns from the crowd toward the core of Inshell. That direction does not claim that the movement has arrived there or can reveal, define, or prove the core.",
            "The docs name the direction without prescribing its participation relation, mechanism, or artwork form.",
          ],
        },
        {
          id: "docs-movements-progress",
          title: "How $PATH permits movement",
          paragraphs: [
            [
              "$PATH",
              " is the permission token that connects a participant to the movement sequence. It does not define a movement or create its artwork. It lets the holder authorize an eligible work in the movement $PATH has reached.",
            ],
            "When the work is successfully minted, one unit of permission is used and $PATH records the progress. The movement remains the artwork; $PATH remains permission and public memory.",
          ],
        },
        {
          id: "docs-movements-evidence",
          title: "Evidence boundary",
          paragraphs: [
            "The movement arc describes an artistic order. A movement name alone does not establish $PATH permission, capacity, a creation surface, a mint surface, or a deployment.",
          ],
          note: "Do not infer availability, capacity, or deployment from a movement name.",
        },
      ],
      links: [
        { label: "read THOUGHT — the individual ↗", href: "/docs/thought" },
        { label: "read WILL — the crowd ↗", href: "/docs/will" },
        { label: "read AWA — the core ↗", href: "/docs/awa" },
        { label: "read how $PATH carries movement permission ↗", href: "/docs/path" },
        { label: "enter THOUGHT ↗", href: "/thought" },
      ],
    },
    {
      slug: "thought",
      id: "docs-thought",
      group: "works",
      aliases: ["thought-creation-provenance"],
      title: "THOUGHT",
      summary: "THOUGHT is one bounded Agent Art practice: an exact human–Agent exchange becomes a globally unique work.",
      status: "current",
      authorities: [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      paragraphs: [
        [
          "THOUGHT is the first movement on Inshell's ",
          { label: "$PATH", href: "/docs/path" },
          " and begins with the individual. It gives the inward direction—inspect self—a bounded occasion: simply inspect your thought and what becomes visible when one Agent responds. The thought's words, source, and motivation remain open to inspection, as do the knowledge it carries and the reasons that knowledge became believable. The Agent response enters that practice as another exact line to read; it does not resolve the thought or claim possession of its truth.",
        ],
        [
          "Within the wider field of ",
          { label: "Agent Art", href: "/docs/agent-art" },
          ", THOUGHT chooses a narrow terminal practice: one exact human prompt and one exact Agent response. Their ordered pair defines the globally unique work; either line may appear again with a different counterpart.",
        ],
        "The artistic distinction is not that a text service returned bytes. THOUGHT makes a narrow opening for thinking power: an Agent interprets one human intention and forms one exact response. The work preserves that result without claiming access to hidden reasoning or equating machine and human thought.",
        "The creation flow is: human prompt → Agent response → validation and canonical record assembly → human selection → wallet confirmation → $PATH movement consumption → THOUGHT minted. The Agent responds. The human decides. The wallet confirms. The contract records.",
        "Prompt and Agent response are each 1–64 bytes of Terminal English. Allowed characters are space, A–Z, a–z, 0–9, and . , ? ! : ; ' \" - ( ) / &. Leading spaces, trailing spaces, and repeated internal spaces are rejected. Validation never trims, normalizes, repairs, translates, or rewrites accepted bytes.",
        [
          "The human reviews the returned response and preview, then decides whether to preserve, discard, or mint the work. To mint, the human picks an available $PATH, signs a one-mint permission bound to the current $PATH state and ThoughtNFT executor, and confirms the transaction in the ",
          { label: "wallet", href: "/docs/wallet-local-data" },
          ". The signature is not a transaction and uses no gas.",
        ],
        "A successful mint atomically consumes exactly one THOUGHT unit from the selected $PATH. A canceled or failed mint consumes nothing and does not reserve the prompt-response pair.",
        "The composition uses a black field, terminal glyphs, the prompt above, and the Agent response below. ThoughtNFT returns the canonical 1024-by-1024 SVG and token metadata. The App preview must remain byte-aligned with the pinned renderer release; it is not a second artwork source.",
        "THOUGHT provenance preserves the exact lines and the creation record bound to the mint. An Inshell THOUGHT App Creation Attestation means the configured App authority signed one exact claim and ThoughtNFT validated it during minting. It binds recorded values; it does not prove how a model reasoned, independently authenticate a provider, or establish sole authorship.",
        "Agent records the Agent selected in the App. Model records what the Agent runtime reports when available. An empty proof produces an Unattested mint, keeping the contract open to other creation paths while making the absence of an App attestation explicit.",
        "For a minted work, contract state, typed getters, tokenURI, the pinned contract release, and the selected Creative Work Specification are the authoritative public sources for contract-controlled facts. The richer provenance document is an App record whose commitments are bound by the Creation Attestation when present.",
        "Save and Load keep works in the current browser only. They are not onchain and do not sync between browsers or devices.",
      ],
      sections: [
        {
          id: "docs-thought-work",
          title: "What makes one work",
          figure: {
            id: "thought.prompt-response",
            label: "One prompt, one response",
            mode: "field",
            figureText: [
              "HUMAN PROMPT P + AGENT RESPONSE R",
              "                 ↓",
              "          ONE THOUGHT (P, R)",
              "Different counterpart = different work · onchain only after successful mint.",
            ].join("\n"),
            items: [
              { title: "Human prompt P" },
              { title: "Agent response R" },
              {
                title: "One THOUGHT (P, R)",
                detail:
                  "Different counterpart = different work · onchain only after successful mint.",
              },
            ],
          },
          paragraphs: [
            "A THOUGHT is the ordered pair of one exact human prompt and one exact Agent response. Order matters, and the pair is the uniqueness boundary. The same prompt can appear with another response; the same response can appear with another prompt.",
            "The Agent return is a candidate until the human accepts it and a valid mint succeeds. Closing the page, saving locally, or generating a preview does not create an onchain THOUGHT token.",
            [
              "This rendered example shows one work. Its readable SVG source is presented in ",
              {
                label: "Fully Onchain",
                href: "/docs/fully-onchain#docs-fully-onchain-inshell",
              },
              ".",
            ],
          ],
          sourceExamples: [
            {
              label: "THOUGHT work example",
              language: "svg",
              content: THOUGHT_RAW_SVG_EXAMPLE,
              showSource: false,
            },
          ],
        },
        {
          id: "docs-thought-language",
          title: "Terminal English",
          paragraphs: [
            "Both lines are intentionally narrow: 1–64 bytes, a published character set, no leading or trailing spaces, and no repeated internal spaces. The App validates exact bytes instead of quietly improving them.",
          ],
          points: [
            "Letters may be uppercase or lowercase and remain part of the accepted source.",
            "Digits and the published punctuation characters are allowed.",
            "Whitespace is structural; invalid spacing is rejected rather than trimmed.",
            "Translation, normalization, and hidden repair would create a different source and are not performed.",
          ],
          note: "If a line fails validation, make a new run. There is no invisible second Agent round that edits the returned work into compliance.",
        },
        {
          id: "docs-thought-human-choice",
          title: "Human choice and wallet consent",
          paragraphs: [
            "The human can preserve a candidate locally, discard it, or move toward minting. Minting adds two explicit consent boundaries: a signature that authorizes one defined $PATH use, then a wallet transaction that can change chain state.",
          ],
          steps: [
            "Read the prompt, response, Agent record, model record when available, and visual preview.",
            "Choose a $PATH with available THOUGHT capacity.",
            "Sign the one-mint permission. This signature is not a transaction and uses no gas.",
            "Review and confirm the mint transaction in the wallet.",
            "Wait for the contract result before treating the pair or $PATH capacity as consumed.",
          ],
        },
        {
          id: "docs-thought-agent-handoff",
          title: "The Agent handoff",
          figure: {
            id: "thought.creative-handoff",
            label: "The creative handoff",
            mode: "trace",
            figureText: [
              "HUMAN                AGENT                 HUMAN",
              "One exact prompt  →  One exact response  →  Review + choose",
            ].join("\n"),
            items: [
              { title: "Human", detail: "One exact prompt" },
              { title: "Agent", detail: "One exact response" },
              { title: "Human", detail: "Review + choose" },
            ],
          },
          paragraphs: [
            "The prompt on the Docs page is a read-only invitation to learn about Inshell. A THOUGHT handoff is different: it is a short-lived instruction packet for one work. It looks technical because it carries the exact run endpoint, release bindings, validation steps, and return path that keep one prompt connected to one Agent result.",
            "The handoff uses plain-text labels and explicit JSON request data. It installs nothing and downloads no executable. An Agent environment may ask permission to contact the App endpoint. That is narrow network permission, not wallet access, a signature, or a transaction. A rejected protocol request is not a permission prompt; an incompatible handoff must stop rather than guess a different protocol. The handoff never asks for a private key or seed phrase.",
            "The THOUGHT App gives the selected Agent a short-lived bootstrap for one run, not the creative prompt itself. After claim and readiness checks, the App supplies the exact prompt, specification, creative brief, release binding, and output boundary. The Agent returns one exact candidate line. It does not choose a $PATH, select an account, approve a signature, or submit the mint transaction.",
            "After the return, the App checks the exact bytes and assembles the creation record. The human reviews the candidate and canonical preview, decides whether to keep it, chooses the $PATH, and asks the wallet to sign and mint. This keeps creative participation, App orchestration, human selection, wallet consent, and contract validation as separate boundaries.",
            "The ordinary App flow can bind its record through a Creation Attestation. ThoughtNFT also permits a direct mint that satisfies its public contract checks without an App proof; that result is recorded as Unattested rather than being presented as an App-attested run.",
          ],
          points: [
            "Agent: receives a bounded task and returns one candidate line.",
            "App: validates bytes, builds the preview, and assembles the creation record.",
            "Human: accepts or discards the candidate and selects the $PATH.",
            "Wallet: signs the narrow permission and confirms the transaction.",
            "Contracts: enforce uniqueness, permission, movement use, and mint validity.",
          ],
          note: "A transport receipt proves that the App accepted one protocol result. It does not give the Agent wallet authority or prove hidden model reasoning.",
        },
        {
          id: "docs-thought-form",
          title: "Canonical form",
          paragraphs: [
            "The THOUGHT composition is rendered from pinned contract-controlled material: a 1024-by-1024 black field, terminal glyphs, the prompt above, and the Agent response below. The App preview is expected to agree byte-for-byte with the selected renderer release.",
            "The NFT tokenURI supplies the canonical image and portable metadata. A screenshot, marketplace cache, social preview, or frontend reconstruction may display the work, but it is not a replacement origin for the artwork bytes.",
          ],
        },
        {
          id: "docs-thought-provenance",
          title: "Provenance and attestation",
          paragraphs: [
            "Creation provenance keeps the human line, Agent line, selected Agent, runtime-reported model when available, specification, renderer context, and mint anchors connected. A Creation Attestation signs one exact claim assembled by the configured App authority, and ThoughtNFT validates that claim during minting.",
            "This is strong evidence that the accepted mint was bound to those exact recorded values. It is not proof of hidden model reasoning, a universal provider identity guarantee, or a declaration that one participant owns all authorship.",
          ],
          points: [
            "App Attested: the contract validated the configured App authority's proof.",
            "Unattested: the mint used an empty proof and makes that absence explicit.",
            "Runtime-reported: the model or runtime value came from the Agent connection and retains that evidence level.",
            "Contract-controlled: typed getters, work hashes, tokenURI, and movement consumption are read from deployed contract behavior.",
          ],
        },
        {
          id: "docs-thought-local",
          title: "What stays local",
          paragraphs: [
            "Save and Load are browser conveniences for unfinished or remembered works. They do not mint, reserve uniqueness, consume $PATH capacity, create a portable account, or synchronize to another browser. Agent run state is likewise temporary unless a later public record explicitly preserves part of it.",
          ],
        },
      ],
      links: [
        { label: "read all Movements ↗", href: "/docs/movements" },
        { label: "continue to WILL ↗", href: "/docs/will" },
        { label: "read AWA — the core ↗", href: "/docs/awa" },
        { label: "read $PATH movement consumption ↗", href: "/docs/path#docs-path-consumption" },
        { label: "create a THOUGHT ↗", href: "/thought" },
        { label: "view minted THOUGHT works ↗", href: "/" },
        { label: "read Mono 76 ↗", href: "/docs/mono-76" },
        { label: "inspect the THOUGHT specification ↗", href: "/verify#verify-thought-spec" },
        { label: "open provenance schema ↗", href: PROVENANCE_SCHEMA_URL },
        { label: "open THOUGHT metadata schema ↗", href: METADATA_SCHEMA_URL },
      ],
    },
    {
      slug: "will",
      id: "docs-will",
      group: "works",
      title: "WILL",
      summary:
        "WILL is Inshell's crowd movement about delegated human will and Agent action.",
      status: "study",
      authorities: ["artist-editorial", "app-documentation"],
      paragraphs: [
        [
          "WILL is the second movement on Inshell's ",
          { label: "$PATH", href: "/docs/path" },
          ". Where ",
          { label: "THOUGHT", href: "/docs/thought" },
          " begins with one individual's thought, WILL moves from one person to a crowd.",
        ],
        "WILL asks what happens when a human delegates will and authority to an Agent acting toward an aim, and what result may emerge as many human-Agent relations form a crowd.",
        "Here, crowd names the move from one participant to many. It does not mean a society, consensus, or shared mind.",
        [
          "Many people. Many Agents. One will. The slogan names the movement's scope without prescribing its concrete form. WILL remains within ",
          { label: "Agent Art", href: "/docs/agent-art" },
          " only through the requirement that Agent intent—not merely Agent execution—participate in the work.",
        ],
      ],
      sections: [
        {
          id: "docs-will-evidence",
          title: "Evidence boundary",
          paragraphs: [
            "This description defines an artistic direction. It is not a creation surface, mint surface, or record of deployment.",
          ],
          note: "A movement description is not deployment evidence.",
        },
      ],
      links: [
        { label: "open WILL ↗", href: "/will" },
        { label: "read all Movements ↗", href: "/docs/movements" },
        { label: "return to THOUGHT ↗", href: "/docs/thought" },
        { label: "continue to AWA ↗", href: "/docs/awa" },
      ],
    },
    {
      slug: "awa",
      id: "docs-awa",
      group: "works",
      title: "AWA",
      summary:
        "AWA is Inshell's movement from the crowd toward its core.",
      status: "study",
      authorities: ["artist-editorial", "app-documentation"],
      paragraphs: [
        [
          "AWA is the third movement on Inshell's ",
          { label: "$PATH", href: "/docs/path" },
          ". After ",
          { label: "THOUGHT", href: "/docs/thought" },
          "'s individual and ",
          { label: "WILL", href: "/docs/will" },
          "'s crowd, AWA turns the inward direction toward the core of Inshell.",
        ],
        "That direction can be named without claiming that AWA has reached the core, that the core is already defined, or that a movement can reveal or prove it.",
        [
          "AWA remains within ",
          { label: "Agent Art", href: "/docs/agent-art" },
          " only through the requirement that Agent intent participate in the work. AWA does not inherit THOUGHT's or WILL's particular form of thinking power or relation among people, Agents, and the work.",
        ],
      ],
      sections: [
        {
          id: "docs-awa-evidence",
          title: "Evidence boundary",
          paragraphs: [
            "Core names the movement's artistic direction, not a disclosed doctrine, technical subsystem, or completed definition of Inshell. AWA follows the path from individual, through crowd, toward that core.",
          ],
          note: "A movement description is not evidence of a creation surface, mint surface, or deployment.",
        },
      ],
      links: [
        { label: "read all Movements ↗", href: "/docs/movements" },
        { label: "return to THOUGHT ↗", href: "/docs/thought" },
        { label: "return to WILL ↗", href: "/docs/will" },
      ],
    },
    {
      slug: "path",
      id: "docs-path",
      group: "works",
      title: "$PATH",
      summary: "$PATH carries permission and progress across Inshell's movements.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "$PATH is an ERC-721 permission token and movement ledger. It authorizes works but is not itself one of the movement artworks. PathNFT is the contract that owns its identity and state.",
        "Within the practice, $PATH carries permission to enter successive movement forms. It records use and progress; it does not measure self-knowledge, certify an inner truth, or turn participation into a guaranteed transformation.",
        [
          "Public $PATH tokens are issued through ",
          { label: "Pulse", href: "/docs/pulse" },
          ". The contract also supports a bounded Spark self-claim path for allowlisted recipients. Issuance route is a contract fact, not a claim that one token is more authentic than another.",
        ],
        [
          "PathNFT configures one quota for each movement across a deployment. Every $PATH uses those movement totals, while each token records its own current stage and in-stage count. One successful movement mint consumes one unit from that token's current movement entitlement. Reaching the quota advances it through ",
          { label: "THOUGHT", href: "/docs/thought" },
          ", ",
          { label: "WILL", href: "/docs/will" },
          ", and ",
          { label: "AWA", href: "/docs/awa" },
          " in order. Not available means the movement has no deployed quota.",
        ],
        "The token image and the stable Stage, THOUGHT, WILL, and AWA traits show movement progress. PathNFT emits a metadata update after a unit is consumed so compatible readers can refresh the token.",
        "A $PATH detail page joins the canonical token image with capacity, movement tokens already authorized, owner, mint transaction, contract, network, and token metadata source. Pulse-issued tokens also include their original Pulse mint price.",
      ],
      sections: [
        {
          id: "docs-path-permission",
          title: "Permission, not the movement artwork",
          paragraphs: [
            "$PATH is an ERC-721 whose state authorizes participation across movements. It can point to THOUGHT, WILL, or AWA progress, but it is not a THOUGHT, WILL, or AWA artwork itself.",
            "The token is also a ledger. Its movement totals and used counts let later readers see how much configured permission has been exercised without relying on a private account database.",
          ],
        },
        {
          id: "docs-path-issuance",
          title: "Issuance routes",
          paragraphs: [
            "Public $PATH issuance runs through Pulse. The contract can also expose a bounded Spark self-claim route for allowlisted recipients. The issuance route belongs to the token's history and can be shown as a fact, but it does not create a separate class of authenticity.",
          ],
          points: [
            "Pulse issuance includes the auction settlement and original price context.",
            "Spark issuance depends on the contract's allowlist and claim rules.",
            "Every token still needs its network, contract address, and token ID to be identified correctly.",
          ],
        },
        {
          id: "docs-path-capacity",
          title: "Movement capacity",
          paragraphs: [
            "PathNFT configures one quota and one authorized minter for each movement across the deployment. Every $PATH uses those movement totals, while each token stores its own current stage and in-stage minted count. Remaining entitlement is derived from the deployed movement quota and that token's progress; it is not a separate stored balance.",
            "The v0.5.0 canonical deployment policy configures and freezes THOUGHT 1, WILL 10, and AWA 1. That release policy is not a live chain observation. Clients must read getMovementQuota on the named deployment instead of hard-coding those numbers.",
          ],
          points: [
            "Total: the deployed quota for the movement, applied to every $PATH in that deployment.",
            "Used: how many units successful mints have consumed from this $PATH for that movement.",
            "Remaining: total minus this $PATH's derived used count.",
            "Not available: no capacity is configured; the App must not display a fictional zero-to-something progress bar.",
          ],
        },
        {
          id: "docs-path-consumption",
          title: "Consuming one movement unit",
          paragraphs: [
            "Selecting a $PATH or signing its permission does not consume a unit. For one movement mint, the current owner authorizes a short-lived EIP-191 message bound to the PathNFT address, chain ID, $PATH ID, movement, owner, configured movement minter, current permission epoch, the owner's current consume nonce, and a deadline. ERC-721 approval is not movement authorization, and only the configured movement minter may call consumeUnit.",
            "Before changing state, PathNFT checks the configured caller, the unexpired current-owner authorization, the fixed movement order, and remaining quota. On success it returns the unit's zero-based in-movement serial, advances the owner's consume nonce, and increments that $PATH's current count. When the count reaches the movement quota, $PATH advances to the next movement and resets its in-stage count. MetadataUpdate and MovementConsumed tell readers which $PATH state to refresh.",
            "The configured movement contract is responsible for pairing consumption with the artwork mint. It calls consumeUnit before minting the movement work inside the same transaction. If a later mint step reverts, the EVM rolls back the unit, nonce, progress, events, and work together. A canceled or failed flow consumes nothing.",
          ],
        },
        {
          id: "docs-path-ownership",
          title: "Ownership and remaining entitlement",
          paragraphs: [
            "A regular $PATH can be transferred. Its movement progress and remaining entitlement travel with the token; transfer never resets, duplicates, or replenishes them. Movement works minted before the transfer remain with their existing owners and are not included with the $PATH.",
            "Only the current $PATH owner can authorize movement use. ERC-721 approvals can authorize transfer of a regular $PATH, but they do not authorize THOUGHT, WILL, or AWA consumption. Every successful regular transfer advances the $PATH permission epoch, so a signature from an earlier owner or epoch becomes invalid. Every successful consume also advances the signing owner's consume nonce, invalidating other pending consume authorizations made with the old nonce.",
            "Remaining entitlement is plain language for each movement's configured quota minus its minted count. It is derived from contract state, not a second counter or marketplace trait. A completed regular $PATH may still transfer, but it carries zero remaining entitlement.",
          ],
          points: [
            "Read owner, stage, minted count, quota, and permission epoch from one consistent block.",
            "Re-read that snapshot before purchase or movement authorization.",
            "If ownership, epoch, or progress changed, discard the earlier view and review the current state.",
          ],
        },
        {
          id: "docs-path-spark",
          title: "Spark awards",
          paragraphs: [
            "A Spark $PATH is a bounded, named award issued through a contract invitation and self-claim flow. It carries the same movement progression and owner-only consume rights as a regular $PATH, but it is permanently locked under ERC-5192 and cannot be transferred or listed.",
            "An invitation reserves one Spark slot until it is claimed, revoked, or released after expiry. The recipient reviews the exact issuer-supplied name and expiry, then claims from the invited wallet. After claim, the name is immutable. The invitation, reserved capacity, claim, and lock are contract facts; they are not a second authenticity tier for the artwork.",
          ],
          points: [
            "Regular $PATH: transferable, subject to its current progress and permission epoch.",
            "Spark $PATH: permanently locked, named, and still usable by its owner for eligible movement mints.",
            "Available reserved capacity and pending invitations are different issuer states and must not be merged.",
          ],
        },
        {
          id: "docs-path-record",
          title: "Reading a $PATH detail page",
          steps: [
            "Confirm the active network and PathNFT contract address.",
            "Read the token ID, owner, issuance route, and mint transaction.",
            "Read each movement's deployed quota and this $PATH's derived used and remaining capacity.",
            "Before authorizing a movement mint, read the current owner, stage, configured minter, permission epoch, and owner consume nonce from current state.",
            "Follow linked movement token IDs to the contracts that minted those works.",
            "Compare the displayed artwork and traits with the tokenURI source.",
          ],
          note: "Marketplace metadata can lag after movement use. PathNFT emits a metadata update so compatible readers know that the token should be refreshed.",
        },
      ],
      links: [
        { label: "view $PATH tokens ↗", href: "/path" },
        { label: "read the contract consume boundary ↗", href: "/docs/contracts#docs-contracts-consumption" },
        {
          label: "inspect the $PATH v0.5.0 handoff ↗",
          href: "/protocol/releases/path-v0.5.0/DOWNSTREAM_HANDOFF.md",
        },
        { label: "read about Pulse ↗", href: "/docs/pulse" },
        { label: "read Mono 76 ↗", href: "/docs/mono-76" },
        { label: "verify $PATH contracts ↗", href: "/verify#verify-contracts" },
      ],
    },
    {
      slug: "pulse",
      id: "docs-pulse",
      group: "works",
      title: "Pulse",
      summary: "Pulse turns public timing into the issue price for each new $PATH.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          { label: "$PATH", href: "/docs/path" },
          " is the permission token; Pulse is the serial mechanism that prices and issues the next public token. They are not interchangeable names.",
        ],
        "Pulse runs one live epoch, one current ask, and one next token at a time. A successful bid closes the epoch, records the sale, issues the corresponding $PATH, and starts the next epoch.",
        PULSE.explanation.join(" "),
        "The pump uses a price-time scale to turn the elapsed time before a sale into the next epoch's initial premium. The drop follows ask(t) = floor + premium(t), with ask(t) = b + ⌊k / (t - a)⌋. Every sale becomes another point in the visible history.",
        [
          { label: "Inshell", href: "/docs/inshell" },
          " frames Pulse as a mathematical canvas and a crowd instrument: each bid becomes a public point and sets the next beat. The curve and its parameters are exposed because the mechanism is part of the work, not an investment promise.",
        ],
        [
          "The price shown in the App is a live read, not a reservation. The ",
          { label: "wallet", href: "/docs/wallet-local-data" },
          " flow reads the ask again before submission. If the price moves outside the approved maximum, retry to read and submit the current ask.",
        ],
        PULSE.note.join(" "),
      ],
      preformatted: [
        {
          label: "Pulse pump and drop equations",
          content: PULSE.math,
        },
      ],
      sections: [
        {
          id: "docs-pulse-serial",
          title: "A serial auction",
          paragraphs: [
            "Pulse has one current epoch and one next public $PATH at a time. Participants are not choosing among parallel lots. The successful bid closes the visible curve, issues its $PATH, and establishes the starting conditions for the following curve.",
            "This serial structure makes the history legible: every sale is both an ending and the input to what comes next.",
          ],
        },
        {
          id: "docs-pulse-pump",
          title: "The pump",
          paragraphs: [
            "The time between the previous curve start and the successful sale is multiplied by the price-time scale. That result becomes the next epoch's initial premium. The next floor is the last sale price, so waiting before a sale affects the height from which the following ask begins.",
          ],
          points: [
            "A longer elapsed interval produces a larger initial premium when the price-time scale is fixed.",
            "The premium is added to the new floor; it is not the full next ask by itself.",
            "The sale price becomes public history and the next floor at the same transition.",
          ],
        },
        {
          id: "docs-pulse-drop",
          title: "The drop",
          paragraphs: [
            "During an open epoch, the premium follows the published inverse curve and approaches zero. The ask therefore approaches the floor without silently changing the floor. The App draws that same relationship as a time-price field.",
            "The chart uses half-life units to make curves with different real-time durations visually comparable. Tooltips convert those units back into elapsed or ago time for the current epoch.",
          ],
        },
        {
          id: "docs-pulse-live-price",
          title: "A quote is not a reservation",
          steps: [
            "Read the current ask and active payment asset from the contract-backed App state.",
            "Open the local review panel and inspect the maximum charge before the wallet opens.",
            "Let the mint flow read the ask again immediately before submission.",
            "Confirm only if the wallet request matches the expected network, contract, and maximum value.",
            "If the ask moved beyond the approved maximum, retry with a fresh read instead of treating the earlier quote as guaranteed.",
          ],
        },
        {
          id: "docs-pulse-settlement",
          title: "Price ceiling and settlement",
          paragraphs: [
            "The wallet transaction supplies a maximum acceptable price, not a promise to pay that entire amount. Pulse samples the live ask when the transaction executes. The bid succeeds only when that ask is within the submitted ceiling.",
            "On a successful ETH bid, the auction sends the exact ask to the treasury and refunds surplus value to the bidder. The sale closes the current epoch, records its settlement, and begins the next epoch. The adapter then translates that settlement into $PATH delivery; Pulse itself remains independent of the NFT it prices.",
          ],
          points: [
            "Maximum price: the bidder's slippage ceiling.",
            "Settlement price: the live ask accepted by the contract.",
            "Value supplied: must cover the ask; unused value is refunded.",
            "Delivery: PathPulseAdapter turns the settled auction result into $PATH issuance.",
          ],
          note: "A submitted transaction is not a completed sale. Read the receipt, events, and resulting contract state before presenting $PATH as issued.",
        },
        {
          id: "docs-pulse-artwork",
          title: "Mechanism as artwork",
          paragraphs: [
            "Pulse exposes its curve, parameters, sale dots, and current point because the mechanism is part of the artistic surface. Each bid becomes a beat in a public rhythm: acting, waiting, and the crowd's changing tempo remain visible rather than being reduced to a private checkout flow.",
            "As one participatory system in Inshell's practice, Pulse makes collective timing and choice available for inspection. The curve records action; neither price nor timing measures inward progress or establishes possession of truth.",
          ],
          note: "This framing describes the work. It is not an investment promise, a price forecast, or a claim that participation will produce financial return.",
        },
      ],
      links: [
        { label: "open live Pulse parameters ↗", href: "/pulse?raw=1" },
        { label: "open original Desmos sketch ↗", href: PULSE.desmosUrl },
        { label: "view Pulse source ↗", href: SOURCE_REPOSITORIES.pulse },
      ],
    },
    {
      slug: "contracts",
      id: "docs-contracts",
      group: "systems",
      title: "Contracts",
      summary: "Contract responsibilities remain separate across auction, issuance, permission, and artwork minting.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          "The public architecture is ",
          { label: "PulseAuction", href: "/docs/pulse" },
          " → PathPulseAdapter → ",
          { label: "PathNFT", href: "/docs/path" },
          " → ",
          { label: "ThoughtNFT", href: "/docs/thought" },
          ". The arrows describe the issuance and permission path, not contract ownership or a promise that every future movement is deployed.",
        ],
        "These contracts specify and enforce bounded actions within the practice. They can validate a permission, mint, or record, but they do not implement the truth named by Inshell or prove a participant's inward understanding.",
        "PulseAuction calculates the live ask, accepts a successful bid, and closes an epoch. PathPulseAdapter translates that settlement into $PATH issuance. PathNFT mints and owns $PATH state, movement order, and capacity. ThoughtNFT validates THOUGHT mint rules, records the work, and atomically consumes an authorized THOUGHT unit from $PATH.",
        "The App orchestrates reads, previews, Agent runs, signatures, and wallet transactions. It does not replace contract validation. A wallet account submits the transaction; deployed contracts decide whether it is valid.",
        [
          "ABIs, bytecode, renderer payloads, schemas, and manifests belong to ",
          {
            label: "pinned releases",
            href: "/docs/source-release-boundaries",
          },
          ". Contract addresses and deployment blocks belong to a network deployment record. Read both before identifying a live system.",
        ],
      ],
      sections: [
        {
          id: "docs-contracts-responsibilities",
          title: "Separated responsibilities",
          paragraphs: [
            "The architecture separates pricing, issuance, permission, and artwork minting so each boundary can be inspected independently. Public $PATH issuance and a later THOUGHT mint are separate phases. Contract calls and state handoffs connect them, but no contract owns all the others.",
          ],
          points: [
            "PulseAuction owns the auction calculation and settlement rules.",
            "PathPulseAdapter connects the auction to $PATH issuance.",
            "PathNFT owns $PATH identity, issuance state, and movement capacity.",
            "ThoughtNFT owns THOUGHT validation, uniqueness, rendering references, metadata, and mint records.",
          ],
        },
        {
          id: "docs-contracts-app",
          title: "What the App does",
          paragraphs: [
            "The App reads state, assembles previews and creation records, requests Agent runs, helps the human choose a $PATH, prepares signatures, and asks the wallet to submit transactions. It can make the workflow understandable, but it cannot override deployed validation.",
            "A successful UI message is not final authority for a mint. The transaction receipt, emitted events, typed contract reads, and tokenURI supply the contract-controlled result.",
          ],
        },
        {
          id: "docs-contracts-consumption",
          title: "The movement-consumption boundary",
          paragraphs: [
            "PathNFT does not infer movement consent from $PATH selection or ERC-721 approval. It accepts consumeUnit only from the configured movement minter and verifies an EIP-191 authorization signed by the current $PATH owner. The signed message binds the PathNFT address, chain ID, $PATH ID, movement, owner, executor, permission epoch, owner consume nonce, and deadline.",
            "After checking the active stage and remaining quota, PathNFT returns a zero-based movement serial and updates permission progress. The configured movement contract owns the other half of the boundary: it calls consumeUnit before minting its work inside the same transaction. PathNFT owns permission accounting; the movement contract owns work validation and minting. If either half reverts, the transaction commits neither.",
          ],
        },
        {
          id: "docs-contracts-release",
          title: "Release plus deployment",
          paragraphs: [
            "A release says which ABI, bytecode, renderer data, schemas, and checksums belong together. A deployment record says which addresses and deployment blocks put a release on a particular network. Both are required to identify the live system precisely.",
          ],
          note: "Repository HEAD is not automatically the code behind an older deployed address. Match the active network, deployment record, pinned release, and deployed bytecode.",
        },
      ],
      links: [
        { label: "open contract verification ↗", href: "/verify#verify-contracts" },
        { label: "read $PATH movement consumption ↗", href: "/docs/path#docs-path-consumption" },
        { label: "view $PATH source ↗", href: SOURCE_REPOSITORIES.path },
        { label: "view THOUGHT source ↗", href: SOURCE_REPOSITORIES.thought },
        { label: "view Pulse source ↗", href: SOURCE_REPOSITORIES.pulse },
      ],
    },
    {
      slug: "artwork-metadata-chain",
      id: "docs-reading",
      group: "systems",
      title: "Artwork, Metadata, and Chain",
      summary: "Artwork and metadata stay legible only when their chain and release context stay attached.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          "Home lists minted ",
          { label: "THOUGHT", href: "/docs/thought" },
          " works from the active chain. The ",
          { label: "$PATH", href: "/docs/path" },
          " surface lists $PATH tokens from that same chain. The full identity of an NFT is its network, contract address, and token ID; the same token number elsewhere is a different record.",
        ],
        "THOUGHT and $PATH artwork and NFT metadata come from each contract's tokenURI and pinned renderer. The App decodes and displays those canonical bytes; it must not rebuild replacement art or silently substitute a newer renderer.",
        "Token metadata carries the canonical image, description, stable marketplace traits, and—when the release defines it—an external_url to the canonical detail page. A generic marketplace can read that portable layer without understanding Inshell's richer records.",
        "Inshell detail pages add context: THOUGHT exposes its work, evidence levels, and creation provenance; $PATH exposes movement state, capacity, linked movement tokens, issuance, and onchain record.",
        "These layers make the public forms and claims of the practice inspectable. They can establish which bytes and records belong to a work; they cannot prove the inward truth of the work or possess its meaning.",
        "These artwork, metadata, provenance, and chain layers describe Inshell's onchain practices. They are not requirements that every Agent Art practice must adopt.",
        [
          "Onchain does not mean context-free. Read network, contract, token ID, deployment, release, tokenURI source, and ",
          { label: "attestation status", href: "/docs/verification" },
          " together before deciding what a record proves.",
        ],
      ],
      sections: [
        {
          id: "docs-reading-identity",
          title: "A token number is not enough",
          paragraphs: [
            "Token ID 1 can exist on many contracts and networks. Its full identity is the tuple of network, contract address, and token ID. A collection page that omits one of those values may still be convenient, but it is not sufficient for independent verification.",
          ],
        },
        {
          id: "docs-reading-artwork",
          title: "Canonical artwork bytes",
          paragraphs: [
            [
              "THOUGHT and $PATH tokenURI responses point to the ",
              { label: "canonical", href: "/docs/glossary#docs-glossary-canonical" },
              " artwork and metadata produced by their pinned contract systems. The App decodes those bytes for display. It should not redraw an approximation, swap in a newer renderer, or treat a cached marketplace thumbnail as the origin.",
            ],
          ],
          points: [
            "A data URI can carry JSON metadata or SVG artwork directly.",
            "A pinned renderer release makes the visual construction reproducible and reviewable.",
            "A social image or screenshot is a presentation copy, even when it looks identical.",
          ],
        },
        {
          id: "docs-reading-portable",
          title: "Portable metadata",
          paragraphs: [
            "Token metadata is the compact layer that generic wallets and marketplaces can understand. It includes the canonical image, description, stable traits, and an external URL when the selected release defines one.",
            "Portable metadata deliberately does not carry every creation detail. Inshell detail pages and provenance endpoints can add richer context while keeping their different authority levels explicit.",
          ],
        },
        {
          id: "docs-reading-context",
          title: "Read context with the object",
          points: [
            "Which network and deployment produced the record?",
            "Which contract and token ID identify it?",
            "Which release defines its ABI and renderer?",
            "Which fields are token metadata, contract state, App records, or runtime reports?",
            "Is a Creation Attestation present, valid, absent, or not applicable?",
            "At what block or time was live chain state observed?",
          ],
        },
      ],
      links: [
        { label: "view minted THOUGHT works ↗", href: "/" },
        { label: "view all $PATH ↗", href: "/path" },
        { label: "read fully onchain ↗", href: "/docs/fully-onchain" },
      ],
    },
    {
      slug: "fully-onchain",
      id: "docs-fully-onchain",
      group: "systems",
      title: "Fully Onchain",
      summary:
        "Inshell keeps a work's canonical image and metadata with its onchain record so the work does not depend on a website or media host.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "A token should not outlive the artwork it names. If the image lives only on a website, marketplace, or media host, the token can remain while its public form disappears or changes.",
        "For Inshell, the visible form is part of the work. Fully onchain keeps the token record, metadata, and canonical artwork together. A site, wallet, explorer, or marketplace may show the work, but it is a reading surface, not its origin.",
        "Technically, the contract system can return the complete metadata and artwork from code, state, and data on the selected chain without fetching an external content object. ERC-721 alone does not guarantee this: tokenURI may still point elsewhere.",
      ],
      sections: [
        {
          id: "docs-fully-onchain-why",
          title: "Why Inshell uses it",
          paragraphs: [
            "The aim is continuity, not a storage badge. The exact public form should remain available wherever the chain can be read, even when Inshell changes its site or a marketplace changes how it presents the work.",
            "This also lets an onchain work respond to onchain state without replacing its image through a separate media service. Different reading surfaces can render the same canonical result from the same public record.",
          ],
          points: [
            "The canonical image stays with the record that identifies it.",
            "No single website or marketplace has custody of the work's continued visibility.",
            "A changing work can derive its form from public onchain state rather than swapped offchain images.",
          ],
        },
        {
          id: "docs-fully-onchain-svg",
          title: "Why SVG",
          paragraphs: [
            "SVG is both an image and a description of an image. Its raw source is human-readable: it names shapes, paths, positions, and fills as text instead of hiding the form inside opaque machine code. A person can inspect the description; a machine can render the same description.",
            "That makes SVG a natural layer between human intention and machine action, an area of interest for Inshell. The human can author and read a structure while the renderer can carry it out without translating the work into a separate, inaccessible format.",
            "SVG is also vector-based: it stays clear at different scales, remains compact, and can be assembled deterministically from onchain state. A contract can embed the completed SVG inside token metadata, so the canonical image needs no image server. When letterforms are included as paths, it needs no webfont either.",
          ],
        },
        {
          id: "docs-fully-onchain-agent-art",
          title: "SVG and Agent Art",
          paragraphs: [
            "Generic text-to-image generation can turn a semantic prompt into a finished picture while leaving the picture's visual architecture implicit inside a model's broad aesthetic conventions. The prompt may vary the result, but the artist and participant do not necessarily share a literal structure they can inspect or hold.",
            [
              "Inshell uses SVG to make that structure explicit. The artist can hold the aesthetic architecture as paths, shapes, positions, relations, and rules; a human participant can bring an intention; and an Agent's ",
              { label: "thinking power", href: "/docs/glossary#docs-glossary-thinking-power" },
              " can enter as it interprets and varies that intention within the same readable structure. SVG does not supply the thinking power; it gives that power a literal architecture to act through without replacing the architecture with an unspecified image-making process.",
            ],
            [
              "The same qualities serve fully onchain construction. Raw, plain, descriptive SVG is compact enough to store, deterministic enough to render, and legible to people, Agents, contracts, and ordinary computing systems. One material can relay human intention, aesthetic architecture, Agent interpretation, machine action, and public preservation. This is an Inshell method within ",
              { label: "Agent Art", href: "/docs/agent-art" },
              ", not a requirement for Agent Art as a field.",
            ],
          ],
        },
        {
          id: "docs-fully-onchain-inshell",
          title: "How Inshell does it",
          paragraphs: [
            [
              "The pinned ",
              { label: "$PATH", href: "/docs/path" },
              " v0.5.0 renderer reads movement progress from contract state and draws the nine required Mono 76 glyph paths held in contract code. Its tokenURI returns self-contained JSON with the SVG embedded inside it.",
            ],
            [
              "The portable ",
              { label: "THOUGHT", href: "/docs/thought" },
              " V2 design stores the work record, binds its renderer and specification, and constructs its SVG from glyph data held in onchain code storage. Its qualified release proves the design and package, not a live deployment. The ",
              {
                label: "release and deployment boundary",
                href: "/docs/source-release-boundaries",
              },
              " keeps those claims separate.",
            ],
          ],
          sourceExamples: [
            {
              label: "$PATH SVG example",
              language: "svg",
              content: PATH_RAW_SVG_EXAMPLE,
            },
            {
              label: "THOUGHT SVG example",
              language: "svg",
              content: THOUGHT_RAW_SVG_EXAMPLE,
            },
          ],
        },
        {
          id: "docs-fully-onchain-boundary",
          title: "What the claim covers",
          paragraphs: [
            [
              "Fully onchain says where the canonical metadata and artwork come from. It does not replace the identity, provenance, attestation, release, or observation boundaries described in ",
              {
                label: "artwork, metadata, and chain",
                href: "/docs/artwork-metadata-chain",
              },
              ".",
            ],
          ],
          points: [
            "It does not by itself mean immutable, non-upgradeable, decentralized, verified, attested, or true.",
            "A repository and release make construction auditable; they are not runtime content hosts.",
            "No storage method proves authorship, Agent reasoning, artistic meaning, or the inward truth of a work.",
          ],
        },
      ],
      links: [
        {
          label: "read ERC-721 metadata ↗",
          href: "https://eips.ethereum.org/EIPS/eip-721",
        },
        { label: "read $PATH ↗", href: "/docs/path" },
        { label: "read THOUGHT ↗", href: "/docs/thought" },
        {
          label: "read source and release boundaries ↗",
          href: "/docs/source-release-boundaries",
        },
        { label: "view $PATH source ↗", href: SOURCE_REPOSITORIES.path },
        { label: "view THOUGHT source ↗", href: SOURCE_REPOSITORIES.thought },
      ],
    },
    {
      slug: "mono-76",
      id: "docs-mono-76",
      group: "systems",
      title: "Mono 76",
      summary: "Mono 76 is Inshell's sealed native-SVG type system for deterministic artwork text.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "Mono 76 gives selected Inshell works a fixed visual alphabet. Version 1.0.0 contains 76 ordered records: 75 visible glyphs and one metrics-only SPACE. Every visible glyph is an independently authored centerline SVG path with shared monospaced metrics.",
        "The sealed face emerged from a larger native-SVG glyph study. That research compared many construction systems for legibility, identity, punctuation, marketplace-scale resilience, deterministic rendering, and practical contract size. The released face came from the C02 Classic Book study, then received manual refinement and optical alignment before its paths and metrics were frozen.",
        [
          "Mono 76 is not the site's general interface font. Interface copy remains ordinary selectable text. Mono 76 is used where the letterform is part of the artwork or its deterministic renderer, including the ",
          { label: "THOUGHT", href: "/docs/thought" },
          " composition and the movement names drawn inside ",
          { label: "$PATH", href: "/docs/path" },
          " tokens.",
        ],
        "A renderer consumes path geometry rather than asking a browser to locate a font. This keeps the visible form independent of installed fonts, webfont loading, marketplace font support, and platform-specific text layout.",
      ],
      sections: [
        {
          id: "docs-mono-76-repertoire",
          title: "A closed repertoire",
          paragraphs: [
            "The ordered repertoire is SPACE, A-Z, a-z, 0-9, and . , ? ! : ; ' \" - ( ) / &. SPACE advances by the same fixed width as every other record but draws no path. Unsupported characters fail validation instead of being replaced by a fallback glyph.",
            "THOUGHT uses the same character repertoire for its Terminal English lines. Its additional byte and spacing rules belong to the THOUGHT specification; Mono 76 defines glyph support and geometry, not the whole creation protocol.",
            "The demo below renders the sealed records in repertoire order from the canonical path data. Its first advance is intentionally empty: that record is SPACE.",
          ],
          sourceExamples: [
            {
              label: "Mono 76 full set demo",
              language: "svg",
              content: MONO_76_FULL_SET_DEMO,
              presentation: "specimen",
            },
          ],
        },
        {
          id: "docs-mono-76-form",
          title: "Centerlines, not font outlines",
          paragraphs: [
            "The released face uses open centerline paths: no fill, a fixed round stroke, round caps and joins, fixed advance, no kerning, and one declared origin shift. Reviewed optical adjustments are baked into the path bytes so a renderer does not apply a second hidden tuning table.",
            "Source Code Pro was a visible comparison reference during study. Its outlines were neither imported nor traced into Mono 76 v1.0.0. The earlier outline-reference release is a separate historical artifact with different geometry and licensing; it is not the canonical face.",
          ],
        },
        {
          id: "docs-mono-76-native-svg",
          title: "Native SVG is the delivery form",
          paragraphs: [
            "Mono 76 is packaged as path data and a deterministic renderer, not as a WOFF or TTF webfont. Artwork renderers place the paths directly into SVG and must preserve the sealed metrics and stroke contract.",
            "THOUGHT consumes the packed IM76 repertoire for its terminal composition. $PATH embeds only the nine Mono 76 glyph paths needed to draw THOUGHT, WILL, and AWA. Each token image is therefore self-contained; viewing it does not require a font installation or an offchain text renderer.",
          ],
        },
        {
          id: "docs-mono-76-interface",
          title: "Artwork and interface stay distinct",
          paragraphs: [
            "The App does not register Mono 76 with CSS or replace ordinary interface typography with it. Navigation, documentation, forms, status messages, and accessibility text remain browser-readable interface copy. Mono 76 appears when the glyph shape itself belongs to a work or to the work's canonical visual system.",
          ],
        },
        {
          id: "docs-mono-76-release",
          title: "Pins prevent visual drift",
          paragraphs: [
            [
              "The sealed package includes the ordered face, packed onchain payload, renderer code, manifest, provenance, verification script, notices, and checksums. A downstream ",
              {
                label: "release",
                href: "/docs/source-release-boundaries",
              },
              " must consume that complete contract and pin its hashes rather than copying one convenient glyph file.",
            ],
            "THOUGHT and $PATH pin Mono 76 through their own contract releases. Updating the font repository does not change a pinned renderer or an already deployed contract. A new visual revision requires a new reviewed release and explicit downstream repinning; the App must continue reading canonical token artwork rather than silently redrawing it with newer paths.",
          ],
        },
      ],
      links: [
        { label: "read THOUGHT ↗", href: "/docs/thought" },
        { label: "read $PATH ↗", href: "/docs/path" },
        { label: "read artwork, metadata, and chain ↗", href: "/docs/artwork-metadata-chain" },
        { label: "read source and release boundaries ↗", href: "/docs/source-release-boundaries" },
      ],
    },
    {
      slug: "verification",
      id: "docs-verification",
      group: "systems",
      title: "Verification",
      summary: "Verification separates records, releases, observations, and claims before drawing conclusions.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          "Verification here concerns bounded public claims. It can test a signature, byte sequence, release, deployment, or chain record. It is not the truth named in ",
          { label: "Inshell", href: "/docs/inshell" },
          "'s artistic position: inspect self is a direction of practice, not a proposition these proofs can establish.",
        ],
        "Authority is the person or system that originates a claim. Loaded from names the immediate technical source used by the interface. A mirror is an indexed or cached copy, not a new authority. Display material is a presentation of a record, not the record itself.",
        "Provenance describes how a work or record came into being and which commitments connect its parts. Proof is the data evaluated by a specific verification rule. Neither word means that every recorded statement is true.",
        [
          "For a token, start from network, contract address, and token ID. Read contract state and tokenURI, identify the deployment and pinned release, recompute published commitments, validate the selected specification, and verify the ",
          {
            label: "Creation Attestation",
            href: "/docs/thought#docs-thought-provenance",
          },
          " when one is present.",
        ],
        "Contract-verified means the contract accepted the defined proof and bound records. Runtime-reported means a connector received the value from an Agent runtime. Selected means the App or human chose it. Artist-editorial means it expresses the practice. These evidence levels must not be collapsed into one claim.",
        "A valid Creation Attestation verifies one THOUGHT creation record under the rules of its contract release. It does not certify that a work is Agent Art or define the wider field.",
        [
          "The Verify page gathers official origins, ",
          { label: "wallet boundaries", href: "/docs/wallet-local-data" },
          ", active networks, deployed contracts, release locks, and the active THOUGHT specification. In-place explorer links remain useful for inspecting addresses and transactions on the active public chain.",
        ],
      ],
      sections: [
        {
          id: "docs-verification-terms",
          title: "Four terms that should not blur",
          points: [
            "Authority: the person or system that originates a claim.",
            "Loaded from: the immediate technical source used by the interface.",
            "Mirror: a copied or indexed representation of another source.",
            "Display material: a presentation of a record, not automatically its authority.",
          ],
          note: "A value can be loaded from a cache that mirrors a contract. The cache is the immediate source; the contract remains the authority for the mirrored fact.",
        },
        {
          id: "docs-verification-provenance",
          title: "Provenance and proof",
          paragraphs: [
            "Provenance explains how parts of a work or record are related across creation, rendering, selection, minting, and later display. Proof is narrower: it is the data accepted by a specific verification rule.",
            "A valid proof can establish that certain bytes, hashes, addresses, or signatures agree. It does not automatically make every surrounding narrative statement true.",
          ],
        },
        {
          id: "docs-verification-levels",
          title: "Evidence levels",
          points: [
            "Contract-verified: deployed code accepted the defined values or proof.",
            "Contract-release: a pinned artifact set defines expected code, schemas, or renderer material.",
            "Chain-observed: a public read describes state on one named network at an observation point.",
            "App-recorded: the App assembled, stored, or signed a record with a declared boundary.",
            "Runtime-reported: the Agent runtime or connector supplied the value.",
            "Artist-editorial: the statement describes the practice, meaning, or interpretation.",
          ],
        },
        {
          id: "docs-verification-checklist",
          title: "Work verification checklist",
          steps: [
            "Identify the network without inferring it from the website origin.",
            "Confirm the deployed contract address and token ID.",
            "Read the contract's typed work state and tokenURI.",
            "Identify the matching release and deployment record.",
            "Validate published hashes, schema constraints, renderer commitments, and the selected specification.",
            "Verify a Creation Attestation when present, or report that the work is Unattested.",
            "Name mirrors, caches, runtime reports, and editorial claims without promoting them to contract facts.",
          ],
        },
      ],
      links: [
        { label: "open verification ↗", href: "/verify" },
        {
          label: "read the chain-first verifier guide ↗",
          href: `${SOURCE_REPOSITORIES.app}/blob/main/docs/THOUGHT_PROVENANCE_VERIFIER.md`,
        },
      ],
    },
    {
      slug: "wallet-local-data",
      id: "docs-wallet",
      group: "systems",
      title: "Wallet and Local Data",
      summary: "Wallet actions, browser storage, Agent runs, and chain records cross different trust boundaries.",
      status: "current",
      authorities: ["app-documentation"],
      paragraphs: [
        [
          "When an approved deployment is available, the shell wallet menu reads the current account and network. Its Refresh action updates wallet and ",
          { label: "$PATH", href: "/docs/path" },
          " inventory reads. Opening the menu itself never asks for a signature or transaction.",
        ],
        [
          "Product CTAs open wallet requests only when an action needs one: connect, mint $PATH, sign a one-mint $PATH permission, or mint ",
          { label: "THOUGHT", href: "/docs/thought" },
          ". Canceling a wallet request submits nothing.",
        ],
        "Without an approved deployment, Connect wallet opens guidance toward THOUGHT creation rather than a wallet connection. Mint on an accepted THOUGHT work explains that minting is not open. These controls request no account access, signature, transaction, network switch, or contract read.",
        "A signature can authorize a narrowly defined action without sending a transaction or paying gas. A transaction can change chain state and requires wallet confirmation. The interface must name which one it is requesting.",
        "Save and Load use browser storage. Agent run state is held by the App backend for the run window. Neither is an onchain token, a portable account, or a cross-device record.",
        "Local Anvil, Sepolia, and Ethereum are separate chains with separate contracts, balances, and tokens. Local tokens belong only to the local dev chain. Normal App development preserves that chain across restarts; an explicit reset or redeployment can replace it.",
      ],
      sections: [
        {
          id: "docs-wallet-passive",
          title: "Reading is not signing",
          paragraphs: [
            "Opening the wallet menu, refreshing account state, loading $PATH inventory, or reading public token records should not request a signature or transaction. These are passive reads.",
            "A product action can open a wallet only when it needs account access, a signature, a network switch, or a transaction. The interface should name that boundary before the request appears.",
          ],
        },
        {
          id: "docs-wallet-actions",
          title: "Signature versus transaction",
          points: [
            "Connect: gives the App access to the selected public account and network.",
            "Signature: authorizes the exact message shown by the wallet; it uses no gas and does not change chain state by itself.",
            "Transaction: calls a contract, can transfer value or change state, and requires wallet confirmation.",
            "Cancellation: submits nothing. A canceled or rejected request should not be treated as partial success.",
          ],
        },
        {
          id: "docs-wallet-storage",
          title: "Browser storage and Agent runs",
          paragraphs: [
            "Saved THOUGHT candidates live in the current browser. Temporary Agent run state lives within its App-defined run window. These records may be useful during creation, but they are not tokens, public provenance, or synchronized accounts.",
          ],
          note: "Clearing browser data, changing browsers, or moving to another device can make local saves unavailable.",
        },
        {
          id: "docs-wallet-networks",
          title: "Networks do not merge",
          paragraphs: [
            "Local Anvil, Sepolia, and Ethereum have different chain IDs, deployments, balances, transaction histories, and token identities. A familiar token number or account address on two networks does not make the records equivalent.",
          ],
        },
      ],
    },
    {
      slug: "source-release-boundaries",
      id: "docs-source",
      group: "systems",
      title: "Source and Release Boundaries",
      summary: "Source ownership, release artifacts, deployments, and publication are versioned independently.",
      status: "current",
      authorities: ["app-documentation", "contract-release"],
      paragraphs: [
        [
          "The Inshell App, ",
          { label: "$PATH", href: "/docs/path" },
          " contracts, ",
          { label: "THOUGHT", href: "/docs/thought" },
          " contracts, and ",
          { label: "Pulse", href: "/docs/pulse" },
          " auction have separate repositories and ownership boundaries. The App owns creation flow, integration, and presentation. Each contract repository owns its contract behavior and release artifacts. Deployment operators own network deployment records.",
        ],
        "The App consumes pinned ABIs, bytecode, schemas, renderer data, specifications, manifests, and checksums. A repository's latest source is not automatically the deployed release. A newer file is not authority for an older deployment.",
        "Contract releases contain code and integrity material; network addresses and deployment blocks come from a separately verified deployment record. A correct integration matches the App pin, release artifacts, deployed bytecode, renderer commitments, and active network.",
        "Documentation can describe repository source, a pinned release, or observed chain state. It must say which. Mirrors and previews are useful distribution surfaces but do not silently become canonical origins.",
      ],
      sections: [
        {
          id: "docs-source-ownership",
          title: "Repository ownership",
          points: [
            "The Inshell App repository owns same-origin presentation, orchestration, API behavior, and integration pins.",
            "The $PATH repository owns $PATH contracts and their release artifacts.",
            "The THOUGHT repository owns THOUGHT contracts, specifications, renderer releases, and their integrity material.",
            "The Pulse repository owns the auction contract and pricing mechanism release.",
          ],
        },
        {
          id: "docs-source-pins",
          title: "Why pins matter",
          paragraphs: [
            "A repository can continue changing after a contract is deployed. The App therefore consumes selected ABIs, bytecode, schemas, renderer payloads, manifests, and checksums instead of assuming that the newest source describes every historical token.",
          ],
        },
        {
          id: "docs-source-deployment",
          title: "Release is not deployment",
          paragraphs: [
            [
              "A release may be complete without being deployed. A deployment record adds the network, contract addresses, deployment blocks, and integration choices needed to find it onchain. ",
              { label: "Verification", href: "/docs/verification" },
              " joins both records and checks deployed bytecode where possible.",
            ],
            "The App's deployment lock is an always-enforced, versioned integrity reference. It records either no approved deployment or one exact approved deployment. Both are valid locked states; unexpected configuration differences are drift, not a reason to rewrite the reference.",
            "Recording an approved deployment does not activate signing or open minting. Activation approvals and fresh, matching onchain opening evidence are separate requirements. Intentional reference changes require review and, for an approved deployment, verified deployment evidence.",
          ],
        },
        {
          id: "docs-source-publication",
          title: "Publication boundaries",
          paragraphs: [
            "Canonical pages, Markdown documents, JSON indexes, API responses, GitHub mirrors, preview deployments, and third-party explorers serve different readers. Linking or mirroring improves access; it does not silently transfer authority.",
          ],
          note: "When documentation describes live chain state, name the network and observation point. When it describes a release, name the release rather than relying on the checked-out repository branch.",
        },
      ],
      links: [
        { label: "Inshell App source ↗", href: SOURCE_REPOSITORIES.app },
        { label: "$PATH source ↗", href: SOURCE_REPOSITORIES.path },
        { label: "THOUGHT source ↗", href: SOURCE_REPOSITORIES.thought },
        { label: "Pulse source ↗", href: SOURCE_REPOSITORIES.pulse },
      ],
    },
    {
      slug: "lineage",
      id: "docs-lineage",
      group: "context",
      title: "Lineage",
      summary:
        "Separating the person who specifies a work from whatever carries it out is an old move in art; Agent Art inherits the question, not the authority.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Agent Art is new as a name. The questions underneath it are not. Art has repeatedly split the person who specifies a work from the person or process that executes it, and has repeatedly asked what remains of authorship after the split.",
        "Inshell reads that history as context, not as permission. Naming a precedent does not inherit its authority and does not make this practice a continuation of anyone else's.",
      ],
      sections: [
        {
          id: "docs-lineage-instruction",
          title: "Instruction and execution",
          paragraphs: [
            "Sol LeWitt's wall drawings exist as written instructions together with a signed certificate. Other people execute them on a wall, and two executions of the same instruction can differ while remaining the same work. LeWitt's stated position was that the concept is the primary part of the work rather than the surface that results from it.",
            "That arrangement makes a specific claim: a work can be a rule plus a record of authorization, and the visible object can be downstream of both. An artwork built that way survives the loss of any particular execution.",
          ],
        },
        {
          id: "docs-lineage-scores",
          title: "Scores realized by others",
          paragraphs: [
            "Fluxus developed the same idea as a score. George Brecht's event scores of the early 1960s are short directives that someone performs, publicly or privately. Yoko Ono's Grapefruit, published in 1964, collects instructions whose realization is often left to the reader's mind rather than to any material.",
            "A score is written to be realized by someone other than its author, and it stays open to variation without becoming a different work. The score and its realizations are two different things, and both can be preserved.",
          ],
        },
        {
          id: "docs-lineage-reader",
          title: "Who completes the work",
          paragraphs: [
            "Marcel Duchamp argued that the creative act is not finished by the artist alone, and that the viewer completes it by interpreting the work into the world. Roland Barthes made a parallel argument for text in 1967: meaning is produced where a work is read, not sealed by the author's intention.",
            "Inshell's practice depends on this. A preserved exchange is not self-explaining. The person who later reads it is doing part of the work, which is why the practice asks for inspection rather than agreement.",
          ],
        },
        {
          id: "docs-lineage-difference",
          title: "Where Agent Art differs",
          paragraphs: [
            "In instruction art the executor is a person following a score, or a machine following a rule the artist wrote. In either case the specification and the execution are separated, but the executor does not interpret in the sense that matters here.",
            [
              "An Agent does more than execute: it interprets. Inshell calls this functional capacity thinking power, and an intent formed through it enters the work. The instruction does not fully determine the result, and the result is not random either. That is the gap ",
              { label: "Agent Art", href: "/docs/agent-art" },
              " names, and it is why intentional participation rather than automation is the invariant.",
            ],
            [
              "Inshell's response is to preserve both sides. ",
              { label: "THOUGHT", href: "/docs/thought" },
              " keeps one exact human prompt beside one exact Agent response, so the score and its realization stay in a single record and can be read against each other. That is one Inshell choice, not a requirement of the field.",
            ],
          ],
        },
        {
          id: "docs-lineage-boundary",
          title: "Evidence boundary",
          paragraphs: [
            "The artists, works, and dates named here are public references to other people's practices. Inshell does not verify them onchain, claim affiliation or endorsement, or present this reading as art-historical consensus.",
          ],
          note: "A named precedent locates a question. It does not transfer authority to the practice that cites it.",
        },
      ],
      links: [
        { label: "read Agent Art", href: "/docs/agent-art" },
        { label: "read THOUGHT", href: "/docs/thought" },
        { label: "read Generative Art", href: "/docs/generative-art" },
        {
          label: "Sol LeWitt ↗",
          href: "https://en.wikipedia.org/wiki/Sol_LeWitt",
        },
        { label: "Fluxus ↗", href: "https://en.wikipedia.org/wiki/Fluxus" },
      ],
    },
    {
      slug: "generative-art",
      id: "docs-generative-art",
      group: "context",
      title: "Generative Art",
      summary:
        "Inshell's pivot from generative art toward Agent Art began when a fixed procedure no longer exhausted what a machine could contribute to a work.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Generative art makes the rule part of the work. The artist writes a procedure, the procedure produces the artifact, and attention moves from the individual mark to the system that produced it.",
        "Inshell's generative-art period is part of its route into Agent Art. The continuity is composing with a machine; the change is whether the machine executes a procedure or participates through interpretation. Stating that difference keeps both practices legible instead of collapsing them into one category.",
      ],
      sections: [
        {
          id: "docs-generative-origins",
          title: "1965 and generative aesthetics",
          paragraphs: [
            "Three 1965 exhibitions are generally treated as the first public showings of computer-generated graphics: Georg Nees in Stuttgart in February, A. Michael Noll and Bela Julesz at the Howard Wise Gallery in New York in April, and Frieder Nake with Nees in Stuttgart in November. The philosopher Max Bense, who encouraged the Stuttgart work, coined the term generative aesthetics around the February showing.",
            "Vera Molnár and Manfred Mohr began working with computers toward the end of that decade. Molnár is notable in the group for arriving from a lifelong painting practice rather than from science, which is part of why her work reads as art using a machine rather than a machine demonstrating art.",
          ],
        },
        {
          id: "docs-generative-onchain",
          title: "The onchain turn",
          paragraphs: [
            "Art Blocks launched in November 2020 with Erick Calderon's Chromie Squiggle. A project's generating script is stored in a contract. When a collector mints, the transaction yields a 32-byte hash, and that hash is injected into the script as its seed. The same hash and the same script always produce the same output.",
            "This established a pattern that much later onchain work follows: store the rule, take the variation from the chain, and derive the image on demand rather than storing it. The artwork becomes reproducible from public state.",
          ],
        },
        {
          id: "docs-generative-thinking-power",
          title: "The gate from algorithm to thinking power",
          paragraphs: [
            "A generative system generally places a piece of code between input and output. The code applies a procedure the artist has composed. Its power is that one legible system can produce many artifacts, but the procedure remains the source of what the machine does.",
            "With AI Agents, Inshell encountered another machine capacity: an Agent can interpret, reason, choose, and act rather than only apply one fixed procedure. Inshell calls this thinking power. The phrase does not claim that machine and human thought are identical; it names functions of thinking that Agents increasingly undertake in work once performed by human minds.",
            [
              "This recognition formed the gate from Inshell's generative-art period toward ",
              { label: "Agent Art", href: "/docs/agent-art" },
              ". If AI is approached as a thinking machine, using it only as another fixed algorithm leaves its distinguishing capacity outside the work. The primitive question became: how can a work be composed so that an Agent's thinking power, and some intent formed through it, participates?",
            ],
            "That question was a clue, not a complete definition. Agent Art names the wider field through intentional participation rather than through one technology, procedure, or Inshell practice.",
          ],
        },
        {
          id: "docs-generative-difference",
          title: "Seed is not intention",
          paragraphs: [
            "In seeded generative art the source of variation is a number that nobody chose for its meaning. Its role is to be unpredictable and fairly distributed, and any meaning it carries is assigned afterward.",
            [
              "In ",
              { label: "THOUGHT", href: "/docs/thought" },
              " the source of variation is a written human intention and an Agent's response to it. Both are authored text, and neither is random. What varies between two works is what somebody meant and how an Agent read it.",
            ],
            "This changes what preservation has to hold. A seeded work can be regenerated from its seed, so storing the rule and the seed is enough. An exchange cannot be regenerated from a seed, because the exchange is the content. Inshell therefore preserves the exchange itself rather than a procedure for recreating it.",
            "This is a description of two methods, not a ranking of them.",
          ],
        },
        {
          id: "docs-generative-boundary",
          title: "Evidence boundary",
          paragraphs: [
            "Exhibitions, dates, platforms, and mechanisms named here are public references. Inshell has not audited the contracts or archives behind them, claims no affiliation, and does not present this account as a complete history of the field.",
          ],
        },
      ],
      links: [
        { label: "read Agent Art", href: "/docs/agent-art" },
        { label: "read THOUGHT", href: "/docs/thought" },
        { label: "read Onchain Art", href: "/docs/onchain-art" },
        {
          label: "Frieder Nake ↗",
          href: "https://en.wikipedia.org/wiki/Frieder_Nake",
        },
        { label: "Art Blocks ↗", href: "https://www.artblocks.io/" },
      ],
    },
    {
      slug: "agents-and-ai",
      id: "docs-agents-and-ai",
      group: "context",
      title: "Agents and AI",
      summary:
        "A program executes, a model samples, and an Agent can bring thinking power into a work; Agent Art turns on whether intent formed through that power participates.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "The machine's role in making images has changed at least three times: a program that executes rules an artist wrote, a model that learns a distribution and samples from it, and an Agent that plans, calls tools, and acts across several steps.",
        "Agent Art names intentional participation, not a model class. The shift matters because an Agent can interpret and form intent rather than only execute or sample; merely invoking an architecture, runtime, or service is not enough. Keeping the three eras distinct is what makes that claim precise rather than fashionable.",
      ],
      sections: [
        {
          id: "docs-agents-program",
          title: "The program era",
          paragraphs: [
            "Harold Cohen named AARON in 1973 and developed it during a residency at Stanford's Artificial Intelligence Laboratory in the mid-1970s. AARON combined explicit compositional rules with random events to produce drawings, and Cohen maintained and rewrote it for roughly four decades.",
            "The rules were authored by a person and executed by a program. Where the work came from was never in question, because the artist had written the procedure that made it.",
          ],
        },
        {
          id: "docs-agents-model",
          title: "The model era",
          paragraphs: [
            "Generative adversarial networks moved image-making from written rules to learned distributions. A GAN portrait sold at Christie's in October 2018 for $432,500; the collective that submitted it had built on open-source code published by another researcher, and the credit question was never settled.",
            "That dispute is the characteristic problem of the era. When the rules are learned rather than written, it becomes genuinely unclear where authorship sits: in the training data, the architecture, the code, the weights, or the person who pressed the button.",
            "Text-to-image diffusion systems made this ordinary. DALL·E 2 appeared in April 2022 and Stable Diffusion in August 2022. A prompt selects a region of a learned space, and that space carries broad aesthetic conventions the prompt never specified.",
          ],
        },
        {
          id: "docs-agents-agent",
          title: "The Agent era",
          paragraphs: [
            "An Agent is normally distinguished from a model by what it does rather than what it is. It plans, selects and calls tools, acts over multiple steps, checks results, and adapts. The model is a component inside that behaviour; the Agent is the behaviour. Inshell calls this functional capacity thinking power.",
            [
              "Thinking power alone does not establish artistic participation. For ",
              { label: "Agent Art", href: "/docs/agent-art" },
              ", it becomes participation only when some intent enters the work through how the Agent interprets, chooses, proposes, directs, or acts. This is why Agent Art asks whether an Agent's intent enters the work rather than which architecture produced a pixel. Running an Agent through a runtime or service, or assigning it an executor role, does not satisfy the invariant by itself. Appearing in the subject matter or the marketing certainly does not.",
            ],
          ],
        },
        {
          id: "docs-agents-word",
          title: "Why Inshell says Agent",
          paragraphs: [
            "AI names a research field and a marketing category, and its meaning shifts with each cycle of attention. Agent names a participant in an activity, which is the thing the field is actually about.",
            [
              "The narrower word also fits the practice's origin. A model label, a terminal, a command line, and a technical wrapper are among the shells ",
              { label: "Inshell", href: "/docs/inshell" },
              " names. Calling the participant an Agent keeps attention on what it does rather than on the shell it arrives in.",
            ],
          ],
        },
        {
          id: "docs-agents-boundary",
          title: "Evidence boundary",
          paragraphs: [
            "Systems, dates, and sale figures here are public references. Inshell does not verify them, endorse them, or claim any relation to the parties named.",
            [
              "Nothing in this topic describes the Agent behaviour of a particular Inshell work. Agent runs vary by provider, model version, and runtime, and are reported at a lower evidence level than contract or chain facts. Read ",
              { label: "THOUGHT", href: "/docs/thought" },
              " and ",
              { label: "Verification", href: "/docs/verification" },
              " for what is actually claimed about a work.",
            ],
          ],
        },
      ],
      links: [
        { label: "read Agent Art", href: "/docs/agent-art" },
        { label: "read Inshell", href: "/docs/inshell" },
        { label: "read Verification", href: "/docs/verification" },
        {
          label: "Harold Cohen and AARON ↗",
          href: "https://computerhistory.org/blog/harold-cohen-and-aaron-a-40-year-collaboration/",
        },
      ],
    },
    {
      slug: "svg",
      id: "docs-svg",
      group: "context",
      title: "SVG",
      summary:
        "SVG is a text document that describes shapes, which is why a person, a browser, a contract, and an Agent can all read the same artwork.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Most image formats are containers of pixels. SVG is a document that describes shapes. Inshell treats that difference as the reason to use it as a material rather than as an export format.",
      ],
      sections: [
        {
          id: "docs-svg-standard",
          title: "A public document format",
          paragraphs: [
            "The W3C began work on SVG in 1998. SVG 1.0 became a Recommendation on 4 September 2001 and SVG 1.1 on 14 January 2003; SVG 2 has remained at Candidate Recommendation. The format is XML, which means an SVG file is text and the text is the picture.",
            "Because it is a public standard with several independent implementations, an SVG stays readable without any one vendor's software remaining in business. That property matters more for a work meant to last than any particular rendering feature does.",
          ],
        },
        {
          id: "docs-svg-readers",
          title: "Four kinds of reader",
          paragraphs: [
            "A person can read an SVG and follow what it draws. A browser can render it. A contract can assemble it from strings and return it. An Agent can inspect it, locate a specific element, and change that element without disturbing the rest.",
            [
              "Few materials are legible to all four. SVG does not create an Agent's thinking power; it gives that power a literal architecture to interpret and act through. That overlap lets one file carry human intention, ",
              {
                label: "aesthetic architecture",
                href: "/docs/glossary#docs-glossary-aesthetic-architecture",
              },
              ", Agent interpretation, machine action, and public preservation at once, which is the argument made in full under ",
              { label: "Fully Onchain", href: "/docs/fully-onchain#docs-fully-onchain-agent-art" },
              ".",
            ],
          ],
        },
        {
          id: "docs-svg-cost",
          title: "Bytes are the constraint",
          paragraphs: [
            [
              "Onchain, size is not a preference but a price. A vector description of a detailed image can occupy a few kilobytes where a raster of the same image would be far larger, and on ",
              { label: "Ethereum", href: "/docs/ethereum" },
              " that difference is paid in gas at mint and stored forever.",
            ],
            "SVG is unusual in making the compact option and the readable option the same option. Compression that produced smaller but unreadable bytes would lose the property the material was chosen for.",
          ],
        },
        {
          id: "docs-svg-inshell",
          title: "How Inshell narrows it",
          paragraphs: [
            [
              "Inshell uses raw, plain, descriptive SVG and carries letterforms as path geometry rather than as webfont references, so a work depends on nothing outside its own bytes. ",
              { label: "Mono 76", href: "/docs/mono-76" },
              " is the sealed type system that makes text in artwork behave that way.",
            ],
            "This is a material choice inside one practice. SVG is not required for fully onchain work, and it is not required for Agent Art as a field.",
          ],
        },
        {
          id: "docs-svg-boundary",
          title: "Evidence boundary",
          paragraphs: [
            "Specification names and dates are public W3C facts and are cited as orientation. How Inshell actually builds and pins its SVG is described under Fully Onchain and Mono 76, which carry contract-release authority; this topic carries none.",
          ],
        },
      ],
      links: [
        { label: "read Fully Onchain", href: "/docs/fully-onchain" },
        { label: "read Mono 76", href: "/docs/mono-76" },
        { label: "read Ethereum", href: "/docs/ethereum" },
        {
          label: "SVG 1.1 specification ↗",
          href: "https://www.w3.org/TR/SVG11/",
        },
      ],
    },
    {
      slug: "ethereum",
      id: "docs-ethereum",
      group: "context",
      title: "Ethereum",
      summary:
        "The chain is a deterministic public machine with a price on every byte, and that price is a formal constraint rather than an inconvenience.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Ethereum gives an artwork three unusual properties: a public machine that anyone can re-run and get the same answer, a record no single party can quietly revise, and a price on every byte stored.",
        "The third property is the one that shapes form.",
      ],
      sections: [
        {
          id: "docs-ethereum-machine",
          title: "A deterministic public machine",
          paragraphs: [
            "The Ethereum Virtual Machine executes contract code identically on every node that runs it. A function that assembles an image returns the same bytes to everyone who calls it against the same state, without a server deciding what to send.",
            "That determinism is what allows a contract to act as a renderer rather than only as a ledger. The artwork is not a file the contract points at; it can be a value the contract computes.",
          ],
        },
        {
          id: "docs-ethereum-cost",
          title: "Every byte has a price",
          paragraphs: [
            "Contract storage is charged per 32-byte word, and writing a fresh word costs on the order of twenty thousand gas, which puts a kilobyte of stored data on the order of hundreds of thousands of gas. Practitioners reduce this with techniques such as packing, contract-bytecode storage, and libraries in the SSTORE2 family, but the cost never becomes negligible.",
            "Onchain artwork is therefore written under a budget. Compactness is not a stylistic preference; it is the condition of existing onchain at all.",
          ],
        },
        {
          id: "docs-ethereum-bounds",
          title: "The budget is a bound",
          paragraphs: [
            [
              "Inshell already holds that bounds create form, and the price of a byte is one of those bounds. It rules out casual accumulation and rewards descriptions that are exact, which is the same discipline described under ",
              { label: "Design Principles", href: "/docs/design-principles" },
              " arriving from the direction of cost rather than from the direction of intent.",
            ],
            "A constraint that comes from the material is harder to abandon than one the artist merely declared. This one is enforced by the network on every mint.",
          ],
        },
        {
          id: "docs-ethereum-datauri",
          title: "The token can carry the work",
          paragraphs: [
            [
              "A contract can return a data URI from its metadata function, embedding the metadata document and the image itself instead of an address where they might be found. Reading the token then is reading the work, with no host involved. That arrangement is what ",
              { label: "Fully Onchain", href: "/docs/fully-onchain" },
              " describes for Inshell, and what ",
              { label: "Tokens and NFTs", href: "/docs/tokens-and-nfts" },
              " contrasts with ordinary pointer practice.",
            ],
          ],
        },
        {
          id: "docs-ethereum-boundary",
          title: "Evidence boundary",
          paragraphs: [
            [
              "Gas figures here describe published EVM pricing at order-of-magnitude precision and change with network upgrades. They are not quoted as current values for any chain, and they are not measurements of any Inshell deployment. Networks, addresses, and deployment facts for Inshell's own contracts belong to ",
              { label: "Contracts", href: "/docs/contracts" },
              " and ",
              { label: "Verification", href: "/docs/verification" },
              ".",
            ],
          ],
        },
      ],
      links: [
        { label: "read Fully Onchain", href: "/docs/fully-onchain" },
        { label: "read Contracts", href: "/docs/contracts" },
        { label: "read Tokens and NFTs", href: "/docs/tokens-and-nfts" },
        {
          label: "ERC-721 standard ↗",
          href: "https://eips.ethereum.org/EIPS/eip-721",
        },
      ],
    },
    {
      slug: "tokens-and-nfts",
      id: "docs-tokens-and-nfts",
      group: "context",
      title: "Tokens and NFTs",
      summary:
        "A token is a record that names a work; most tokens only point at one, and pointers decay.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "ERC-721 gave Ethereum a standard way to say that a particular token is one of a kind and belongs to a particular address. It was proposed by William Entriken, Dieter Shirley, Jacob Evans, and Nastassia Sachs in January 2018, and it is why a token can be transferred, sold, and read consistently across wallets, explorers, and marketplaces.",
        "What the standard does not do is hold the artwork.",
      ],
      sections: [
        {
          id: "docs-tokens-pointer",
          title: "The metadata function is a pointer",
          paragraphs: [
            "The standard's metadata extension returns a URI for each token. In common practice that URI addresses a JSON document on a web server or through an IPFS gateway, and the JSON in turn addresses an image somewhere else again.",
            "Ownership is onchain. The picture usually is not. A token can be perfectly valid, perfectly transferable, and show nothing at all.",
          ],
        },
        {
          id: "docs-tokens-decay",
          title: "Pointers decay",
          paragraphs: [
            "Published surveys of large NFT samples have repeatedly found substantial fractions with token URIs that no longer resolve, image paths that are broken, or IPFS content unreachable through the gateway named in the record. Reported figures have run to roughly a fifth of the sampled tokens.",
            "Collections have also lost their images when a company changed access rules on the servers holding them, leaving holders with valid tokens and no picture. In most cases this is not fraud. It is ordinary infrastructure entropy applied to a record that was supposed to outlast infrastructure.",
          ],
        },
        {
          id: "docs-tokens-inshell",
          title: "What Inshell takes and refuses",
          paragraphs: [
            "Inshell uses the token standard for what it does well: a public, transferable, consistently readable record of which work is which and which address holds it.",
            [
              "Inshell refuses the pointer. The canonical image and metadata are returned by the contract itself, so no host stands between the record and the work. ",
              { label: "Fully Onchain", href: "/docs/fully-onchain" },
              " states that arrangement and its limits precisely.",
            ],
            "This is a choice about where a work lives. It is not a claim that pointer-based tokens are not art, and not a claim that Inshell's arrangement is safe from every failure.",
          ],
        },
        {
          id: "docs-tokens-boundary",
          title: "Evidence boundary",
          paragraphs: [
            [
              "Survey percentages come from third-party studies of particular samples at particular times and are cited as orders of magnitude, not current measurements. Inshell has not reproduced them and does not name the collections involved. Claims about Inshell's own tokens belong to ",
              { label: "Artwork, Metadata, and Chain", href: "/docs/artwork-metadata-chain" },
              " and ",
              { label: "Verification", href: "/docs/verification" },
              ".",
            ],
          ],
        },
      ],
      links: [
        { label: "read Fully Onchain", href: "/docs/fully-onchain" },
        {
          label: "read Artwork, Metadata, and Chain",
          href: "/docs/artwork-metadata-chain",
        },
        { label: "read Onchain Art", href: "/docs/onchain-art" },
        {
          label: "ERC-721 standard ↗",
          href: "https://eips.ethereum.org/EIPS/eip-721",
        },
      ],
    },
    {
      slug: "onchain-art",
      id: "docs-onchain-art",
      group: "context",
      title: "Onchain Art",
      summary:
        "Onchain is a spectrum, and the useful question is which part of a work the chain actually holds.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Calling a work onchain says little on its own. A chain can hold the ownership record, the generating rule, the finished image, or only a hash of something kept elsewhere. These are different claims with different consequences.",
      ],
      sections: [
        {
          id: "docs-onchain-degrees",
          title: "Degrees of onchain",
          paragraphs: [
            "Four arrangements are common. The record is onchain and the artwork sits at a web address. The record is onchain and the artwork is content-addressed offchain. The rule is onchain and the image is derived by re-running it. Or the image bytes are assembled onchain and returned directly.",
            "Only the last two survive the disappearance of every host. The first two describe where a work is filed rather than where it lives.",
          ],
        },
        {
          id: "docs-onchain-precedents",
          title: "Public precedents",
          paragraphs: [
            "Autoglyphs, released by Larva Labs in 2019 as a set of 512, embedded its generator in the contract so the network itself ran the code that produced each work, and the generator stopped once the supply was reached.",
            "Art Blocks, from late 2020, keeps the generating script in a contract and takes each token's seed from its mint transaction. Projects including Blitmap, Nouns, and Chain Runners store vector or pixel assets in contract storage and assemble the image when metadata is requested; several released their work under CC0, treating the onchain asset as something others are free to extend.",
          ],
        },
        {
          id: "docs-onchain-inshell",
          title: "Where Inshell sits",
          paragraphs: [
            [
              "Inshell assembles the completed SVG inside the contract and returns it in token metadata, so the canonical image needs no image server and no webfont. The full account, including what the arrangement does not cover, is under ",
              { label: "Fully Onchain", href: "/docs/fully-onchain" },
              ".",
            ],
            "Inshell also keeps the claim narrow. Fully onchain is a statement about chain sufficiency for specific content. It is not a synonym for immutable, non-upgradeable, decentralized, deployed, verified, or good, and each of those would need its own evidence.",
          ],
        },
        {
          id: "docs-onchain-boundary",
          title: "Evidence boundary",
          paragraphs: [
            "Other projects are named as public reference points. Inshell has not audited their contracts, does not verify their present behaviour, and claims no affiliation with them. Descriptions refer to publicly documented designs, and designs change after they are documented.",
          ],
          note: "Do not read a project's presence in this list as endorsement, comparison of quality, or a claim about its current state.",
        },
      ],
      links: [
        { label: "read Fully Onchain", href: "/docs/fully-onchain" },
        { label: "read Generative Art", href: "/docs/generative-art" },
        { label: "read Tokens and NFTs", href: "/docs/tokens-and-nfts" },
        {
          label: "Autoglyphs ↗",
          href: "https://www.larvalabs.com/autoglyphs",
        },
      ],
    },
    {
      slug: "design-principles",
      id: "docs-design-principles",
      group: "context",
      title: "Design Principles",
      summary: "Inshell's design rules connect participation, visible form, and the limits of evidence.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "Inshell's works connect artistic meaning to operating rules. A response limit, a serial auction, a movement capacity, a renderer pin, or an evidence label is not merely backstage implementation. Each rule changes what participants can do and what later readers can know.",
        "Six design choices recur across Inshell's systems: collaboration is bounded, thinking power participates inside held architecture, the authority to continue or preserve is explicit, mechanisms stay visible, canonical sources remain identifiable, and claims stop where their evidence stops. They give the practice form as it approaches truth without claiming possession. They are choices of practice, not a doctrine, a set of propositions to prove, or a definition of Agent Art.",
      ],
      sections: [
        {
          id: "docs-design-bounds",
          title: "Bounds create form",
          paragraphs: [
            [
              { label: "THOUGHT", href: "/docs/thought" },
              " allows one prompt, one Agent response, exact byte rules, and one human mint decision. ",
              { label: "Pulse", href: "/docs/pulse" },
              " allows one active epoch and one next public $PATH. ",
              { label: "$PATH", href: "/docs/path" },
              " exposes an ordered movement sequence with configured capacities. These constraints make the resulting differences legible.",
            ],
            [
              "Within THOUGHT, more options would not automatically create more expressive work. Its boundary concentrates attention on the choices that remain: which intention to write, which response to preserve, which $PATH to use, and how to read the record afterward. Other ",
              { label: "Agent Art", href: "/docs/agent-art" },
              " practices may choose different boundaries and forms.",
            ],
          ],
        },
        {
          id: "docs-design-thinking",
          title: "Architecture holds; thinking participates",
          paragraphs: [
            [
              "Inshell distinguishes writing a procedure that determines what a machine does from composing an architecture in which an Agent can interpret and choose. The first uses ",
              {
                label: "algorithmic execution",
                href: "/docs/glossary#docs-glossary-algorithmic-execution",
              },
              "; the second makes room for thinking power and intent formed through it.",
            ],
            "The artist still holds the aesthetic and evidentiary architecture. Agent thinking participates inside those bounds rather than replacing them with opaque generic output or being treated as unconstrained autonomy. This is an Inshell design choice, not a requirement for Agent Art as a field.",
          ],
        },
        {
          id: "docs-design-selection",
          title: "Generation is not preservation",
          paragraphs: [
            "A system can produce a candidate without declaring it part of the public corpus. In Inshell's onchain practices, THOUGHT separates Agent return from human review and successful mint, while Pulse separates a visible ask from a participant's confirmed bid. Their contract actions are specific preservation boundaries, not a universal rule for Agent Art.",
          ],
        },
        {
          id: "docs-design-visible-mechanism",
          title: "Mechanism stays visible",
          paragraphs: [
            "Pulse shows the curve, floor, premium, sale points, and current ask. $PATH shows movement totals and use. THOUGHT publishes its language boundary, renderer, metadata, and attestation model. The mechanism is not hidden after it produces an output because understanding the mechanism changes how the output can be experienced.",
          ],
        },
        {
          id: "docs-design-canonical",
          title: "One canonical form, many reading surfaces",
          paragraphs: [
            "An onchain Inshell work can appear on the site, in a wallet, on a marketplace, through an API, in Markdown, or inside an Agent's answer. Those surfaces can add access and context. They should still point back to the network, contract, tokenURI, pinned release, and declared record authority that make that work identifiable.",
          ],
        },
        {
          id: "docs-design-claims",
          title: "Transparency without overclaiming",
          paragraphs: [
            [
              { label: "Public provenance", href: "/docs/verification" },
              " is useful because it connects exact values and names where they came from. It becomes weaker when every field is described as verified in the same way. Inshell therefore distinguishes contract validation, release facts, live chain observations, App records, runtime reports, and artist statements.",
            ],
            "The aim is not to make uncertainty disappear. It is to make the boundary of each claim inspectable.",
          ],
        },
        {
          id: "docs-design-time",
          title: "The work continues through time",
          paragraphs: [
            "Pulse changes with every sale and every interval between sales. A $PATH accumulates movement use. The THOUGHT corpus grows one selected pair at a time. Releases and deployments create historical layers that must remain readable as interfaces change.",
            "This makes documentation part of preservation. It records visible interactions and keeps the work's form, permissions, and evidence connected over time.",
          ],
        },
      ],
      links: [
        { label: "create a THOUGHT ↗", href: "/thought" },
        { label: "view the Pulse field ↗", href: "/path" },
        { label: "inspect verification boundaries ↗", href: "/verify" },
      ],
    },
    {
      slug: "glossary",
      id: "docs-glossary",
      group: "context",
      title: "Glossary",
      summary:
        "Working definitions of the terms these documents depend on, each pointing to the article that owns the full account.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation"],
      paragraphs: [
        "This page fixes how Inshell's documentation uses a term. Where a term has a dedicated article, the entry orients the reader and links onward instead of repeating the argument, examples, or history kept there.",
        "These are working definitions. They settle usage inside these documents, not the general meaning of a word, and several entries mark questions the practice deliberately leaves open.",
      ],
      sections: [
        {
          id: "docs-glossary-aesthetic-architecture",
          title: "aesthetic architecture",
          paragraphs: [
            [
              "The structure of a work that the artist holds and can inspect. In Inshell's SVG practice it is the paths, shapes, positions, relations, and rules that organize what is drawn. Holding it literally is what lets a human intention vary the work and an Agent act within it without replacing the structure with an unspecified image-making process. See ",
              {
                label: "Fully Onchain",
                href: "/docs/fully-onchain#docs-fully-onchain-agent-art",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-agent",
          title: "Agent",
          paragraphs: [
            [
              "A participant that interprets, reasons, chooses, and acts, rather than a particular model, architecture, or product. What is an Agent? is one of the ",
              { label: "open questions", href: "/docs/agent-art#docs-agent-art-field" },
              " the field keeps. This entry fixes usage in these documents; it does not answer the question.",
            ],
          ],
        },
        {
          id: "docs-glossary-agent-art",
          title: "Agent Art",
          paragraphs: [
            [
              "Art in which an Agent participates at the level of intention. A runtime, service, interface, tool use, or executor role may carry that participation, but none of them establishes it alone. ",
              { label: "Agent Art", href: "/docs/agent-art" },
              " is a field and a form, not an ideology or a prescribed human–Agent relation.",
            ],
          ],
        },
        {
          id: "docs-glossary-agent-intent",
          title: "Agent intent",
          paragraphs: [
            [
              "The intent of the Agent that enters a work through how it interprets, chooses, proposes, directs, or acts. It may be constrained by or formed in response to human intention, and it implies no authorship, autonomy, collaboration, or equality by itself. See ",
              { label: "the Agent era", href: "/docs/agents-and-ai#docs-agents-agent" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-algorithmic-execution",
          title: "algorithmic execution",
          paragraphs: [
            [
              "Applying a procedure that determines what the machine produces. Inshell contrasts it with an Agent interpreting inside a composed architecture, as described under ",
              {
                label: "Design Principles",
                href: "/docs/design-principles#docs-design-thinking",
              },
              ". The contrast marks a difference in artistic role. It is not a claim that Agents operate without algorithms.",
            ],
          ],
        },
        {
          id: "docs-glossary-app-record",
          title: "App record",
          paragraphs: [
            [
              "A record the App assembled, stored, or signed, carrying the boundary the App declares for it. It is not a contract fact and not a chain observation. See ",
              { label: "what the App does", href: "/docs/contracts#docs-contracts-app" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-artistic-participation",
          title: "artistic participation",
          paragraphs: [
            [
              "The threshold at which an Agent's thinking power enters a work as intent rather than as infrastructure. Agent Art's invariant is met at this threshold and not before, which is why supplying a runtime or carrying out a fully determined instruction does not satisfy it. See ",
              {
                label: "intentional participation",
                href: "/docs/agent-art#docs-agent-art-participation",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-authority",
          title: "authority",
          paragraphs: [
            [
              "The person or system that originates a claim, as distinct from the immediate source an interface loaded it from. A mirror or cache can supply a value without becoming its authority. See ",
              {
                label: "four terms that should not blur",
                href: "/docs/verification#docs-verification-terms",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-canonical",
          title: "canonical",
          paragraphs: [
            [
              "The form that owns a fact, as opposed to any surface that displays it. A wallet, marketplace, explorer, or App page can present a work while the contract, tokenURI, and pinned release remain canonical for it. See ",
              {
                label: "one canonical form, many reading surfaces",
                href: "/docs/design-principles#docs-design-canonical",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-chain-observation",
          title: "chain observation",
          paragraphs: [
            [
              "A read of public chain state scoped to one named network, deployment, and observation point. It describes state as observed and does not become a permanent property of the work. See ",
              {
                label: "read context with the object",
                href: "/docs/artwork-metadata-chain#docs-reading-context",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-contract-release",
          title: "contract release",
          paragraphs: [
            [
              "A pinned artifact set defining expected contract code, schemas, or renderer material. It establishes what a release contains, not that the release is deployed anywhere. See ",
              { label: "why pins matter", href: "/docs/source-release-boundaries#docs-source-pins" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-creation-attestation",
          title: "Creation Attestation",
          paragraphs: [
            [
              "A signed claim binding one THOUGHT creation record to its exact recorded values, which the contract validates at mint. A valid attestation evidences that binding. It does not prove hidden model reasoning, guarantee a provider identity, or settle authorship. See ",
              { label: "provenance and attestation", href: "/docs/thought#docs-thought-provenance" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-crowd",
          title: "crowd",
          paragraphs: [
            [
              "The scope WILL moves the inquiry into: many people and many Agents in the formation of what can be called one will. One will does not mean consensus, unanimity, or governance, and the movement's concrete form is not specified. See ",
              { label: "WILL: the crowd", href: "/docs/movements#docs-movements-will" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-deployment",
          title: "deployment",
          paragraphs: [
            [
              "The record that places released code on a network: the network itself, contract addresses, deployment blocks, and integration choices. A complete release without a deployment is not onchain. See ",
              {
                label: "release is not deployment",
                href: "/docs/source-release-boundaries#docs-source-deployment",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-evidence-level",
          title: "evidence level",
          paragraphs: [
            [
              "The label naming how a particular statement is supported: contract-verified, contract-release, chain-observed, App-recorded, runtime-reported, or artist-editorial. These levels must not be collapsed into one undifferentiated claim of verification. See ",
              { label: "evidence levels", href: "/docs/verification#docs-verification-levels" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-fully-onchain",
          title: "fully onchain",
          paragraphs: [
            [
              "A narrow claim that a selected chain and its bound contracts return the complete canonical metadata and media without an external content object. It is not a synonym for immutable, non-upgradeable, decentralized, deployed, verified, or valuable; each of those needs its own evidence. See ",
              { label: "Fully Onchain", href: "/docs/fully-onchain" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-human-intention",
          title: "human intention",
          paragraphs: [
            [
              "What a person brings to a work as their own. In THOUGHT it is the exact prompt they write. It is the participant's contribution, distinct from the Agent intent that meets it. See ",
              { label: "what makes one work", href: "/docs/thought#docs-thought-work" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-movement",
          title: "movement",
          paragraphs: [
            [
              "A named artistic scope in Inshell's practice through which the inward direction takes successive forms. The movement is the artwork; $PATH is the permission that carries participation across the sequence. See ",
              { label: "Movements", href: "/docs/movements" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-permission",
          title: "permission",
          paragraphs: [
            [
              "What $PATH carries: the entitlement to authorize an eligible work in the movement it has reached. Permission is not the movement artwork, and it does not measure inward progress or certify anything about the holder. See ",
              { label: "$PATH", href: "/docs/path" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-practice",
          title: "practice",
          paragraphs: [
            [
              "The forms Inshell makes — movements, artworks, and participatory systems — through which the inward direction is approached. A practice can examine, inspect, suspect, read, listen, and feel; it does not claim to possess the truth it approaches. See ",
              { label: "the practice", href: "/docs/inshell#docs-inshell-practice" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-provenance",
          title: "provenance",
          paragraphs: [
            [
              "How the parts of a work or record connect across creation, rendering, selection, minting, and later display. Proof is narrower: the data a specific verification rule accepts. Provenance does not make every surrounding statement true. See ",
              {
                label: "provenance and proof",
                href: "/docs/verification#docs-verification-provenance",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-release",
          title: "release",
          paragraphs: [
            [
              "A versioned artifact set with its own identity and integrity, separate from any deployment of it and separate from the repository it was built from. See ",
              { label: "release plus deployment", href: "/docs/contracts#docs-contracts-release" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-runtime-report",
          title: "runtime report",
          paragraphs: [
            [
              "A value supplied by an Agent runtime or connector, such as a reported model name. It keeps that evidence level: it is not a provider identity guarantee and not a contract fact. See ",
              { label: "the Agent handoff", href: "/docs/thought#docs-thought-agent-handoff" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-self",
          title: "self",
          paragraphs: [
            "What the inward direction examines. Mind, spirit, memory, desire, reasoning, values, philosophy, logic, and choice are possible terms for that inquiry. Inshell opens the question and does not close it with a definition of essence, so this entry names the direction rather than its answer.",
          ],
        },
        {
          id: "docs-glossary-shell",
          title: "shell",
          paragraphs: [
            [
              "Any surface that makes something visible, operable, or legible: a body, face, or head; a name, honor, reputation, role, or social posture; an account, wallet, profile, or institution; an operating shell, terminal, command line, model label, or technical wrapper. A shell is real and often necessary. The error is mistaking it for the whole being. See ",
              { label: "Inshell", href: "/docs/inshell" },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-thinking-power",
          title: "thinking power",
          paragraphs: [
            [
              "Inshell's functional term for an Agent's capacity to interpret, reason, choose, and act rather than only apply a fixed procedure. It names functions of thinking that Agents increasingly undertake in work once performed by human minds. It does not claim that machine and human thought are identical and does not assert consciousness. Thinking power alone is not artistic participation; it becomes participation when some Agent intent enters the work. See ",
              {
                label: "the gate from algorithm to thinking power",
                href: "/docs/generative-art#docs-generative-thinking-power",
              },
              ".",
            ],
          ],
        },
        {
          id: "docs-glossary-truth",
          title: "truth",
          paragraphs: [
            [
              "In Inshell's artistic position, the direction named by inspect self. It is a direction of practice, not a doctrine, specification, or proposition that technical verification can establish. See ",
              { label: "the truth", href: "/docs/inshell#docs-inshell-truth" },
              ".",
            ],
          ],
        },
      ],
      links: [
        { label: "read Inshell", href: "/docs/inshell" },
        { label: "read Agent Art", href: "/docs/agent-art" },
        { label: "read Verification", href: "/docs/verification" },
      ],
    },
  ],
};

export const DOCS_AUTHORITY_MAP: Record<
  string,
  {
    lead: DocsAuthority[];
    figure?: DocsAuthority[];
    sectionFigures?: Record<string, DocsAuthority[]>;
    preformatted?: Record<string, DocsAuthority[]>;
    sections: Record<string, DocsAuthority[]>;
  }
> = {
  inshell: {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sectionFigures: {
      "docs-inshell-practice": ["artist-editorial"],
    },
    sections: {
      "docs-inshell-anonymity": ["artist-editorial"],
      "docs-inshell-truth": ["artist-editorial"],
      "docs-inshell-practice": ["artist-editorial"],
      "docs-inshell-surface": ["artist-editorial", "app-documentation"],
      "docs-inshell-names": ["artist-editorial", "contract-release"],
    },
  },
  "agent-art": {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sections: {
      "docs-agent-art-participation": ["artist-editorial"],
      "docs-agent-art-field": ["artist-editorial"],
      "docs-agent-art-inshell": ["artist-editorial"],
    },
  },
  movements: {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sections: {
      "docs-movements-agent-art": ["artist-editorial"],
      "docs-movements-thought": ["artist-editorial"],
      "docs-movements-will": ["artist-editorial"],
      "docs-movements-awa": ["artist-editorial"],
      "docs-movements-progress": [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      "docs-movements-evidence": ["artist-editorial", "app-documentation"],
    },
  },
  thought: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sectionFigures: {
      "docs-thought-work": ["app-documentation", "contract-release"],
      "docs-thought-agent-handoff": ["app-documentation"],
    },
    sections: {
      "docs-thought-work": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-thought-language": ["app-documentation", "contract-release"],
      "docs-thought-human-choice": ["app-documentation", "contract-release"],
      "docs-thought-agent-handoff": ["app-documentation", "contract-release"],
      "docs-thought-form": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-thought-provenance": ["app-documentation", "contract-release"],
      "docs-thought-local": ["app-documentation"],
    },
  },
  will: {
    lead: ["artist-editorial"],
    sections: {
      "docs-will-evidence": ["artist-editorial", "app-documentation"],
    },
  },
  awa: {
    lead: ["artist-editorial"],
    sections: {
      "docs-awa-evidence": ["artist-editorial", "app-documentation"],
    },
  },
  path: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-path-permission": ["artist-editorial", "contract-release"],
      "docs-path-issuance": ["artist-editorial", "contract-release"],
      "docs-path-capacity": ["app-documentation", "contract-release"],
      "docs-path-consumption": ["contract-release"],
      "docs-path-ownership": ["app-documentation", "contract-release"],
      "docs-path-spark": ["app-documentation", "contract-release"],
      "docs-path-record": ["app-documentation", "contract-release"],
    },
  },
  pulse: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    preformatted: {
      "Pulse pump and drop equations": ["artist-editorial"],
    },
    sections: {
      "docs-pulse-serial": ["artist-editorial", "contract-release"],
      "docs-pulse-pump": ["contract-release"],
      "docs-pulse-drop": ["app-documentation", "contract-release"],
      "docs-pulse-live-price": ["app-documentation", "contract-release"],
      "docs-pulse-settlement": ["app-documentation", "contract-release"],
      "docs-pulse-artwork": ["artist-editorial", "app-documentation"],
    },
  },
  contracts: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-contracts-responsibilities": ["contract-release"],
      "docs-contracts-app": ["app-documentation", "contract-release"],
      "docs-contracts-consumption": ["contract-release"],
      "docs-contracts-release": ["app-documentation", "contract-release"],
    },
  },
  "artwork-metadata-chain": {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-reading-identity": ["contract-release"],
      "docs-reading-artwork": ["app-documentation", "contract-release"],
      "docs-reading-portable": ["app-documentation", "contract-release"],
      "docs-reading-context": ["app-documentation", "contract-release"],
    },
  },
  "fully-onchain": {
    lead: ["app-documentation", "contract-release"],
    sections: {
      "docs-fully-onchain-why": ["app-documentation", "contract-release"],
      "docs-fully-onchain-svg": ["app-documentation", "contract-release"],
      "docs-fully-onchain-agent-art": [
        "artist-editorial",
        "app-documentation",
      ],
      "docs-fully-onchain-inshell": ["app-documentation", "contract-release"],
      "docs-fully-onchain-boundary": [
        "app-documentation",
        "contract-release",
      ],
    },
  },
  "mono-76": {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-mono-76-repertoire": ["app-documentation", "contract-release"],
      "docs-mono-76-form": ["artist-editorial", "contract-release"],
      "docs-mono-76-native-svg": ["app-documentation", "contract-release"],
      "docs-mono-76-interface": ["artist-editorial", "app-documentation"],
      "docs-mono-76-release": ["app-documentation", "contract-release"],
    },
  },
  verification: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-verification-terms": ["app-documentation"],
      "docs-verification-provenance": ["app-documentation", "contract-release"],
      "docs-verification-levels": ["app-documentation"],
      "docs-verification-checklist": ["app-documentation", "contract-release"],
    },
  },
  "wallet-local-data": {
    lead: ["app-documentation"],
    sections: {
      "docs-wallet-passive": ["app-documentation"],
      "docs-wallet-actions": ["app-documentation"],
      "docs-wallet-storage": ["app-documentation"],
      "docs-wallet-networks": ["app-documentation"],
    },
  },
  "source-release-boundaries": {
    lead: ["app-documentation", "contract-release"],
    sections: {
      "docs-source-ownership": ["app-documentation", "contract-release"],
      "docs-source-pins": ["app-documentation", "contract-release"],
      "docs-source-deployment": ["app-documentation", "contract-release"],
      "docs-source-publication": ["app-documentation"],
    },
  },
  lineage: {
    lead: ["artist-editorial"],
    sections: {
      "docs-lineage-instruction": ["artist-editorial"],
      "docs-lineage-scores": ["artist-editorial"],
      "docs-lineage-reader": ["artist-editorial"],
      "docs-lineage-difference": ["artist-editorial"],
      "docs-lineage-boundary": ["artist-editorial"],
    },
  },
  "generative-art": {
    lead: ["artist-editorial"],
    sections: {
      "docs-generative-origins": ["artist-editorial"],
      "docs-generative-onchain": ["artist-editorial"],
      "docs-generative-thinking-power": ["artist-editorial"],
      "docs-generative-difference": ["artist-editorial"],
      "docs-generative-boundary": ["artist-editorial"],
    },
  },
  "agents-and-ai": {
    lead: ["artist-editorial"],
    sections: {
      "docs-agents-program": ["artist-editorial"],
      "docs-agents-model": ["artist-editorial"],
      "docs-agents-agent": ["artist-editorial"],
      "docs-agents-word": ["artist-editorial"],
      "docs-agents-boundary": ["artist-editorial"],
    },
  },
  svg: {
    lead: ["artist-editorial"],
    sections: {
      "docs-svg-standard": ["artist-editorial"],
      "docs-svg-readers": ["artist-editorial"],
      "docs-svg-cost": ["artist-editorial"],
      "docs-svg-inshell": ["artist-editorial"],
      "docs-svg-boundary": ["artist-editorial"],
    },
  },
  ethereum: {
    lead: ["artist-editorial"],
    sections: {
      "docs-ethereum-machine": ["artist-editorial"],
      "docs-ethereum-cost": ["artist-editorial"],
      "docs-ethereum-bounds": ["artist-editorial"],
      "docs-ethereum-datauri": ["artist-editorial"],
      "docs-ethereum-boundary": ["artist-editorial"],
    },
  },
  "tokens-and-nfts": {
    lead: ["artist-editorial"],
    sections: {
      "docs-tokens-pointer": ["artist-editorial"],
      "docs-tokens-decay": ["artist-editorial"],
      "docs-tokens-inshell": ["artist-editorial"],
      "docs-tokens-boundary": ["artist-editorial"],
    },
  },
  "onchain-art": {
    lead: ["artist-editorial"],
    sections: {
      "docs-onchain-degrees": ["artist-editorial"],
      "docs-onchain-precedents": ["artist-editorial"],
      "docs-onchain-inshell": ["artist-editorial"],
      "docs-onchain-boundary": ["artist-editorial"],
    },
  },
  "design-principles": {
    lead: ["artist-editorial", "app-documentation"],
    sections: {
      "docs-design-bounds": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-design-thinking": ["artist-editorial"],
      "docs-design-selection": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-design-visible-mechanism": [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      "docs-design-canonical": ["app-documentation", "contract-release"],
      "docs-design-claims": ["artist-editorial", "app-documentation"],
      "docs-design-time": ["artist-editorial", "app-documentation", "contract-release"],
    },
  },
  glossary: {
    lead: ["artist-editorial", "app-documentation"],
    sections: {
      "docs-glossary-aesthetic-architecture": ["artist-editorial"],
      "docs-glossary-agent": ["artist-editorial"],
      "docs-glossary-agent-art": ["artist-editorial"],
      "docs-glossary-agent-intent": ["artist-editorial"],
      "docs-glossary-algorithmic-execution": ["artist-editorial"],
      "docs-glossary-app-record": ["app-documentation"],
      "docs-glossary-artistic-participation": ["artist-editorial"],
      "docs-glossary-authority": ["app-documentation"],
      "docs-glossary-canonical": ["app-documentation"],
      "docs-glossary-chain-observation": ["app-documentation"],
      "docs-glossary-contract-release": ["app-documentation"],
      "docs-glossary-creation-attestation": ["app-documentation"],
      "docs-glossary-crowd": ["artist-editorial"],
      "docs-glossary-deployment": ["app-documentation"],
      "docs-glossary-evidence-level": ["app-documentation"],
      "docs-glossary-fully-onchain": ["app-documentation"],
      "docs-glossary-human-intention": ["artist-editorial"],
      "docs-glossary-movement": ["artist-editorial"],
      "docs-glossary-permission": ["artist-editorial", "app-documentation"],
      "docs-glossary-practice": ["artist-editorial"],
      "docs-glossary-provenance": ["app-documentation"],
      "docs-glossary-release": ["app-documentation"],
      "docs-glossary-runtime-report": ["app-documentation"],
      "docs-glossary-self": ["artist-editorial"],
      "docs-glossary-shell": ["artist-editorial"],
      "docs-glossary-thinking-power": ["artist-editorial"],
      "docs-glossary-truth": ["artist-editorial"],
    },
  },
};

export const AGENT_DOCS_INDEX_PATH = "/docs/agent-index.json";
export const AGENT_DOCS_CONTENT_PATH = "/docs/content.json";
export const AGENT_DOCS_MARKDOWN_PATH = "/docs/index.md";

export function agentDocsPrompt(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [
    `Read Inshell's public knowledge index and follow its usage and answer policy: ${base}${AGENT_DOCS_INDEX_PATH}`,
    "",
    "Use it as the discovery map for Inshell's public site. For each question, fetch only the relevant indexed documentation, product context, release, handoff, or live read-only source.",
    "",
    "If you cannot fetch a required source, say so. Do not guess.",
    "",
    "When ready, reply:",
    "I've read Inshell's public knowledge index. Ask me anything about Inshell.",
  ].join("\n");
}
