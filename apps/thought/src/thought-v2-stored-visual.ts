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
