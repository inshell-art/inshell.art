import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  getProtocolReleaseChainId,
  getProtocolReleaseDeployBlock,
  getProtocolRelease,
  maybeResolveAddress,
} from "@inshell/contracts";
import {
  loadAllPathTokens,
  readCachedAllPathTokens,
  type PathTokenAttribute,
  type PathTokenInventoryItem,
} from "@/services/pathTokens";
import {
  loadThoughtGallery,
  readCachedThoughtGallery,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";
import { PUBLIC_NETWORK_CONFIG } from "@inshell/shared";
import {
  PATH_MOVEMENT_QUOTA_LINES,
  PATH_MOVEMENT_QUOTA_NOTE,
  PATH_OVERVIEW,
  PATH_OVERVIEW_LINES,
} from "@/content/path";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import {
  findPathIssuance,
  formatPathMintPrice,
  type PathIssuance,
} from "@/services/pathIssuance";

type LoadState =
  | { status: "loading"; items: PathTokenInventoryItem[]; error: null }
  | { status: "ready"; items: PathTokenInventoryItem[]; error: null }
  | { status: "error"; items: PathTokenInventoryItem[]; error: string };

type PathPageProps = {
  tokenId?: string | null;
  refreshSignal?: number;
};

const FIXTURE_OWNER = "0x1111222233334444555566667777888899990000";
const PATH_DESCRIPTION =
  "$PATH is the permission token. It is minted by the Pulse auction and authorizes movement mints in order: THOUGHT, WILL, then AWA. The token image and traits show movement progress.";
const CHAIN_LOADING_DETAIL_MS = 1400;
const PATH_LOADING_DETAILS = [
  "checking latest block",
  "scanning $PATH transfer logs",
  "collecting token ids",
  "checking current owners",
  "reading token metadata",
  "rendering token gallery",
] as const;
const FIXTURE_QUOTAS = {
  thought: 3,
  will: 10,
  awa: 2,
} as const;
const MOVEMENT_TRAITS = ["THOUGHT", "WILL", "AWA"] as const;

type UnitProgress = {
  used: number | null;
  total: number | null;
  label: string;
  available: boolean;
};

function shortAddress(address?: string): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function readPathFixture(): string | null {
  if (typeof window === "undefined") return null;
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  if (envCache?.MODE === "production" || envCache?.PROD === true) return null;
  const fixture = new globalThis.URLSearchParams(window.location.search).get("fixture");
  return fixture?.trim().toLowerCase() || null;
}

function attrValue(attribute: PathTokenAttribute): string {
  const value = attribute.value;
  if (value == null) return "—";
  return String(value);
}

function findAttribute(
  item: PathTokenInventoryItem,
  traitType: string
): PathTokenAttribute | undefined {
  return (item.metadata.attributes ?? []).find(
    (attribute) =>
      String(attribute.trait_type ?? "").toUpperCase() === traitType.toUpperCase()
  );
}

function stageValue(item: PathTokenInventoryItem): string {
  const stage = findAttribute(item, "Stage");
  return stage ? attrValue(stage) : String(item.metadata.stage ?? "—");
}

function movementProgress(item: PathTokenInventoryItem, traitType: string): UnitProgress {
  const attribute = findAttribute(item, traitType);
  const raw = attribute ? attrValue(attribute) : "—";
  const match = /^Minted\((\d+)\/(\d+)\)$/i.exec(raw.trim());
  if (match) {
    const used = Number(match[1]);
    const total = Number(match[2]);
    return total === 0
      ? { used: null, total: null, label: "- / -", available: false }
      : { used, total, label: `${used} / ${total}`, available: true };
  }
  const spaced = /^(\d+)\s*\/\s*(\d+)(?:\s+minted)?$/i.exec(raw.trim());
  if (spaced) {
    const used = Number(spaced[1]);
    const total = Number(spaced[2]);
    return total === 0
      ? { used: null, total: null, label: "- / -", available: false }
      : { used, total, label: `${used} / ${total}`, available: true };
  }
  return { used: null, total: null, label: raw, available: raw !== "—" };
}

function progressValue(progress: UnitProgress): string {
  if (progress.used == null || progress.total == null) return progress.label;
  return progressLabel(progress.used, progress.total);
}

function progressWithUsedFloor(
  progress: UnitProgress,
  usedFloor: number
): UnitProgress {
  if (usedFloor <= 0) return progress;
  const inferredTotal = progress.total ?? usedFloor;
  if (inferredTotal <= 0) return progress;
  const used = Math.min(Math.max(progress.used ?? 0, usedFloor), inferredTotal);
  return {
    used,
    total: inferredTotal,
    label: `${used} / ${inferredTotal}`,
    available: true,
  };
}

function replaceMovementAttribute(
  item: PathTokenInventoryItem,
  movement: string,
  progress: UnitProgress
): PathTokenAttribute[] {
  const attributes = item.metadata.attributes ?? [];
  let replaced = false;
  const next = attributes.map((attribute) => {
    if (String(attribute.trait_type ?? "").toUpperCase() !== movement) {
      return attribute;
    }
    replaced = true;
    return {
      ...attribute,
      value: progressValue(progress),
    };
  });
  if (!replaced) {
    next.push({ trait_type: movement, value: progressValue(progress) });
  }
  return next;
}

function pathIdKey(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return BigInt(trimmed).toString();
}

function thoughtMintsByPath(thoughts: ThoughtGalleryItem[]) {
  const mints = new Map<string, ThoughtGalleryItem[]>();
  for (const thought of thoughts) {
    const key = pathIdKey(thought.pathId);
    if (!key) continue;
    const current = mints.get(key) ?? [];
    current.push(thought);
    mints.set(key, current);
  }
  return mints;
}

function overlayThoughtMintProgress(
  item: PathTokenInventoryItem,
  thoughtMints: ThoughtGalleryItem[]
): PathTokenInventoryItem {
  const thoughtMintCount = thoughtMints.length;
  if (thoughtMintCount <= 0) return item;
  const thoughtProgress = progressWithUsedFloor(
    movementProgress(item, "THOUGHT"),
    thoughtMintCount
  );
  if (thoughtProgress.used == null) return item;

  const attributes = replaceMovementAttribute(item, "THOUGHT", thoughtProgress);
  const willProgress = movementProgress(item, "WILL");
  const awaProgress = movementProgress(item, "AWA");
  const metadata = {
    ...item.metadata,
    attributes,
    movementTokens: {
      ...(typeof item.metadata.movementTokens === "object" &&
      item.metadata.movementTokens !== null
        ? item.metadata.movementTokens
        : {}),
      THOUGHT: thoughtMints
        .slice()
        .sort((a, b) => a.tokenId - b.tokenId)
        .map((thought) => ({
          tokenId: thought.tokenId,
          url: `/thought/${thought.tokenId}`,
        })),
    },
  };

  if (thoughtProgress.used != null && thoughtProgress.total != null) {
    const svg = makePathProgressSvg({
      thoughtMinted: thoughtProgress.used,
      thoughtQuota: thoughtProgress.total,
      willMinted: willProgress.used ?? 0,
      willQuota: willProgress.total ?? 0,
      awaMinted: awaProgress.used ?? 0,
      awaQuota: awaProgress.total ?? 0,
    });
    metadata.image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    metadata.image_data = svg;
  }

  return {
    ...item,
    metadata,
  };
}

function overlayThoughtMints(
  items: PathTokenInventoryItem[],
  thoughts: ThoughtGalleryItem[] | null
) {
  if (!thoughts?.length) return items;
  const mints = thoughtMintsByPath(thoughts);
  if (mints.size === 0) return items;
  return items.map((item) => {
    const key = pathIdKey(item.tokenIdLabel);
    if (!key) return item;
    return overlayThoughtMintProgress(item, mints.get(key) ?? []);
  });
}

type MovementTokenLink = {
  movement: string;
  tokenId: string;
  href: string;
};

function movementTokenLinks(item: PathTokenInventoryItem): MovementTokenLink[] {
  const raw = item.metadata.movementTokens;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

  const links: MovementTokenLink[] = [];
  for (const movement of MOVEMENT_TRAITS) {
    const entries = (raw as Record<string, unknown>)[movement];
    const candidates = Array.isArray(entries) ? entries : entries ? [entries] : [];
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
        continue;
      }
      const token = candidate as Record<string, unknown>;
      const tokenId =
        typeof token.tokenId === "string" || typeof token.tokenId === "number"
          ? String(token.tokenId)
          : null;
      if (!tokenId) continue;
      const href =
        typeof token.url === "string" && token.url.trim()
          ? token.url.trim()
          : movement === "THOUGHT"
            ? `/thought/${tokenId}`
            : null;
      if (!href) continue;
      links.push({ movement, tokenId, href });
    }
  }

  return links.filter(
    (link, index) =>
      links.findIndex(
        (candidate) =>
          candidate.movement === link.movement &&
          candidate.tokenId === link.tokenId
      ) === index
  );
}

