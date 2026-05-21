export type SurfaceId = "path" | "thought";

export type SurfaceNavItem = {
  id: string;
  surface: SurfaceId;
  label: string;
  path: string;
};

export type ContractStatusRow = {
  id: string;
  label: string;
  value: string;
  href?: string;
};

export type ContractStatusSection = {
  id: string;
  title: string;
  rows: ContractStatusRow[];
};

export type ContractStatusInput = {
  chainId?: number;
  chainName?: string;
  pathNft?: string;
  thoughtNft?: string;
  pulseAuction?: string;
  colorFontV1?: string;
  thoughtSpecName?: string;
  thoughtSpecId?: string;
  thoughtSpecHash?: string;
  colorFontHash?: string;
};

export const SURFACE_TERMINOLOGY = {
  ecosystem: "Inshell",
  pathDapp: "$PATH",
  pathDappLong: "$PATH auction",
  pathToken: "$PATH",
  pathTokenPlain: "PATH",
  thoughtDapp: "THOUGHT",
  thoughtToken: "THOUGHT",
  colorFont: "Color Font",
  verify: "verify",
} as const;

export const SURFACE_DEPLOYMENT_MANIFEST = {
  launchNetwork: {
    id: "sepolia",
    label: "Sepolia",
    chainId: 11155111,
  },
  surfaces: {
    path: {
      id: "path",
      product: SURFACE_TERMINOLOGY.pathDapp,
      domain: "https://inshell.art",
      role: "$PATH auction, token inventory, and verification.",
      canonicalPath: "/",
    },
    thought: {
      id: "thought",
      product: SURFACE_TERMINOLOGY.thoughtDapp,
      domain: "https://thought.inshell.art",
      role: "THOUGHT creation, minting, gallery, and verification.",
      canonicalPath: "/",
    },
  },
  contractIds: {
    path: ["path_nft", "pulse_auction", "path_pulse_adapter"],
    thought: ["thought_nft", "thought_spec_registry", "color_font_v1"],
  },
} as const;

export const SURFACE_NAV_ITEMS: readonly SurfaceNavItem[] = [
  {
    id: "path",
    surface: "path",
    label: SURFACE_TERMINOLOGY.pathDapp,
    path: "/",
  },
  {
    id: "path-tokens",
    surface: "path",
    label: "tokens",
    path: "/path",
  },
  {
    id: "thought",
    surface: "thought",
    label: SURFACE_TERMINOLOGY.thoughtDapp,
    path: "/",
  },
  {
    id: "thought-gallery",
    surface: "thought",
    label: "gallery",
    path: "/?gallery=1",
  },
  {
    id: "verify",
    surface: "path",
    label: SURFACE_TERMINOLOGY.verify,
    path: "/verify",
  },
] as const;

