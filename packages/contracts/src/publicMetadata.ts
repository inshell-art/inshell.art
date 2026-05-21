export const OFFICIAL_DOMAINS = {
  home: "https://inshell.art",
  thought: "https://thought.inshell.art",
} as const;

export const PUBLIC_SITE_METADATA = {
  home: {
    title: "Inshell",
    description: "$PATH auction and Inshell public surfaces.",
    iconPath: "/icons/icon-512.png",
    ogImagePath: "/og.png",
  },
  thought: {
    title: "Inshell THOUGHT",
    description: "THOUGHT operator for Inshell.",
    iconPath: "/icons/icon-512.png",
    ogImagePath: "/og.png",
  },
} as const;

export function absolutePublicAssetUrl(
  surface: keyof typeof OFFICIAL_DOMAINS,
  path: string
) {
  return `${OFFICIAL_DOMAINS[surface]}${path.startsWith("/") ? path : `/${path}`}`;
}