function metadataName(item: PathTokenInventoryItem): string {
  const name = item.metadata.name?.trim();
  return name || `$PATH #${item.tokenIdLabel}`;
}

function displayTokenName(item: PathTokenInventoryItem): string {
  return `$PATH #${item.tokenIdLabel}`;
}

function pathTokenHref(tokenIdLabel: string): string {
  const search = typeof window === "undefined" ? "" : window.location.search;
  return `/path/${tokenIdLabel}${search}`;
}

function dispatchLocationChange() {
  if (typeof window === "undefined") return;
  const event =
    typeof globalThis.PopStateEvent === "function"
      ? new globalThis.PopStateEvent("popstate", { state: window.history.state })
      : new globalThis.Event("popstate");
  window.dispatchEvent(event);
}

function handlePathRouteAnchorClick(event: MouseEvent<globalThis.HTMLAnchorElement>) {
  if (
    typeof window === "undefined" ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return;
  }
  const href = event.currentTarget.getAttribute("href");
  if (!href) return;
  const nextUrl = new globalThis.URL(href, window.location.href);
  if (
    nextUrl.origin !== window.location.origin ||
    !/^\/path(?:\/[1-9]\d*)?$/.test(nextUrl.pathname)
  ) {
    return;
  }

  event.preventDefault();
  const currentLocation = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  if (nextLocation !== currentLocation) {
    window.history.pushState({}, "", nextLocation);
  }
  dispatchLocationChange();
}

