export const OFFICIAL_DOMAINS = {
  home: "https://inshell.art",
  thought: "https://thought.inshell.art",
} as const;

export const PUBLIC_SITE_METADATA = {
  home: {
    title: "$PATH",
    description: "$PATH auction, token inventory, and Inshell verification.",
    iconPath: "/path.svg",
    ogImagePath: "/og.png",
  },
  thought: {
    title: "THOUGHT",
    description: "THOUGHT creation, minting, and gallery for Inshell.",
    iconPath: "/thought-icon.svg",
    ogImagePath: "/og.png",
  },
} as const;

export function absolutePublicAssetUrl(
  surface: keyof typeof OFFICIAL_DOMAINS,
  path: string
) {
  return `${OFFICIAL_DOMAINS[surface]}${path.startsWith("/") ? path : `/${path}`}`;
}
