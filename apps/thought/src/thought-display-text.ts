export const canonicalThoughtTitle = (value: string) =>
  value.replace(/[^A-Za-z]+/g, " ").trim().replace(/\s+/g, " ").toUpperCase();

export const thoughtProtocolText = (value: string, exactV2: boolean) =>
  exactV2 ? value : canonicalThoughtTitle(value);
