import { buildThoughtV2Svg } from "./thought-v2-renderer";

export type ThoughtV2StoredVisual = {
  image: string;
  migrated: boolean;
  svg: string;
};

const decodeBase64Utf8 = (value: string) => {
  const binary = globalThis.atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const decodeSvgImage = (image: string) => {
  const commaIndex = image.indexOf(",");
  if (
    commaIndex < 0 ||
    !image.slice(0, commaIndex).toLowerCase().startsWith("data:image/svg+xml")
  ) {
    return "";
  }
  const header = image.slice(0, commaIndex).toLowerCase();
  const payload = image.slice(commaIndex + 1);
  try {
    return header.includes(";base64")
      ? decodeBase64Utf8(payload)
      : decodeURIComponent(payload);
  } catch {
    return "";
  }
};

const svgImageUri = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

// Display-only recovery of the exact pre-fix browser preview. Never rewrite
// saved SVG/metadata, hashes, provenance or contract-rendered artwork. A renderer
// label alone is insufficient: require byte equality with the known old output.
export const thoughtV2DisplayImage = (image: string): string => {
  const svg = decodeSvgImage(image);
  if (!svg || svg.length > 20000) return image;
  const line = (field: string) => {
    const value = svg.match(new RegExp(`<g id="${field}-line"[^>]* data-source="([^"]*)"`))?.[1];
    return value?.replace(/&quot;|&apos;|&lt;|&gt;|&amp;/g, (entity) =>
      ({ "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&amp;": "&" })[entity]!,
    );
  };
  const promptLine = line("prompt");
  const agentLine = line("agent");
  const valid = (value: string | undefined): value is string =>
    Boolean(value && value.length <= 64 && /^[A-Za-z0-9 .,?!:;'"\-()/&]+$/.test(value) && !/^ | $| {2}/.test(value));
  if (!valid(promptLine) || !valid(agentLine)) return image;
  const corrected = buildThoughtV2Svg({ promptLine, agentLine });
  const legacy = corrected
    .replaceAll(' stroke-linecap="round" stroke-linejoin="round"', "")
    .replace(/(<use href="#g-[0-9a-f]+" x=")(\d+)("\/?>)/g,
      (_match, before: string, x: string, after: string) => `${before}${Number(x) - 1}${after}`);
  return svg === legacy ? svgImageUri(corrected) : image;
};

export const isCurrentThoughtV2ContractSvg = (
  svg: string,
  implementationId: string,
) =>
  Boolean(implementationId) &&
  svg.trimStart().startsWith("<svg") &&
  svg.includes(`data-renderer="${implementationId}"`) &&
  svg.includes('<rect id="work-frame" width="1024" height="1024" fill="#006100"/>') &&
  svg.includes('<g id="prompt-line"') &&
  svg.includes('<g id="agent-line"') &&
  svg.includes("<path") &&
  svg.includes("<use") &&
  !/<text\b|<foreignObject\b|@font-face/i.test(svg);

export const normalizeThoughtV2StoredVisual = (input: {
  image?: string;
  implementationId: string;
  svg?: string;
}): ThoughtV2StoredVisual => {
  const storedSvg = input.svg ?? "";
  const storedImage = input.image ?? "";
  const imageSvg = decodeSvgImage(storedImage);
  const svg = isCurrentThoughtV2ContractSvg(storedSvg, input.implementationId)
    ? storedSvg
    : isCurrentThoughtV2ContractSvg(imageSvg, input.implementationId)
      ? imageSvg
      : "";

  if (!svg) {
    return {
      image: "",
      migrated: Boolean(storedSvg || storedImage),
      svg: "",
    };
  }

  const image = imageSvg === svg ? storedImage : svgImageUri(svg);
  return {
    image,
    migrated: svg !== storedSvg || image !== storedImage,
    svg,
  };
};