function metadataImage(item: PathTokenInventoryItem): string | undefined {
  if (item.metadata.image) return item.metadata.image;
  const imageData = item.metadata.image_data?.trim();
  if (imageData?.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageData)}`;
  }
  return undefined;
}

function unitProgressByMovement(item: PathTokenInventoryItem) {
  return MOVEMENT_TRAITS.map((movement) => ({
    movement,
    progress: movementProgress(item, movement),
  }));
}

function pathNetworkLabel(chainId?: number): string {
  if (chainId == null) return "—";
  if (chainId === 31337 || chainId === 1337) return "Local Anvil";
  if (chainId === 11155111) return "Sepolia";
  return `chain ${chainId}`;
}

function pathAddressExplorerHref(
  chainId: number | undefined,
  address: string | undefined,
): string | null {
  if (!address || chainId !== PUBLIC_NETWORK_CONFIG.chainId) return null;
  return `${PUBLIC_NETWORK_CONFIG.explorerBaseUrl}/address/${address}`;
}

function pathTransactionExplorerHref(
  chainId: number | undefined,
  transactionHash: string | undefined,
): string | null {
  if (chainId !== PUBLIC_NETWORK_CONFIG.chainId || !transactionHash) return null;
  return `${PUBLIC_NETWORK_CONFIG.explorerUrl}/tx/${transactionHash}`;
}

function pathCurrencyLabel(chainId: number | undefined): string {
  return chainId === 31337 || chainId === 1337 ? "local ETH" : "ETH";
}

function makePathProgressSvg(args: {
  thoughtMinted: number;
  thoughtQuota: number;
  willMinted: number;
  willQuota: number;
  awaMinted: number;
  awaQuota: number;
}): string {
  const thoughtDisplay = args.thoughtMinted > 0 ? "inline" : "none";
  const willDisplay = args.willMinted > 0 ? "inline" : "none";
  const awaDisplay = args.awaMinted > 0 ? "inline" : "none";
  const blankThought =
    args.thoughtMinted === 0
      ? "<circle id='blank-mark-thought' cx='210' cy='300' r='1.5' fill='white'/>"
      : "";
  const blankWill =
    args.willMinted === 0
      ? "<circle id='blank-mark-will' cx='300' cy='300' r='1.5' fill='white'/>"
      : "";
  const blankAwa =
    args.awaMinted === 0
      ? "<circle id='blank-mark-awa' cx='390' cy='300' r='1.5' fill='white'/>"
      : "";
  const fillDiameter = (minted: number, quota: number) =>
    quota > 0 && minted > 0 ? Math.min(60, Math.floor((60 * minted) / quota)) : 0;
  const fillCircle = (id: string, cx: number, minted: number, quota: number) => {
    const diameter = fillDiameter(minted, quota);
    return diameter > 0
      ? `<circle id='${id}' cx='${cx}' cy='300' r='${diameter / 2}' fill='white' display='inline'/>`
      : "";
  };
  const thoughtFill = fillCircle("thought-fill", 210, args.thoughtMinted, args.thoughtQuota);
  const willFill = fillCircle("will-fill", 300, args.willMinted, args.willQuota);
  const awaFill = fillCircle("awa-fill", 390, args.awaMinted, args.awaQuota);

  return [
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600' role='img' aria-label='$PATH movement progress'>",
    "<rect width='600' height='600' fill='black'/>",
    blankThought,
    blankWill,
    blankAwa,
    `<circle id='thought-box' cx='210' cy='300' r='30' fill='none' display='${thoughtDisplay}'/>`,
    thoughtFill,
    `<circle id='will-box' cx='300' cy='300' r='30' fill='none' display='${willDisplay}'/>`,
    willFill,
    `<circle id='awa-box' cx='390' cy='300' r='30' fill='none' display='${awaDisplay}'/>`,
    awaFill,
    "</svg>",
  ].join("");
}

function progressLabel(minted: number, quota: number): string {
  return `Minted(${minted}/${quota})`;
}

function makeFixturePathToken(args: {
  tokenId: number;
  stage: "THOUGHT" | "WILL" | "AWA" | "COMPLETE";
  thoughtMinted: number;
  thoughtQuota: number;
  willMinted: number;
  willQuota: number;
  awaMinted: number;
  awaQuota: number;
  slug: string;
}): PathTokenInventoryItem {
  const svg = makePathProgressSvg(args);
  const thought = progressLabel(args.thoughtMinted, args.thoughtQuota);
  const will = progressLabel(args.willMinted, args.willQuota);
  const awa = progressLabel(args.awaMinted, args.awaQuota);
  const metadata = {
    name: `$PATH #${args.tokenId}`,
    description: PATH_DESCRIPTION,
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    attributes: [
      { trait_type: "Stage", value: args.stage },
      { trait_type: "THOUGHT", value: thought },
      { trait_type: "WILL", value: will },
      { trait_type: "AWA", value: awa },
    ],
    token: String(args.tokenId),
    stage: args.stage,
    thought,
    will,
    awa,
    image_data: svg,
    movementTokens:
      args.thoughtMinted > 0
        ? {
            THOUGHT: {
              tokenId: args.tokenId,
              url: `/thought/${args.tokenId}`,
            },
          }
        : undefined,
    mint: {
      owner: FIXTURE_OWNER,
      priceEth: "0.2059 ETH",
      mintedAt: "2026-05-21 08:21:24 UTC",
      txHash: "0x261400000000000000000000000000000000000000000000000000000000fbb3",
    },
    pulse: {
      epoch: 2,
      floorEth: "0.2059 ETH",
      startAskEth: "0.3008 ETH",
    },
  };
  return {
    tokenId: BigInt(args.tokenId),
    tokenIdLabel: String(args.tokenId),
    owner: FIXTURE_OWNER,
    tokenUri: `fixture:path:${args.slug}`,
    metadata,
  };
}

