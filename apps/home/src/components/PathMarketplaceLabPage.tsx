import { useEffect, useMemo, useState } from "react";
import {
  getProtocolReleaseDeployBlock,
  maybeResolveAddress,
} from "@inshell/contracts";
import {
  loadAllPathTokens,
  type PathTokenAttribute,
  type PathTokenInventoryItem,
} from "@/services/pathTokens";
import {
  PATH_MOVEMENT_QUOTA_NOTE,
  PATH_OVERVIEW,
} from "@/content/path";

type LoadState =
  | { status: "loading"; items: PathTokenInventoryItem[]; error: null }
  | { status: "ready"; items: PathTokenInventoryItem[]; error: null }
  | { status: "error"; items: PathTokenInventoryItem[]; error: string };

type Movement = "THOUGHT" | "WILL" | "AWA";
type MovementFilter = "all" | Movement;
type SortOrder = "newest" | "oldest";

type MovementProgress = {
  used: number;
  total: number;
};

const MOVEMENTS: Movement[] = ["THOUGHT", "WILL", "AWA"];

function shortAddress(value?: string) {
  if (!value) return "unknown";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function attributeValue(
  attributes: PathTokenAttribute[] | undefined,
  traitType: string,
) {
  const attribute = attributes?.find(
    (candidate) => candidate.trait_type?.toLowerCase() === traitType.toLowerCase(),
  );
  const value = attribute?.value;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function movementProgress(item: PathTokenInventoryItem, movement: Movement) {
  const raw = attributeValue(item.metadata.attributes, movement);
  const match = /(\d+)\s*\/\s*(\d+)/.exec(raw);
  if (!match) return { used: 0, total: 0 };
  return {
    used: Number(match[1]),
    total: Number(match[2]),
  } satisfies MovementProgress;
}

function stageValue(item: PathTokenInventoryItem) {
  return attributeValue(item.metadata.attributes, "Stage") || "unavailable";
}

function metadataImage(item: PathTokenInventoryItem) {
  if (typeof item.metadata.image === "string" && item.metadata.image.trim()) {
    return item.metadata.image;
  }
  const imageData = item.metadata.image_data?.trim();
  if (imageData?.startsWith("<svg")) {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageData)}`;
  }
  return undefined;
}

function isMovementAvailable(item: PathTokenInventoryItem, movement: Movement) {
  const progress = movementProgress(item, movement);
  return progress.total > progress.used;
}

function tokenName(item: PathTokenInventoryItem) {
  return `$PATH #${item.tokenIdLabel}`;
}

function nextAvailableMovement(item: PathTokenInventoryItem) {
  return MOVEMENTS.find((movement) => isMovementAvailable(item, movement)) ?? null;
}

function PathMarketplaceDetail({
  item,
  pathNftAddress,
}: {
  item: PathTokenInventoryItem;
  pathNftAddress?: string;
}) {
  const image = metadataImage(item);
  const nextMovement = nextAvailableMovement(item);
  const nextProgress = nextMovement
    ? movementProgress(item, nextMovement)
    : null;
  const remainingUnits = nextProgress
    ? Math.max(0, nextProgress.total - nextProgress.used)
    : 0;
  return (
    <main
      className="path-marketplace path-marketplace-detail"
      aria-labelledby="path-marketplace-detail-title"
    >
      <nav className="path-marketplace-detail__breadcrumb" aria-label="Breadcrumb">
        <a href="/lab/path-marketplace">← $PATH collection</a>
      </nav>

      <section className="path-marketplace-detail__layout">
        <div className="path-marketplace-detail__media-panel">
          <div className="path-marketplace-detail__media">
            {image ? (
              <img src={image} alt={`${tokenName(item)} artwork`} />
            ) : (
              <span>artwork unavailable</span>
            )}
          </div>
        </div>

        <div className="path-marketplace-detail__rail">
          <header className="path-marketplace-detail__header">
            <p>$PATH</p>
            <h1 id="path-marketplace-detail-title">{tokenName(item)}</h1>
            <span>owned by {shortAddress(item.owner)}</span>
          </header>

          <section
            className="path-marketplace-detail__capability"
            aria-label="$PATH capability"
          >
            <p>next movement</p>
            <strong>
              {nextMovement
                ? `${nextMovement} · ${remainingUnits} unit${remainingUnits === 1 ? "" : "s"} remaining`
                : "all units used"}
            </strong>
            <span>
              {nextMovement
                ? `Each unit can authorize one ${nextMovement} work mint.`
                : "This $PATH has no movement mint remaining."}
            </span>
            {nextMovement === "THOUGHT" ? (
              <a
                className="path-marketplace-detail__movement-action"
                href="/thought"
              >
                create a THOUGHT
              </a>
            ) : null}
          </section>

          <section
            className="path-marketplace-detail__market-panel"
            aria-label="Marketplace status"
          >
            <div>
              <span>sale status</span>
              <strong>not listed</strong>
            </div>
            <dl>
              <div>
                <dt>price</dt>
                <dd>—</dd>
              </div>
              <div>
                <dt>best offer</dt>
                <dd>—</dd>
              </div>
            </dl>
            <p>No secondary-market order book is connected to this local study.</p>
          </section>

          <a
            className="path-marketplace-detail__canonical-link"
            href={`/path/${item.tokenIdLabel}`}
          >
            view canonical $PATH ↗
          </a>
        </div>
      </section>

      <section className="path-marketplace-detail__facts">
        <article>
          <h2>about</h2>
          <p>{PATH_OVERVIEW}</p>
        </article>

        <article>
          <h2>properties</h2>
          <dl className="path-marketplace-detail__properties">
            <div>
              <dt>stage</dt>
              <dd>{stageValue(item)}</dd>
            </div>
            {MOVEMENTS.map((movement) => {
              const progress = movementProgress(item, movement);
              return (
                <div key={movement}>
                  <dt>{movement}</dt>
                  <dd>
                    {progress.total > 0
                      ? `${progress.used} / ${progress.total}`
                      : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="path-marketplace-detail__properties-note">
            {PATH_MOVEMENT_QUOTA_NOTE}
          </p>
        </article>

        <article>
          <h2>token details</h2>
          <dl className="path-marketplace-detail__token-details">
            <div>
              <dt>contract</dt>
              <dd>{shortAddress(pathNftAddress)}</dd>
            </div>
            <div>
              <dt>token ID</dt>
              <dd>{item.tokenIdLabel}</dd>
            </div>
            <div>
              <dt>chain</dt>
              <dd>Local Anvil · 31337</dd>
            </div>
            <div>
              <dt>standard</dt>
              <dd>ERC-721</dd>
            </div>
            <div>
              <dt>metadata</dt>
              <dd>live tokenURI()</dd>
            </div>
            <div>
              <dt>issued through</dt>
              <dd>
                <a href="/pulse">Pulse ↗</a>
              </dd>
            </div>
          </dl>
        </article>

        <article>
          <h2>activity</h2>
          <p>No marketplace activity is indexed in this local study.</p>
        </article>
      </section>
    </main>
  );
}

function PathMarketplaceCard({ item }: { item: PathTokenInventoryItem }) {
  const image = metadataImage(item);
  return (
    <article
      className="path-marketplace-card"
      aria-label={`${tokenName(item)} marketplace card`}
    >
      <a
        className="path-marketplace-card__link"
        href={`/lab/path-marketplace/${item.tokenIdLabel}`}
        aria-label={`View ${tokenName(item)}`}
      >
        <div className="path-marketplace-card__media">
          {image ? (
            <img src={image} alt={`${tokenName(item)} artwork`} />
          ) : (
            <span>artwork unavailable</span>
          )}
        </div>
        <div className="path-marketplace-card__body">
          <div className="path-marketplace-card__eyebrow">
            <span>$PATH</span>
            <span>{stageValue(item)}</span>
          </div>
          <h3>{tokenName(item)}</h3>
          <p className="path-marketplace-card__owner">
            owned by {shortAddress(item.owner)}
          </p>
          <dl className="path-marketplace-card__traits">
            {MOVEMENTS.map((movement) => {
              const progress = movementProgress(item, movement);
              return (
                <div key={movement}>
                  <dt>{movement}</dt>
                  <dd>
                    {progress.total > 0
                      ? `${progress.used} / ${progress.total}`
                      : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="path-marketplace-card__market">
            <span>listing</span>
            <strong>not listed</strong>
          </div>
        </div>
      </a>
    </article>
  );
}

export default function PathMarketplaceLabPage({
  refreshSignal = 0,
  tokenId = null,
}: {
  refreshSignal?: number;
  tokenId?: string | null;
}) {
  const pathNftAddress = useMemo(() => maybeResolveAddress("path_nft"), []);
  const fromBlock = useMemo(() => getProtocolReleaseDeployBlock("path_nft"), []);
  const [retryNonce, setRetryNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [movementFilter, setMovementFilter] = useState<MovementFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [state, setState] = useState<LoadState>({
    status: "loading",
    items: [],
    error: null,
  });

  useEffect(() => {
    if (!pathNftAddress || fromBlock == null) {
      setState({
        status: "error",
        items: [],
        error: "$PATH deployment is not configured for this build.",
      });
      return;
    }
    let cancelled = false;
    setState((current) => ({
      status: "loading",
      items: current.items,
      error: null,
    }));
    loadAllPathTokens({
      pathNftAddress,
      fromBlock,
      cacheMode: refreshSignal > 0 || retryNonce > 0 ? "bypass" : "default",
    })
      .then((items) => {
        if (!cancelled) {
          setState({ status: "ready", items, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            items: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fromBlock, pathNftAddress, refreshSignal, retryNonce]);

  const stages = useMemo(
    () =>
      Array.from(new Set(state.items.map(stageValue)))
        .filter((stage) => stage !== "unavailable")
        .sort((a, b) => a.localeCompare(b)),
    [state.items],
  );

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return state.items
      .filter((item) => {
        if (stageFilter !== "all" && stageValue(item) !== stageFilter) {
          return false;
        }
        if (
          movementFilter !== "all" &&
          !isMovementAvailable(item, movementFilter)
        ) {
          return false;
        }
        if (!normalizedSearch) return true;
        return [tokenName(item), item.tokenIdLabel, item.owner ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      })
      .sort((a, b) =>
        sortOrder === "newest"
          ? Number(b.tokenId - a.tokenId)
          : Number(a.tokenId - b.tokenId),
      );
  }, [movementFilter, search, sortOrder, stageFilter, state.items]);

  const collectionStats = useMemo(() => {
    const owners = new Set(
      state.items.map((item) => item.owner?.toLowerCase()).filter(Boolean),
    ).size;
    const movements = state.items.flatMap((item) =>
      MOVEMENTS.map((movement) => movementProgress(item, movement)),
    );
    return {
      owners,
      used: movements.reduce((total, progress) => total + progress.used, 0),
      capacity: movements.reduce((total, progress) => total + progress.total, 0),
    };
  }, [state.items]);

  const contractLabel = shortAddress(pathNftAddress);

  if (tokenId) {
    const item = state.items.find((candidate) => candidate.tokenIdLabel === tokenId);
    if (state.status === "error") {
      return (
        <main className="path-marketplace path-marketplace-detail">
          <nav className="path-marketplace-detail__breadcrumb" aria-label="Breadcrumb">
            <a href="/lab/path-marketplace">← $PATH collection</a>
          </nav>
          <div className="path-marketplace__notice" role="alert">
            <strong>item unavailable</strong>
            <span>{state.error}</span>
            <button type="button" onClick={() => setRetryNonce((value) => value + 1)}>
              retry
            </button>
          </div>
        </main>
      );
    }
    if (state.status === "loading") {
      return (
        <main className="path-marketplace path-marketplace-detail">
          <nav className="path-marketplace-detail__breadcrumb" aria-label="Breadcrumb">
            <a href="/lab/path-marketplace">← $PATH collection</a>
          </nav>
          <div className="path-marketplace__notice" aria-live="polite">
            <strong>reading {`$PATH #${tokenId}`}…</strong>
            <span>Loading ownership and metadata from Local Anvil.</span>
          </div>
        </main>
      );
    }
    if (!item) {
      return (
        <main className="path-marketplace path-marketplace-detail">
          <nav className="path-marketplace-detail__breadcrumb" aria-label="Breadcrumb">
            <a href="/lab/path-marketplace">← $PATH collection</a>
          </nav>
          <div className="path-marketplace__notice">
            <strong>{`$PATH #${tokenId} not found`}</strong>
            <span>This token is not minted on the active Local Anvil chain.</span>
          </div>
        </main>
      );
    }
    return (
      <PathMarketplaceDetail item={item} pathNftAddress={pathNftAddress} />
    );
  }

  return (
    <main className="path-marketplace" aria-labelledby="path-marketplace-title">
      <section className="path-marketplace__hero">
        <div className="path-marketplace__banner" aria-hidden="true" />
        <div className="path-marketplace__identity">
          <div className="path-marketplace__avatar" aria-hidden="true">
            $P
          </div>
          <p className="path-marketplace__lab-label">
            marketplace collection study · Local Anvil
          </p>
          <div className="path-marketplace__title-row">
            <h1 id="path-marketplace-title">$PATH</h1>
            <span>Pulse mint only</span>
          </div>
          <p className="path-marketplace__contract">
            PathNFT {contractLabel} · chain 31337
          </p>
          <p className="path-marketplace__description">
            Permission tokens for Inshell movement mints. Each card exposes the
            movement capacity a marketplace can read from token metadata.
          </p>
          <dl className="path-marketplace__stats">
            <div>
              <dt>items</dt>
              <dd>{state.items.length}</dd>
            </div>
            <div>
              <dt>owners</dt>
              <dd>{collectionStats.owners}</dd>
            </div>
            <div>
              <dt>units used</dt>
              <dd>
                {collectionStats.used} / {collectionStats.capacity}
              </dd>
            </div>
            <div title="No secondary-market order book is indexed in this lab.">
              <dt>floor</dt>
              <dd>—</dd>
            </div>
            <div title="$PATH is minted through Pulse; this lab has no sales index.">
              <dt>volume</dt>
              <dd>—</dd>
            </div>
          </dl>
        </div>
      </section>

      <nav className="path-marketplace__tabs" aria-label="$PATH marketplace views">
        <button type="button" aria-current="page">items</button>
        <button type="button" disabled>activity</button>
      </nav>

      <section className="path-marketplace__inventory" aria-label="$PATH marketplace inventory">
        <div className="path-marketplace__toolbar">
          <label className="path-marketplace__search">
            <input
              type="search"
              aria-label="Search $PATH tokens"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="search by token or owner"
            />
          </label>
          <label>
            <span>sort</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            >
              <option value="newest">recently minted</option>
              <option value="oldest">oldest</option>
            </select>
          </label>
        </div>

        <div className="path-marketplace__collection-layout">
          <aside className="path-marketplace__filters" aria-label="Filter $PATH tokens">
            <div className="path-marketplace__filter-heading">
              <h2>filters</h2>
              <button
                type="button"
                onClick={() => {
                  setStageFilter("all");
                  setMovementFilter("all");
                  setSearch("");
                }}
              >
                clear
              </button>
            </div>
            <label>
              <span>stage</span>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="all">all stages</option>
                {stages.map((stage) => (
                  <option value={stage} key={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>unit available</legend>
              <label>
                <input
                  type="radio"
                  name="movement-filter"
                  checked={movementFilter === "all"}
                  onChange={() => setMovementFilter("all")}
                />
                any movement
              </label>
              {MOVEMENTS.map((movement) => (
                <label key={movement}>
                  <input
                    type="radio"
                    name="movement-filter"
                    checked={movementFilter === movement}
                    onChange={() => setMovementFilter(movement)}
                  />
                  {movement}
                </label>
              ))}
            </fieldset>
            <p>
              Marketplace traits are metadata facts. Ownership and lifecycle
              remain chain-first.
            </p>
          </aside>

          <div className="path-marketplace__results">
            <div className="path-marketplace__result-count">
              {state.status === "loading"
                ? "reading Local Anvil…"
                : `${visibleItems.length} item${visibleItems.length === 1 ? "" : "s"}`}
            </div>
            {state.status === "error" ? (
              <div className="path-marketplace__notice" role="alert">
                <strong>collection unavailable</strong>
                <span>{state.error}</span>
                <button type="button" onClick={() => setRetryNonce((value) => value + 1)}>
                  retry
                </button>
              </div>
            ) : state.status === "ready" && visibleItems.length === 0 ? (
              <div className="path-marketplace__notice">
                <strong>{state.items.length === 0 ? "no $PATH minted yet" : "no matching items"}</strong>
                <span>
                  {state.items.length === 0
                    ? "Mint on /path, then refresh this collection study."
                    : "Clear or change the current filters."}
                </span>
              </div>
            ) : (
              <div className="path-marketplace__grid">
                {visibleItems.map((item) => (
                  <PathMarketplaceCard key={item.tokenIdLabel} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
