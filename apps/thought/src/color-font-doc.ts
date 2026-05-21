export const COLOR_FONT_DOC_FORMAT = "LETTER:INDEX:ALIAS_TERM:HEX" as const;

export type ColorFontDoc = {
  id: string;
  version: string;
  chainId: number;
  chainName?: string;
  contractAddress: `0x${string}`;
  hash: `0x${string}`;
  format: typeof COLOR_FONT_DOC_FORMAT;
  data: string;
};

export const buildColorFontPlainText = (doc: ColorFontDoc) => [
  `Color Font ${doc.version}`,
  "",
  "source: onchain ABI",
  `id: ${doc.id}`,
  `version: ${doc.version}`,
  ...(doc.chainName ? [`chain: ${doc.chainName}`] : []),
  `chain id: ${doc.chainId}`,
  `contract: ${doc.contractAddress}`,
  `hash: ${doc.hash}`,
  `format: ${doc.format}`,
  "",
  doc.data,
].join("\n");

export const validateColorFontDataShape = (data: string) => {
  const lines = data.split("\n");
  return lines.length === 26 && lines.every((line, index) => {
    const letter = String.fromCharCode(65 + index);
    return new RegExp(`^${letter}:${index + 1}:[a-z][a-z ]*:\\#[0-9a-f]{6}$`).test(line);
  });
};