function fixtureWillOneOfTen(): PathTokenInventoryItem {
  return makeFixturePathToken({
    tokenId: 1,
    stage: "WILL",
    thoughtMinted: 1,
    thoughtQuota: 1,
    willMinted: 1,
    willQuota: 10,
    awaMinted: 0,
    awaQuota: 0,
    slug: "will-1-of-10",
  });
}

function fixturePathStates(): PathTokenInventoryItem[] {
  const q = FIXTURE_QUOTAS;
  return [
    makeFixturePathToken({
      tokenId: 1,
      stage: "THOUGHT",
      thoughtMinted: 0,
      thoughtQuota: q.thought,
      willMinted: 0,
      willQuota: q.will,
      awaMinted: 0,
      awaQuota: q.awa,
      slug: "fresh",
    }),
    makeFixturePathToken({
      tokenId: 2,
      stage: "THOUGHT",
      thoughtMinted: 2,
      thoughtQuota: q.thought,
      willMinted: 0,
      willQuota: q.will,
      awaMinted: 0,
      awaQuota: q.awa,
      slug: "thought-2-of-3",
    }),
    makeFixturePathToken({
      tokenId: 3,
      stage: "WILL",
      thoughtMinted: q.thought,
      thoughtQuota: q.thought,
      willMinted: 0,
      willQuota: q.will,
      awaMinted: 0,
      awaQuota: q.awa,
      slug: "will-0-of-10",
    }),
    makeFixturePathToken({
      tokenId: 4,
      stage: "WILL",
      thoughtMinted: q.thought,
      thoughtQuota: q.thought,
      willMinted: 1,
      willQuota: q.will,
      awaMinted: 0,
      awaQuota: q.awa,
      slug: "will-1-of-10",
    }),
    makeFixturePathToken({
      tokenId: 5,
      stage: "WILL",
      thoughtMinted: q.thought,
      thoughtQuota: q.thought,
      willMinted: 5,
      willQuota: q.will,
      awaMinted: 0,
      awaQuota: q.awa,
      slug: "will-5-of-10",
    }),
    makeFixturePathToken({
      tokenId: 6,
      stage: "AWA",
      thoughtMinted: q.thought,
      thoughtQuota: q.thought,
      willMinted: q.will,
      willQuota: q.will,
      awaMinted: 0,
      awaQuota: q.awa,
      slug: "awa-0-of-2",
    }),
    makeFixturePathToken({
      tokenId: 7,
      stage: "AWA",
      thoughtMinted: q.thought,
      thoughtQuota: q.thought,
      willMinted: q.will,
      willQuota: q.will,
      awaMinted: 1,
      awaQuota: q.awa,
      slug: "awa-1-of-2",
    }),
    makeFixturePathToken({
      tokenId: 8,
      stage: "COMPLETE",
      thoughtMinted: q.thought,
      thoughtQuota: q.thought,
      willMinted: q.will,
      willQuota: q.will,
      awaMinted: q.awa,
      awaQuota: q.awa,
      slug: "complete",
    }),
  ];
}