export function surfaceUrl(surface: SurfaceId, path = "/") {
  const base = SURFACE_DEPLOYMENT_MANIFEST.surfaces[surface].domain;
  if (path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getSurfaceNavItems(currentSurface: SurfaceId): readonly SurfaceNavItem[] {
  return SURFACE_NAV_ITEMS.map((item) =>
    item.id === "verify" ? { ...item, surface: currentSurface } : item,
  );
}

export function surfaceNavHref(item: SurfaceNavItem, currentSurface: SurfaceId) {
  if (item.surface === currentSurface) {
    return item.path;
  }

  return surfaceUrl(item.surface, item.path);
}

export function surfaceNavTarget(item: SurfaceNavItem, currentSurface: SurfaceId) {
  return item.surface === currentSurface ? undefined : "_blank";
}

export function surfaceNavRel(item: SurfaceNavItem, currentSurface: SurfaceId) {
  return item.surface === currentSurface ? undefined : "noopener noreferrer";
}

export function formatChainName(chainId: number | undefined) {
  if (chainId === 11155111) return "Sepolia";
  if (chainId === 31337 || chainId === 31338) return "Local Devnet";
  return chainId ? `Chain ${chainId}` : "not loaded";
}

export function displayStatusValue(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
      ? value.toString()
      : "not loaded";
}

export function buildContractStatusSections(input: ContractStatusInput): ContractStatusSection[] {
  const chainName = input.chainName || formatChainName(input.chainId);
  const colorFontAuthority = input.colorFontV1
    ? `ColorFontV1 ${input.colorFontV1}`
    : input.thoughtNft
      ? `ThoughtNFT ${input.thoughtNft}`
      : "";

  return [
    {
      id: "domains",
      title: "official dapps",
      rows: [
        {
          id: "path-domain",
          label: SURFACE_TERMINOLOGY.pathDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.domain,
          href: SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.domain,
        },
        {
          id: "thought-domain",
          label: SURFACE_TERMINOLOGY.thoughtDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.thought.domain,
          href: SURFACE_DEPLOYMENT_MANIFEST.surfaces.thought.domain,
        },
      ],
    },
    {
      id: "deployment",
      title: "deployment manifest",
      rows: [
        {
          id: "network",
          label: "network",
          value: chainName,
        },
        {
          id: "chain-id",
          label: "chain id",
          value: displayStatusValue(input.chainId),
        },
        {
          id: "path-role",
          label: SURFACE_TERMINOLOGY.pathDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.path.role,
        },
        {
          id: "thought-role",
          label: SURFACE_TERMINOLOGY.thoughtDapp,
          value: SURFACE_DEPLOYMENT_MANIFEST.surfaces.thought.role,
        },
      ],
    },
    {
      id: "contracts",
      title: "contracts",
      rows: [
        {
          id: "path-nft",
          label: "PathNFT",
          value: displayStatusValue(input.pathNft),
        },
        {
          id: "thought-nft",
          label: "ThoughtNFT",
          value: displayStatusValue(input.thoughtNft),
        },
        {
          id: "pulse-auction",
          label: "PulseAuction",
          value: displayStatusValue(input.pulseAuction),
        },
      ],
    },
    {
      id: "thought-spec",
      title: "THOUGHT spec",
      rows: [
        {
          id: "thought-spec-name",
          label: "recommended spec",
          value: displayStatusValue(input.thoughtSpecName),
        },
        {
          id: "thought-spec-id",
          label: "spec id",
          value: displayStatusValue(input.thoughtSpecId),
        },
        {
          id: "thought-spec-hash",
          label: "spec hash",
          value: displayStatusValue(input.thoughtSpecHash),
        },
      ],
    },
    {
      id: "color-font",
      title: "color font",
      rows: [
        {
          id: "color-font-authority",
          label: "authority",
          value: displayStatusValue(colorFontAuthority),
        },
        {
          id: "color-font-loaded-from",
          label: "loaded from",
          value: input.colorFontV1
            ? "ColorFontV1.data()"
            : input.thoughtNft
              ? "ThoughtNFT.colorFontData()"
              : "not loaded",
        },
        {
          id: "color-font-hash",
          label: "hash",
          value: displayStatusValue(input.colorFontHash),
        },
      ],
    },
    {
      id: "wallet-actions",
      title: "wallet actions",
      rows: [
        {
          id: "connect-wallet",
          label: "connect wallet",
          value: "reads selected address and public ownership state.",
        },
        {
          id: "switch-network",
          label: "switch network",
          value: "asks wallet to switch to Sepolia.",
        },
        {
          id: "mint-path",
          label: `mint ${SURFACE_TERMINOLOGY.pathToken}`,
          value: "submits a wallet-confirmed transaction for the Pulse auction.",
        },
        {
          id: "mint-thought",
          label: `mint ${SURFACE_TERMINOLOGY.thoughtToken}`,
          value: `submits a wallet-confirmed transaction using a selected ${SURFACE_TERMINOLOGY.pathToken} permission.`,
        },
      ],
    },
  ];
}

export function findContractStatusRow(
  sections: readonly ContractStatusSection[],
  sectionId: string,
  rowId: string,
) {
  return sections.find((section) => section.id === sectionId)?.rows.find((row) => row.id === rowId);
}
