import { useEffect, useMemo, useState } from "react";
import {
  getProtocolReleaseChainId,
  getProtocolReleaseDeployBlock,
  maybeResolveAddress,
} from "@inshell/contracts";
import { SURFACE_TERMINOLOGY } from "@inshell/shared";
import {
  loadAllPathTokens,
  type PathTokenAttribute,
  type PathTokenInventoryItem,
} from "@/services/pathTokens";

type LoadState =
  | { status: "loading"; items: PathTokenInventoryItem[]; error: null }
  | { status: "ready"; items: PathTokenInventoryItem[]; error: null }
  | { status: "error"; items: PathTokenInventoryItem[]; error: string };

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

function movementProgressValue(item: PathTokenInventoryItem, traitType: string): string {
  const attribute = findAttribute(item, traitType);
  const raw = attribute ? attrValue(attribute) : "—";
  const match = /^Minted\((\d+)\/(\d+)\)$/i.exec(raw.trim());
  if (match) return match[2] === "0" ? "- / -" : `${match[1]} / ${match[2]}`;
  const spaced = /^(\d+)\s*\/\s*(\d+)(?:\s+minted)?$/i.exec(raw.trim());
  if (spaced) return spaced[2] === "0" ? "- / -" : `${spaced[1]} / ${spaced[2]}`;
  return raw;
}

function metadataName(item: PathTokenInventoryItem): string {
  const name = item.metadata.name?.trim();
  return name || `$PATH #${item.tokenIdLabel}`;
}

function displayTokenName(item: PathTokenInventoryItem): string {
  return `$PATH #${item.tokenIdLabel}`;
}

function metadataImage(item: PathTokenInventoryItem): string | undefined {
  if (item.metadata.image) return item.metadata.image;
  const imageData = item.metadata.image_data?.trim();
  if (imageData?.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageData)}`;
  }
  return undefined;
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
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600' width='600' height='600' role='img' aria-label='PATH movement progress'>",
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
        <span className="inshell-chain-loading__dots" aria-hidden="true" />
      </span>
    </span>
  );
}

export default function PathPage() {
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
    setState((prev) => ({ status: "loading", items: prev.items, error: null }));
    loadAllPathTokens({
      pathNftAddress,
      fromBlock,
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

  return (
    <main className="primitive-page path-page">
      <header className="primitive-page__header path-page__header">
        <div>
          <h1 className="primitive-page__title">{SURFACE_TERMINOLOGY.pathDapp}</h1>
          <p className="primitive-page__subtitle">
            Permission tokens for movement mints.
          </p>
        </div>
      </header>

      <section className="path-page__body" aria-label="All $PATH tokens">
        <div className="path-page__intro">
          <p>$PATH is minted by the public Pulse auction.</p>
          <p>Each $PATH authorizes movement mints in order: THOUGHT, WILL, then AWA.</p>
          <p>Each movement has its own quota.</p>
          <p>A movement mint consumes one quota unit from the selected PATH.</p>
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
            aria-label="View Pulse pricing"
          >
            View Pulse pricing ↗
          </a>
        </nav>

        <div className="path-page__toolbar">
          <div>
            <div className="path-page__section-title">all tokens</div>
            <div className="path-page__sub">
              {state.status === "ready"
                ? `${state.items.length} token${state.items.length === 1 ? "" : "s"}`
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

        {state.status === "ready" && state.items.length === 0 && (
          <div className="path-page__notice">no PATH minted yet.</div>
        )}

        {state.items.length > 0 && (
          <div className="path-page__grid">
            {state.items.map((item) => {
              const image = metadataImage(item);
              const metadataLabel = metadataName(item);
              const name = displayTokenName(item);
              return (
                <article className="path-page-token" key={item.tokenIdLabel}>
                  <div className="path-page-token__media">
                    {image ? (
                      <img
                        src={image}
                        alt={`PATH #${item.tokenIdLabel} movement progress`}
                        title={metadataLabel}
                      />
                    ) : (
                      <div className="path-page-token__missing">image unavailable</div>
                    )}
                  </div>
                  <div className="path-page-token__body">
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
                      {MOVEMENT_TRAITS.map((traitType) => (
                        <div
                          className="path-page-token__attr"
                          key={`${item.tokenIdLabel}-${traitType}`}
                        >
                          <dt>{traitType}</dt>
                          <dd>{movementProgressValue(item, traitType)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