function pathFixtureItems(fixture: string | null): PathTokenInventoryItem[] | null {
  if (fixture === "will" || fixture === "will-1-of-10") {
    return [fixtureWillOneOfTen()];
  }
  if (
    fixture === "states" ||
    fixture === "path-states" ||
    fixture === "all-states"
  ) {
    return fixturePathStates();
  }
  return null;
}

function ChainLoadingStatus({
  status,
}: {
  status: string;
}) {
  return (
    <span className="inshell-chain-loading" aria-label={`reading from chain: ${status}...`}>
      <span className="inshell-chain-loading__line">
        reading from chain: {status}
        <span className="inshell-chain-loading__dots" aria-hidden="true">...</span>
      </span>
    </span>
  );
}

function PathTokenCard({
  item,
}: {
  item: PathTokenInventoryItem;
}) {
  const image = metadataImage(item);
  const metadataLabel = metadataName(item);
  const name = displayTokenName(item);
  const units = unitProgressByMovement(item);
  const shareHref = pathTokenHref(item.tokenIdLabel);

  return (
    <article
      id={`path-${item.tokenIdLabel}`}
      className="path-page-token"
      data-path-token-id={item.tokenIdLabel}
      aria-label={`${name} card`}
    >
      <div className="path-page-token__media">
        {image ? (
          <a
            className="path-page-token__media-link"
            href={shareHref}
            aria-label={`Open ${name}`}
            onClick={handlePathRouteAnchorClick}
          >
            <img
              src={image}
              alt={`${name} movement progress`}
              title={metadataLabel}
            />
          </a>
        ) : (
          <div className="path-page-token__missing">image unavailable</div>
        )}
      </div>
      <div className="path-page-token__body" aria-label={`${name} lifecycle`}>
        <div className="path-page-token__name">{name}</div>
        <div className="path-page-token__owner">
          owner {shortAddress(item.owner)}
        </div>
        <div className="path-page-token__stage">
          <span>stage</span>
          <strong>{stageValue(item)}</strong>
        </div>
        <div className="path-page-token__progress-title">units</div>
        <dl className="path-page-token__attrs">
          {units.map(({ movement, progress }) => (
            <div
              className="path-page-token__attr"
              key={`${item.tokenIdLabel}-${movement}`}
            >
              <dt>{movement}</dt>
              <dd>{progress.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

function PathDetailDisclosure({
  id,
  label,
  summary,
  lines,
}: {
  id: string;
  label: string;
  summary: string;
  lines: readonly string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="path-detail__disclosure">
      <div className="path-detail__disclosure-row">
        <p className="path-detail__disclosure-summary">{summary}</p>
        <button
          aria-controls={id}
          aria-expanded={expanded}
          aria-label={`${expanded ? "collapse" : "expand"} ${label}`}
          className="path-detail__disclosure-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          [ {expanded ? "less" : "more"} ]
        </button>
      </div>
      {expanded ? (
        <p className="path-detail__disclosure-lines" id={id}>
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
      ) : null}
    </div>
  );
}

function PathTokenDetail({
  item,
  chainId,
  contractAddress,
  issuance,
}: {
  item: PathTokenInventoryItem;
  chainId?: number;
  contractAddress?: string;
  issuance: PathIssuance | null;
}) {
  const image = metadataImage(item);
  const name = displayTokenName(item);
  const units = unitProgressByMovement(item);
  const movementLinks = movementTokenLinks(item);
  const nextMovement = units.find(
    ({ progress }) =>
      progress.used != null &&
      progress.total != null &&
      progress.used < progress.total
  );
  const remaining = nextMovement?.progress.total != null && nextMovement.progress.used != null
    ? nextMovement.progress.total - nextMovement.progress.used
    : 0;
  const ownerExplorerHref = pathAddressExplorerHref(chainId, item.owner);
  const contractExplorerHref = pathAddressExplorerHref(chainId, contractAddress);
  const mintTransactionExplorerHref = pathTransactionExplorerHref(
    chainId,
    issuance?.transactionHash,
  );
  return (
    <div className="path-detail">
      <div className="path-detail__canvas-column">
        {image ? (
          <img
            className="path-detail__image"
            src={image}
            alt={`${name} movement progress`}
            title={metadataName(item)}
          />
        ) : (
          <div className="path-detail__missing">image unavailable</div>
        )}
        <p className="path-detail__artwork-source">
          canonical artwork · PathNFT tokenURI()
        </p>
      </div>

      <div className="path-detail__rail" aria-label={`${name} lifecycle`}>
        <section className="path-detail__section">
          <h2>about</h2>
          <PathDetailDisclosure
            id="path-about"
            label="about $PATH"
            summary={PATH_OVERVIEW}
            lines={PATH_OVERVIEW_LINES}
          />
        </section>

        <section className="path-detail__section">
          <h2>next movement</h2>
          {nextMovement ? (
            <div className="path-detail__capability">
              <strong>
                {nextMovement.movement} · {remaining} unit{remaining === 1 ? "" : "s"} remaining
              </strong>
              <p>
                Each unit can authorize one {nextMovement.movement} work mint.
              </p>
              {nextMovement.movement === "THOUGHT" ? (
                <a className="path-detail__cta" href="/thought">
                  create a THOUGHT
                </a>
              ) : null}
            </div>
          ) : (
            <p className="path-detail__text">All available movement units have been used.</p>
          )}
        </section>

        <section className="path-detail__section">
          <h2>movement quotas</h2>
          <dl className="path-detail__fields">
            <div>
              <dt>stage</dt>
              <dd>{stageValue(item)}</dd>
            </div>
            {units.map(({ movement, progress }) => (
              <div key={`${item.tokenIdLabel}-${movement}`}>
                <dt>{movement}</dt>
                <dd>{progress.label}</dd>
              </div>
            ))}
          </dl>
          <PathDetailDisclosure
            id="path-movement-quotas"
            label="movement quota guide"
            summary={PATH_MOVEMENT_QUOTA_NOTE}
            lines={PATH_MOVEMENT_QUOTA_LINES}
          />
        </section>

        {movementLinks.length > 0 ? (
          <section className="path-detail__section">
            <h2>movement tokens</h2>
            <div className="path-detail__movement-links">
              {movementLinks.map((link) => (
                <a
                  className="path-detail__value-link"
                  href={link.href}
                  key={`${link.movement}-${link.tokenId}`}
                >
                  {link.movement} #{link.tokenId} ↗
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="path-detail__section">
          <h2>token details</h2>
          <dl className="path-detail__fields">
            <div>
              <dt>owner</dt>
              <dd title={item.owner}>
                {ownerExplorerHref ? (
                  <a className="path-detail__value-link" href={ownerExplorerHref}>
                    {shortAddress(item.owner)} ↗
                  </a>
                ) : (
                  shortAddress(item.owner)
                )}
              </dd>
            </div>
            {issuance ? (
              <>
                <div>
                  <dt>mint price</dt>
                  <dd title={`${issuance.price.dec} wei`}>
                    {formatPathMintPrice(issuance.price)} {pathCurrencyLabel(chainId)}
                  </dd>
                </div>
                <div>
                  <dt>initial minter</dt>
                  <dd title={issuance.initialMinter}>
                    {shortAddress(issuance.initialMinter)}
                  </dd>
                </div>
                <div>
                  <dt>mint block</dt>
                  <dd>{issuance.blockNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt>mint transaction</dt>
                  <dd title={issuance.transactionHash}>
                    {mintTransactionExplorerHref ? (
                      <a
                        className="path-detail__value-link"
                        href={mintTransactionExplorerHref}
                      >
                        {shortAddress(issuance.transactionHash)} ↗
                      </a>
                    ) : (
                      shortAddress(issuance.transactionHash)
                    )}
                  </dd>
                </div>
                <div>
                  <dt>minted via</dt>
                  <dd>
                    <a className="path-detail__value-link" href="/pulse">
                      Pulse ↗
                    </a>
                  </dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>contract</dt>
              <dd title={contractAddress}>
                {contractExplorerHref ? (
                  <a className="path-detail__value-link" href={contractExplorerHref}>
                    {shortAddress(contractAddress)} ↗
                  </a>
                ) : (
                  shortAddress(contractAddress)
                )}
              </dd>
            </div>
            <div>
              <dt>token ID</dt>
              <dd>{item.tokenIdLabel}</dd>
            </div>
            <div>
              <dt>network</dt>
              <dd>{pathNetworkLabel(chainId)}</dd>
            </div>
            <div>
              <dt>chain ID</dt>
              <dd>{chainId ?? "—"}</dd>
            </div>
            <div>
              <dt>standard</dt>
              <dd>ERC-721</dd>
            </div>
            <div>
              <dt>metadata</dt>
              <dd>tokenURI()</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

export default function PathPage({
  tokenId = null,
  refreshSignal = 0,
}: PathPageProps) {
  const fixture = useMemo(() => readPathFixture(), []);
  const fixtureItems = useMemo(() => pathFixtureItems(fixture), [fixture]);
  const pathNftAddress = useMemo(() => maybeResolveAddress("path_nft"), []);
  const fromBlock = useMemo(() => getProtocolReleaseDeployBlock("path_nft"), []);
  const chainId = useMemo(() => getProtocolReleaseChainId(), []);
  const release = useMemo(() => getProtocolRelease(), []);
  const pulseAuctionAddress = useMemo(() => maybeResolveAddress("pulse_auction"), []);
  const pulseAuctionFromBlock = useMemo(
    () => getProtocolReleaseDeployBlock("pulse_auction"),
    [],
  );
  const saleHistory = useAuctionBids({
    address: pulseAuctionAddress ?? "0x0000000000000000000000000000000000000000",
    fromBlock: pulseAuctionFromBlock,
    enabled: Boolean(tokenId && pulseAuctionAddress),
  });
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    items: [],
    error: null,
  });
  const [loadingDetailIndex, setLoadingDetailIndex] = useState(0);

  useEffect(() => {
    if (state.status !== "loading") {
      return;
    }

    setLoadingDetailIndex(0);
    const timer = window.setInterval(() => {
      setLoadingDetailIndex((index) => (index + 1) % PATH_LOADING_DETAILS.length);
    }, CHAIN_LOADING_DETAIL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [state.status, refreshSignal, retryNonce]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        setRetryNonce((value) => value + 1);
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (fixtureItems) {
      setState({ status: "ready", items: fixtureItems, error: null });
      return;
    }
    if (!pathNftAddress) {
      setState({
        status: "error",
        items: [],
        error: "PATH NFT address is missing. Sync the PATH FE release first.",
      });
      return;
    }
    if (fromBlock == null) {
      setState({
        status: "error",
        items: [],
        error: "PATH deploy block is missing. Sync the PATH FE release first.",
      });
      return;
    }
    let cancelled = false;
    const cachedThoughts = readCachedThoughtGallery();
    const cached =
      refreshSignal === 0 && retryNonce === 0
        ? readCachedAllPathTokens({
            pathNftAddress,
            fromBlock,
          })
        : null;
    if (cached) {
      setState({
        status: "ready",
        items: overlayThoughtMints(cached, cachedThoughts),
        error: null,
      });
    } else {
      setState((prev) => ({ status: "loading", items: prev.items, error: null }));
    }
    Promise.all([
      loadAllPathTokens({
        pathNftAddress,
        fromBlock,
        cacheMode: refreshSignal > 0 || retryNonce > 0 ? "bypass" : "default",
      }),
      loadThoughtGallery({
        cacheMode: refreshSignal > 0 || retryNonce > 0 ? "bypass" : "default",
      }).catch(() => cachedThoughts ?? []),
    ])
      .then(([items, thoughts]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          items: overlayThoughtMints(items, thoughts),
          error: null,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "error",
          items: [],
          error: String((err as Error)?.message ?? err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [fixtureItems, fromBlock, pathNftAddress, refreshSignal, retryNonce]);

  const selectedItem = tokenId
    ? state.items.find((item) => item.tokenIdLabel === tokenId)
    : null;
  const issuance = selectedItem
    ? findPathIssuance({
        tokenId: selectedItem.tokenId,
        sales: saleHistory.bids,
        tokenBase: release?.config?.token_base,
        epochBase: release?.config?.epoch_base,
      })
    : null;

  if (tokenId) {
    return (
      <main
        className="path-detail-page"
        aria-labelledby="path-detail-title"
      >
        <header className="path-detail__header">
          <h1 id="path-detail-title" className="path-detail__title">
            $PATH #{tokenId}
          </h1>
          <nav className="path-detail__links" aria-label="$PATH detail links">
            <a
              className="path-detail__link"
              href="/path"
              onClick={handlePathRouteAnchorClick}
            >
              [ all $PATH ]
            </a>
          </nav>
        </header>

        {state.status === "error" ? (
          <div className="path-detail__status path-detail__status--error">
            <span title={state.error}>$PATH record unavailable.</span>
            <button
              type="button"
              className="path-page__retry"
              onClick={() => setRetryNonce((value) => value + 1)}
            >
              retry
            </button>
          </div>
        ) : state.status === "loading" ? (
          <p className="path-detail__status">
            <ChainLoadingStatus status={PATH_LOADING_DETAILS[loadingDetailIndex]} />
          </p>
        ) : selectedItem ? (
          <PathTokenDetail
            item={selectedItem}
            chainId={chainId}
            contractAddress={pathNftAddress}
            issuance={issuance}
          />
        ) : (
          <div className="path-detail__status path-detail__status--not-found">
            <span>$PATH #{tokenId} not found.</span>
            <a href="/path" onClick={handlePathRouteAnchorClick}>view all $PATH</a>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="primitive-page path-page">
      <section
        className="path-page__body"
        aria-label="All $PATH tokens"
      >
        <div className="path-page__toolbar">
          <div className="path-page__section-title">
            all $PATH{state.status === "ready" ? ` · ${state.items.length}` : ""}
          </div>
          {state.status === "loading" ? (
            <div className="path-page__sub">
              <ChainLoadingStatus
                status={PATH_LOADING_DETAILS[loadingDetailIndex]}
              />
            </div>
          ) : null}
        </div>

        {state.status === "error" && (
          <div className="path-page__notice path-page__notice--error">
            <span title={state.error}>token gallery unavailable.</span>
            <button
              type="button"
              className="path-page__retry"
              onClick={() => setRetryNonce((value) => value + 1)}
            >
              retry
            </button>
          </div>
        )}

        {state.status === "ready" && state.items.length === 0 ? (
          <div className="path-page__notice">no $PATH minted yet.</div>
        ) : state.items.length > 0 ? (
          <div className="path-page__grid">
            {state.items.map((item) => (
              <PathTokenCard
                key={item.tokenIdLabel}
                item={item}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
