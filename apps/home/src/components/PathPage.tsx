import { useEffect, useMemo, useRef, useState } from "react";
import {
  getProtocolReleaseChainId,
  getProtocolReleaseDeployBlock,
  maybeResolveAddress,
} from "@inshell/contracts";
import { SURFACE_TERMINOLOGY } from "@inshell/shared";
import {
  loadAllPathTokens,
  readCachedAllPathTokens,
  type PathTokenAttribute,
  type PathTokenInventoryItem,
} from "@/services/pathTokens";

type LoadState =
  | { status: "loading"; items: PathTokenInventoryItem[]; error: null }
  | { status: "ready"; items: PathTokenInventoryItem[]; error: null }
  | { status: "error"; items: PathTokenInventoryItem[]; error: string };

type PathPageProps = {
  tokenId?: string | null;
};

const FIXTURE_OWNER = "0x1111222233334444555566667777888899990000";
const PATH_DESCRIPTION =
  "$PATH is the permission token. It is minted by the public Pulse auction and authorizes movement mints in order: THOUGHT, WILL, then AWA. The token image and traits show movement progress.";
const CHAIN_LOADING_DETAIL_MS = 1400;
const PATH_LOADING_DETAILS = [
  "checking latest block",
  "scanning PATH transfer logs",
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
type MovementTrait = (typeof MOVEMENT_TRAITS)[number];

type UnitProgress = {
  used: number | null;
  total: number | null;
  label: string;
  available: boolean;
};

type DetailRow = {
  label: string;
  value: string;
  title?: string;
  href?: string;
};

type MovementTokenRecord = {
  label: MovementTrait;
  text: string;
  href?: string;
};

function shortAddress(address?: string): string {
  if (!address) return "—";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function shortHash(value: string): string {
  return /^0x[0-9a-fA-F]{16,}$/.test(value)
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

function readPathFixture(): string | null {
  if (typeof window === "undefined") return null;
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  if (envCache?.MODE === "production" || envCache?.PROD === true) return null;
  const fixture = new globalThis.URLSearchParams(window.location.search).get("fixture");
  return fixture?.trim().toLowerCase() || null;
}

function chainLabelFromChainId(chainId: number | undefined): string {
  if (chainId === 1) return "Ethereum";
  if (chainId === 11155111) return "Sepolia";
  if (chainId === 31337 || chainId === 1337) return "Local Devnet";
  return Number.isFinite(chainId) ? `Chain ${chainId}` : "current RPC";
}

function attrValue(attribute: PathTokenAttribute): string {
  const value = attribute.value;
  if (value == null) return "—";
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
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

function metadataImage(item: PathTokenInventoryItem): string | undefined {
  if (item.metadata.image) return item.metadata.image;
  const imageData = item.metadata.image_data?.trim();
  if (imageData?.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageData)}`;
  }
  return undefined;
}

function firstMetadataValue(
  item: PathTokenInventoryItem,
  keys: string[]
): string {
  const metadata = item.metadata as Record<string, unknown>;
  for (const key of keys) {
    const direct = stringValue(metadata[key]);
    if (direct) return direct;
  }
  for (const attribute of item.metadata.attributes ?? []) {
    const trait = String(attribute.trait_type ?? "").trim().toLowerCase();
    if (keys.some((key) => key.toLowerCase() === trait)) {
      return stringValue(attribute.value);
    }
  }
  return "";
}

function nestedMetadataValue(
  item: PathTokenInventoryItem,
  section: string,
  keys: string[]
): string {
  const metadata = item.metadata as Record<string, unknown>;
  const record = asRecord(metadata[section]);
  if (!record) return "";
  for (const key of keys) {
    const value = stringValue(record[key]);
    if (value) return value;
  }
  return "";
}

function publicMetadataUrl(item: PathTokenInventoryItem): string {
  const fromMetadata = firstMetadataValue(item, [
    "metadata",
    "metadataUrl",
    "metadata_url",
    "tokenURI",
    "token_uri",
  ]);
  const candidate = fromMetadata || item.tokenUri;
  return /^https?:\/\//i.test(candidate) ? candidate : "";
}

function sourceRows(item: PathTokenInventoryItem): DetailRow[] {
  const metadata = item.metadata as Record<string, unknown>;
  const sources = asRecord(metadata.sourceUrls) ?? asRecord(metadata.source_urls);
  const rows: DetailRow[] = [];
  const minted = stringValue(sources?.minted) || firstMetadataValue(item, ["mintSource", "mint_source"]);
  const updated =
    stringValue(sources?.updated) || firstMetadataValue(item, ["updateSource", "update_source"]);
  const tx =
    nestedMetadataValue(item, "mint", ["txHash", "tx", "transactionHash"]) ||
    firstMetadataValue(item, ["tx", "txHash", "transactionHash"]);
  if (/^https?:\/\//i.test(minted)) rows.push({ label: "mint source", value: "source ↗", href: minted });
  if (/^https?:\/\//i.test(updated)) rows.push({ label: "update source", value: "source ↗", href: updated });
  if (tx) rows.push({ label: "tx", value: shortHash(tx), title: tx });
  return rows;
}

function unitProgressByMovement(item: PathTokenInventoryItem) {
  return MOVEMENT_TRAITS.map((movement) => ({
    movement,
    progress: movementProgress(item, movement),
  }));
}

function lifecycleNote(item: PathTokenInventoryItem): string {
  const units = unitProgressByMovement(item);
  const available = units.filter(({ progress }) => progress.available && progress.total != null);
  const consumed = available.filter(({ progress }) => (progress.used ?? 0) > 0);
  const stage = stageValue(item).toUpperCase();
  if (
    available.length > 0 &&
    (stage === "COMPLETE" ||
      available.every(({ progress }) => (progress.used ?? 0) >= (progress.total ?? Number.POSITIVE_INFINITY)))
  ) {
    return "This $PATH has completed its available movement units.";
  }
  if (consumed.length > 0) {
    return "This $PATH has started its movement lifecycle.";
  }
  return "This $PATH is ready to move through THOUGHT, WILL, and AWA.";
}

function consumedUnitRows(item: PathTokenInventoryItem): string[] {
  return unitProgressByMovement(item)
    .filter(({ progress }) => (progress.used ?? 0) > 0)
    .map(({ movement, progress }) => {
      return progress.total === 1
        ? `$PATH #${item.tokenIdLabel} consumed its ${movement} unit.`
        : `$PATH #${item.tokenIdLabel} consumed one ${movement} unit.`;
    });
}

function thoughtDetailHref(tokenId: string): string {
  return `/thought/${tokenId}`;
}

function movementTokenId(item: PathTokenInventoryItem, movement: MovementTrait): string {
  const metadata = item.metadata as Record<string, unknown>;
  const tokens = asRecord(metadata.movementTokens) ?? asRecord(metadata.movement_tokens);
  const rawRecord = tokens
    ? asRecord(tokens[movement]) ?? asRecord(tokens[movement.toLowerCase()])
    : null;
  const fromRecord =
    stringValue(rawRecord?.tokenId) ||
    stringValue(rawRecord?.token_id) ||
    stringValue(rawRecord?.id);
  if (fromRecord) return fromRecord;
  return firstMetadataValue(item, [
    `${movement} token`,
    `${movement} token id`,
    `${movement} id`,
    `${movement} NFT`,
  ]);
}

function movementTokenHref(item: PathTokenInventoryItem, movement: MovementTrait): string {
  const metadata = item.metadata as Record<string, unknown>;
  const tokens = asRecord(metadata.movementTokens) ?? asRecord(metadata.movement_tokens);
  const rawRecord = tokens
    ? asRecord(tokens[movement]) ?? asRecord(tokens[movement.toLowerCase()])
    : null;
  const direct = stringValue(rawRecord?.url) || stringValue(rawRecord?.href);
  if (direct) return direct;
  const tokenId = movementTokenId(item, movement);
  return movement === "THOUGHT" && /^[1-9]\d*$/.test(tokenId)
    ? thoughtDetailHref(tokenId)
    : "";
}

function movementTokenRecords(item: PathTokenInventoryItem): MovementTokenRecord[] {
  return MOVEMENT_TRAITS.map((movement) => {
    const tokenId = movementTokenId(item, movement);
    const href = movementTokenHref(item, movement);
    return {
      label: movement,
      text: tokenId ? `${movement} #${tokenId} ↗` : "—",
      href: tokenId && href ? href : undefined,
    };
  });
}

function mintRows(item: PathTokenInventoryItem): DetailRow[] {
  const owner = nestedMetadataValue(item, "mint", ["owner"]) || firstMetadataValue(item, ["mint owner"]);
  const buyer = nestedMetadataValue(item, "mint", ["buyer"]) || firstMetadataValue(item, ["buyer"]);
  const price =
    nestedMetadataValue(item, "mint", ["priceEth", "price", "price_ether"]) ||
    firstMetadataValue(item, ["price", "mint price"]);
  const minted =
    nestedMetadataValue(item, "mint", ["mintedAt", "minted", "time"]) ||
    firstMetadataValue(item, ["minted", "minted at"]);
  const tx =
    nestedMetadataValue(item, "mint", ["txHash", "tx", "transactionHash"]) ||
    firstMetadataValue(item, ["tx", "txHash", "transactionHash"]);
  return [
    buyer ? { label: "buyer", value: shortAddress(buyer), title: buyer } : null,
    owner ? { label: "owner", value: shortAddress(owner), title: owner } : null,
    price ? { label: "price", value: price } : null,
    minted ? { label: "minted", value: minted, title: minted } : null,
    tx ? { label: "tx", value: shortHash(tx), title: tx } : null,
  ].filter((row): row is DetailRow => Boolean(row));
}

function pricingRows(item: PathTokenInventoryItem): DetailRow[] {
  const epoch =
    nestedMetadataValue(item, "pulse", ["epoch"]) || firstMetadataValue(item, ["epoch", "pulse epoch"]);
  const floor =
    nestedMetadataValue(item, "pulse", ["floorEth", "floor", "floor_ether"]) ||
    firstMetadataValue(item, ["floor", "pulse floor"]);
  const startAsk =
    nestedMetadataValue(item, "pulse", ["startAskEth", "startAsk", "start_ask"]) ||
    firstMetadataValue(item, ["start ask", "startAsk", "reset ask"]);
  return [
    epoch ? { label: "epoch", value: epoch } : null,
    floor ? { label: "floor", value: floor } : null,
    startAsk ? { label: "start ask", value: startAsk } : null,
    { label: "pricing", value: "View $PATH pricing ↗", href: "/pulse" },
  ].filter((row): row is DetailRow => Boolean(row));
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

function CardRows({ rows }: { rows: DetailRow[] }) {
  return (
    <dl className="path-page-token__rows">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`}>
          <dt>{row.label}</dt>
          <dd title={row.title}>
            {row.href ? (
              <a href={row.href} className="path-page-token__value-link">
                {row.value}
              </a>
            ) : (
              row.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PathTokenCard({
  item,
  focused,
  registerRef,
}: {
  item: PathTokenInventoryItem;
  focused: boolean;
  registerRef?: (node: HTMLElement | null) => void;
}) {
  const image = metadataImage(item);
  const metadataLabel = metadataName(item);
  const name = displayTokenName(item);
  const units = unitProgressByMovement(item);
  const consumedRows = consumedUnitRows(item);
  const movementTokens = movementTokenRecords(item);
  const mint = mintRows(item);
  const pricing = pricingRows(item);
  const metadataUrl = publicMetadataUrl(item);
  const sources = sourceRows(item);
  const hasMovementTokenData = movementTokens.some((token) => token.href);
  const shareHref = pathTokenHref(item.tokenIdLabel);

  return (
    <article
      ref={registerRef}
      className={`path-page-token${focused ? " path-page-token--focused" : ""}`}
      data-path-token-id={item.tokenIdLabel}
      aria-label={focused ? `${name} focused card` : `${name} card`}
    >
      <div className="path-page-token__media">
        {image ? (
          <a
            className="path-page-token__media-link"
            href={shareHref}
            aria-label={`Open ${name}`}
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
        <p className="path-page-token__note">{lifecycleNote(item)}</p>
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

        {focused ? (
          <div className="path-page-token__focus" aria-label={`${name} focused state`}>
            <div className="path-page-token__progress-title">from this $PATH</div>
            <CardRows
              rows={movementTokens.map((token) => ({
                label: token.label,
                value: hasMovementTokenData || token.href ? token.text : "—",
                href: token.href,
              }))}
            />

            {consumedRows.length > 0 && (
              <div className="path-page-token__notes">
                {consumedRows.map((row) => (
                  <p key={row}>{row}</p>
                ))}
              </div>
            )}

            {mint.length > 0 && (
              <>
                <div className="path-page-token__progress-title">mint</div>
                <CardRows rows={mint} />
              </>
            )}

            <div className="path-page-token__progress-title">pricing</div>
            <CardRows rows={pricing} />

            <div className="path-page-token__progress-title">share</div>
            <CardRows rows={[{ label: "url", value: `${name} ↗`, href: shareHref }]} />

            {(metadataUrl || metadataLabel) && (
              <>
                <div className="path-page-token__progress-title">metadata</div>
                <CardRows
                  rows={[
                    metadataUrl
                      ? { label: "metadata", value: `${metadataLabel} ↗`, href: metadataUrl }
                      : { label: "metadata", value: metadataLabel, title: metadataLabel },
                  ]}
                />
              </>
            )}

            {sources.length > 0 && (
              <>
                <div className="path-page-token__progress-title">source</div>
                <CardRows rows={sources} />
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function PathPage({ tokenId = null }: PathPageProps) {
  const fixture = useMemo(() => readPathFixture(), []);
  const fixtureItems = useMemo(() => pathFixtureItems(fixture), [fixture]);
  const pathNftAddress = useMemo(() => maybeResolveAddress("path_nft"), []);
  const fromBlock = useMemo(() => getProtocolReleaseDeployBlock("path_nft"), []);
  const chainLabel = useMemo(
    () => chainLabelFromChainId(getProtocolReleaseChainId()),
    []
  );
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    items: [],
    error: null,
  });
  const [loadingDetailIndex, setLoadingDetailIndex] = useState(0);
  const tokenRefs = useRef<Record<string, HTMLElement | null>>({});

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
  }, [state.status, refreshNonce]);

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
    const cached =
      refreshNonce === 0
        ? readCachedAllPathTokens({
            pathNftAddress,
            fromBlock,
          })
        : null;
    if (cached) {
      setState({ status: "ready", items: cached, error: null });
    } else {
      setState((prev) => ({ status: "loading", items: prev.items, error: null }));
    }
    loadAllPathTokens({
      pathNftAddress,
      fromBlock,
      cacheMode: refreshNonce > 0 ? "bypass" : "default",
    })
      .then((items) => {
        if (cancelled) return;
        setState({ status: "ready", items, error: null });
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
  }, [fixtureItems, fromBlock, pathNftAddress, refreshNonce]);

  const focusedItem = tokenId
    ? state.items.find((item) => item.tokenIdLabel === tokenId)
    : null;

  useEffect(() => {
    if (!tokenId || state.status !== "ready") return;
    const target = tokenRefs.current[tokenId];
    target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [state.status, tokenId]);

  return (
    <main className="primitive-page path-page">
      <header className="primitive-page__header path-page__header">
        <div>
          <h1 className="primitive-page__title">
            {SURFACE_TERMINOLOGY.pathDapp}
          </h1>
          <p className="primitive-page__subtitle">
            Permission tokens for movement mints.
          </p>
        </div>
      </header>

      <section
        className="path-page__body"
        aria-label="All $PATH tokens"
      >
        <div className="path-page__intro">
          <p>$PATH is minted by the public Pulse auction.</p>
          <p>Each $PATH authorizes movement mints in order: THOUGHT, WILL, then AWA.</p>
          <p>A movement minted from $PATH consumes a movement unit and updates the $PATH lifecycle.</p>
          <p>stage shows the current movement phase.</p>
          <p>units show used / total movement units.</p>
          <p>The token image and traits show movement progress.</p>
        </div>

        <nav
          className="primitive-page__links path-page__links"
          aria-label="PATH page links"
        >
          <a
            href="/pulse"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View $PATH pricing"
          >
            View $PATH pricing ↗
          </a>
        </nav>

        <div className="path-page__toolbar">
          <div>
            <div className="path-page__section-title">all tokens</div>
            <div className="path-page__sub">
              {state.status === "ready"
                ? `${state.items.length} token${state.items.length === 1 ? "" : "s"}${focusedItem ? ` · focused $PATH #${focusedItem.tokenIdLabel}` : ""}`
                : state.status === "loading"
                  ? (
                    <ChainLoadingStatus
                      status={PATH_LOADING_DETAILS[loadingDetailIndex]}
                    />
                  )
                  : "token list unavailable"}
            </div>
          </div>
          <button
            type="button"
            className="path-page__refresh"
            onClick={() => setRefreshNonce((value) => value + 1)}
          >
            refresh
          </button>
        </div>

        <dl className="primitive-page__fields path-page__fields">
          <div>
            <dt>mode</dt>
            <dd>{fixtureItems ? "fixture state gallery" : "live token gallery"}</dd>
          </div>
          <div>
            <dt>source</dt>
            <dd>{fixtureItems ? "fixture tokenURI()" : "live tokenURI()"}</dd>
          </div>
          <div>
            <dt>chain</dt>
            <dd>{fixtureItems ? "fixture" : chainLabel}</dd>
          </div>
          <div>
            <dt>contract</dt>
            <dd>
              {fixtureItems
                ? "not connected"
                : pathNftAddress
                  ? `PathNFT ${shortAddress(pathNftAddress)}`
                  : "missing"}
            </dd>
          </div>
          <div>
            <dt>from block</dt>
            <dd>{fixtureItems ? "n/a" : fromBlock == null ? "missing" : String(fromBlock)}</dd>
          </div>
        </dl>

        {state.status === "error" && (
          <div className="path-page__notice path-page__notice--error">
            {state.error}
          </div>
        )}

        {tokenId && state.status === "ready" && !focusedItem ? (
          <div className="path-page__notice">$PATH #{tokenId} not found.</div>
        ) : null}

        {state.status === "ready" && state.items.length === 0 ? (
          <div className="path-page__notice">no PATH minted yet.</div>
        ) : state.items.length > 0 ? (
          <div className="path-page__grid">
            {state.items.map((item) => (
              <PathTokenCard
                key={item.tokenIdLabel}
                item={item}
                focused={item.tokenIdLabel === tokenId}
                registerRef={(node) => {
                  tokenRefs.current[item.tokenIdLabel] = node;
                }}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
