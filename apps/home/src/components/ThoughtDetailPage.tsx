import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  loadThoughtGalleryItem,
  type ThoughtGalleryItem,
} from "@/services/thoughtGallery";
import { resolveThoughtSpecHref } from "@/services/thoughtSpecLink";
import { isLocalRuntimeHost, resolveInshellLinks } from "@inshell/inshell-shell";
import { PUBLIC_NETWORK_CONFIG } from "@inshell/shared";

type LoadState =
  | { status: "loading"; item: null; error: null }
  | { status: "ready"; item: ThoughtGalleryItem | null; error: null }
  | { status: "error"; item: null; error: string };

type DetailNetwork = {
  environment: string;
  chain: string;
  chainId: number;
  currency: string;
  contract: string;
};

type TokenAttribute = {
  trait_type: string;
  value: string | number;
  display_type?: string;
};

type TokenMetadata = {
  attributes: TokenAttribute[];
  creationAttestation: string | null;
};

type ProvenanceMaterial = {
  schema: string | null;
  processKind: string | null;
  agentSource: string | null;
  modelSource: string | null;
  modelIdentifier: string | null;
  adapter: string | null;
  provider: string | null;
  route: string | null;
  runIdHash: string | null;
  resultEnvelopeHash: string | null;
  protocolReleaseId: string | null;
  manifestHash: string | null;
};

const ZERO_HASH = `0x${"0".repeat(64)}`;

function getEnvValue(name: string): unknown {
  const runtimeEnv: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, unknown> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env as
    | Record<string, unknown>
    | undefined;
  return runtimeEnv?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function configuredUrl(name: string) {
  const value = getEnvValue(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/") ? trimmed : null;
}

function thoughtAppUrl(): string {
  if (
    typeof window !== "undefined" &&
    isLocalRuntimeHost(window.location.hostname)
  ) {
    return resolveInshellLinks().thought;
  }
  const configured = configuredUrl("VITE_THOUGHT_URL");
  if (configured) return configured;
  return resolveInshellLinks().thought;
}

function freshThoughtAppUrl(): string {
  const configured = thoughtAppUrl();
  const url = new URL(configured, "https://inshell.invalid");
  url.searchParams.set("new", "1");
  return configured.startsWith("/")
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
}

function shortValue(value?: string, head = 6, tail = 4): string {
  if (!value) return "-";
  const trimmed = value.trim();
  if (trimmed.length <= head + tail + 3) return trimmed;
  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}

function formatTimestamp(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return "-";
  return new Date(seconds * 1000)
    .toISOString()
    .replace(".000Z", "Z")
    .replace("T", " ")
    .replace("Z", " UTC");
}

function formatProvenanceJson(value: string): string {
  if (!value) return "{}";
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseInt(value, value.trim().startsWith("0x") ? 16 : 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function detailNetwork(): DetailNetwork {
  const isDevnet =
    String(getEnvValue("VITE_NETWORK") ?? "").trim().toLowerCase() === "devnet";
  if (isDevnet) {
    return {
      environment: "Local Anvil",
      chain: "Local Devnet",
      chainId: parseChainId(getEnvValue("VITE_EXPECTED_CHAIN_ID")) ?? 31337,
      currency: "local ETH",
      contract: String(
        getEnvValue("VITE_THOUGHT_NFT") ??
          getEnvValue("VITE_THOUGHT_NFT_ADDRESS") ??
          ""
      ),
    };
  }
  return {
    environment: PUBLIC_NETWORK_CONFIG.environmentLabel,
    chain: PUBLIC_NETWORK_CONFIG.chainLabel,
    chainId: PUBLIC_NETWORK_CONFIG.chainId,
    currency: PUBLIC_NETWORK_CONFIG.currencyLabel,
    contract: String(
      getEnvValue("VITE_THOUGHT_NFT") ??
        getEnvValue("VITE_THOUGHT_NFT_ADDRESS") ??
        ""
    ),
  };
}

function explorerTxUrl(txHash: string): string | null {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return null;
  const configured = configuredUrl("VITE_THOUGHT_EXPLORER_BASE_URL");
  const base =
    configured?.replace(/\/$/, "") ?? PUBLIC_NETWORK_CONFIG.explorerBaseUrl;
  return `${base}/tx/${txHash}`;
}

function rawJsonUrl(value: string): string {
  return `data:application/json;charset=utf-8,${encodeURIComponent(value)}`;
}

function provenanceHref(item: ThoughtGalleryItem): string {
  const isDevnet =
    String(getEnvValue("VITE_NETWORK") ?? "").trim().toLowerCase() === "devnet";
  return isDevnet
    ? rawJsonUrl(item.provenanceJson)
    : `/api/thought-provenance?id=${encodeURIComponent(String(item.tokenId))}`;
}

function safeTokenMetadataHref(value: string): string | null {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:application/json")
    ? trimmed
    : null;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseTokenMetadata(tokenUri: string): TokenMetadata {
  const empty: TokenMetadata = { attributes: [], creationAttestation: null };
  try {
    let json = tokenUri;
    if (tokenUri.startsWith("data:application/json")) {
      const separator = tokenUri.indexOf(",");
      if (separator < 0) return empty;
      const header = tokenUri.slice(0, separator);
      const encoded = tokenUri.slice(separator + 1);
      json = header.includes(";base64")
        ? globalThis.atob(encoded)
        : decodeURIComponent(encoded);
    } else if (!tokenUri.trim().startsWith("{")) {
      return empty;
    }
    const metadata = asObject(JSON.parse(json) as unknown);
    if (!metadata) return empty;
    const attributes = Array.isArray(metadata.attributes)
      ? metadata.attributes.flatMap((candidate): TokenAttribute[] => {
          const attribute = asObject(candidate);
          const traitType = optionalString(attribute?.trait_type);
          const value = attribute?.value;
          if (
            !traitType ||
            (typeof value !== "string" && typeof value !== "number")
          ) {
            return [];
          }
          const displayType = optionalString(attribute?.display_type);
          return [
            {
              trait_type: traitType,
              value,
              ...(displayType ? { display_type: displayType } : {}),
            },
          ];
        })
      : [];
    const trait = attributes.find(
      (attribute) => attribute.trait_type === "Creation Attestation"
    );
    return {
      attributes,
      creationAttestation:
        optionalString(trait?.value) ??
        optionalString(metadata.creationAttestation),
    };
  } catch {
    return empty;
  }
}

function parseProvenance(value: string): ProvenanceMaterial {
  const empty: ProvenanceMaterial = {
    schema: null,
    processKind: null,
    agentSource: null,
    modelSource: null,
    modelIdentifier: null,
    adapter: null,
    provider: null,
    route: null,
    runIdHash: null,
    resultEnvelopeHash: null,
    protocolReleaseId: null,
    manifestHash: null,
  };
  if (!value) return empty;
  try {
    const provenance = asObject(JSON.parse(value) as unknown);
    if (!provenance) return empty;
    const process = asObject(provenance.process);
    const agent = asObject(process?.agent);
    const model = asObject(process?.model);
    const run = asObject(process?.run);
    const protocol = asObject(provenance.protocol);
    return {
      schema: optionalString(provenance.schema),
      processKind: optionalString(process?.kind),
      agentSource: optionalString(agent?.source),
      modelSource: optionalString(model?.source),
      modelIdentifier: optionalString(model?.identifier),
      adapter: optionalString(run?.adapter),
      provider: optionalString(provenance.provider),
      route:
        optionalString(run?.route) ?? optionalString(provenance.route),
      runIdHash: optionalString(run?.referenceKeccak256),
      resultEnvelopeHash: optionalString(run?.resultEnvelopeKeccak256),
      protocolReleaseId: optionalString(protocol?.protocolReleaseId),
      manifestHash: optionalString(protocol?.manifestKeccak256),
    };
  } catch {
    return empty;
  }
}

function creationAttestation(
  item: ThoughtGalleryItem,
  metadata: TokenMetadata
): string {
  const digest = item.creationAttestationDigest?.toLowerCase();
  if (digest === ZERO_HASH) return "Unattested";
  if (/^0x[0-9a-f]{64}$/.test(digest ?? "")) return "Inshell THOUGHT App";
  return metadata.creationAttestation ?? "Unavailable";
}

function processLabel(value: string | null, fallback: string): string {
  if (value === "agent-run") return "Agent run";
  if (value === "manual") return "Manual";
  return value || fallback || "Unavailable";
}

function creationIdentitySource(
  field: "agent" | "model",
  source: string | null
): string {
  if (field === "agent") {
    if (source === "minter-supplied") return "supplied by the minter";
    if (source === "producer-selected") return "selected by the producer";
    return "selected in the THOUGHT App";
  }
  if (source === "runtime-reported") {
    return "reported by the Agent runtime";
  }
  if (source === "minter-supplied") return "supplied by the minter";
  return "runtime source unavailable";
}

function canonicalTraitLabel(label: string): string {
  if (label === "Attested Agent") return "Agent";
  if (label === "Attested Model") return "Model";
  return label;
}

function traitValue(attribute: TokenAttribute): string {
  const value = String(attribute.value);
  return attribute.display_type ? `${value} · ${attribute.display_type}` : value;
}

function ThoughtSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="thought-detail__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DetailFields({ children }: { children: ReactNode }) {
  return <dl className="thought-detail__fields">{children}</dl>;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ThoughtDetail({ item }: { item: ThoughtGalleryItem }) {
  const network = detailNetwork();
  const txUrl = explorerTxUrl(item.txHash);
  const specHref = resolveThoughtSpecHref(item);
  const metadata = parseTokenMetadata(item.tokenUri);
  const provenance = parseProvenance(item.provenanceJson);
  const attestation = creationAttestation(item, metadata);
  const isAttested = attestation === "Inshell THOUGHT App";
  const provenanceBytes = byteLength(item.provenanceJson);
  const specName = item.thoughtSpecName?.trim() || "THOUGHT specification";
  const displayedAgent =
    item.agent?.trim() ||
    item.declaredAgent?.trim() ||
    item.attestedAgent?.trim() ||
    "-";
  const displayedModel =
    item.model?.trim() ||
    item.declaredModel?.trim() ||
    item.attestedModel?.trim() ||
    "-";
  const canonicalTraits = metadata.attributes;
  const tokenMetadataHref = safeTokenMetadataHref(item.tokenUri);

  return (
    <>
      <div className="thought-detail__body">
        <div className="thought-detail__canvas-column">
          {item.image ? (
            <img
              className="thought-detail__image"
              src={item.image}
              alt={`THOUGHT #${item.tokenId} canvas`}
            />
          ) : (
            <div className="thought-detail__missing">artwork unavailable</div>
          )}
          <p className="thought-detail__artwork-source">
            canonical artwork · ThoughtNFT.svgOf({item.tokenId})
          </p>
        </div>

        <aside
          className="thought-detail__rail"
          aria-label={`THOUGHT #${item.tokenId} record`}
        >
          <ThoughtSection title="work">
            <div className="thought-detail__dialogue">
              <div>
                <p className="thought-detail__dialogue-role">prompt</p>
                <p id="thought-detail-prompt" className="thought-detail__text">
                  {item.prompt || "prompt unavailable."}
                </p>
              </div>
              <div>
                <p className="thought-detail__dialogue-role">Agent</p>
                <p id="thought-detail-agent-line" className="thought-detail__text">
                  {item.returnedText || item.rawText || "Agent line unavailable."}
                </p>
              </div>
            </div>
          </ThoughtSection>

          <ThoughtSection title="creation provenance">
            <p className="thought-detail__attestation-summary">
              <span
                className="thought-detail__attestation"
                data-attestation={attestation.toLowerCase().replace(/ /g, "-")}
              >
                {attestation}
              </span>
              <span>
                {isAttested
                  ? "The THOUGHT Contract verified this Inshell THOUGHT App Creation Attestation and its bound creation record."
                  : "Contract-valid THOUGHT without an Inshell THOUGHT App Creation Attestation."}
              </span>
              <a
                className="thought-detail__value-link"
                href="/docs#thought-creation-provenance"
              >
                how this record is made ↗
              </a>
            </p>
            <DetailFields>
              <DetailField label="process">
                {processLabel(provenance.processKind, item.mode)}
              </DetailField>
              <DetailField label="Agent">
                {displayedAgent}
                <span className="thought-detail__assurance">
                  {creationIdentitySource("agent", provenance.agentSource)}
                </span>
              </DetailField>
              <DetailField label="Model">
                {displayedModel}
                <span className="thought-detail__assurance">
                  {creationIdentitySource("model", provenance.modelSource)}
                </span>
              </DetailField>
              {provenance.modelIdentifier && (
                <DetailField label="model identifier">
                  {provenance.modelIdentifier}
                </DetailField>
              )}
              {provenance.adapter && (
                <DetailField label="adapter">{provenance.adapter}</DetailField>
              )}
              {provenance.provider && (
                <DetailField label="provider">{provenance.provider}</DetailField>
              )}
              {provenance.route && (
                <DetailField label="route">{provenance.route}</DetailField>
              )}
              {provenance.runIdHash && (
                <DetailField label="run reference">
                  <span title={provenance.runIdHash}>
                    {shortValue(provenance.runIdHash, 12, 10)}
                  </span>
                </DetailField>
              )}
              <DetailField label="$PATH">
                <a
                  id="thought-detail-path"
                  className="thought-detail__value-link"
                  href={`/path/${item.pathId}`}
                  title={`Open $PATH #${item.pathId} detail`}
                >
                  $PATH #{item.pathId} ↗
                </a>
                {item.pathSerial && (
                  <span className="thought-detail__assurance">
                    PATH serial {item.pathSerial}
                  </span>
                )}
              </DetailField>
              <DetailField label="spec">
                {specHref ? (
                  <a
                    id="thought-detail-spec-ref"
                    className="thought-detail__value-link"
                    href={specHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {specName} ↗
                  </a>
                ) : (
                  specName
                )}
              </DetailField>
            </DetailFields>
          </ThoughtSection>
        </aside>
      </div>

      <div className="thought-detail__support">
        <ThoughtSection title="canonical traits">
          {canonicalTraits.length > 0 ? (
            <DetailFields>
              {canonicalTraits.map((attribute, index) => (
                <DetailField
                  key={`${attribute.trait_type}-${index}`}
                  label={canonicalTraitLabel(attribute.trait_type)}
                >
                  {traitValue(attribute)}
                </DetailField>
              ))}
            </DetailFields>
          ) : (
            <p className="thought-detail__empty">metadata traits unavailable.</p>
          )}
        </ThoughtSection>

        <ThoughtSection title="on-chain record">
          <DetailFields>
            <DetailField label="token">THOUGHT #{item.tokenId}</DetailField>
            <DetailField label="author">
              <span id="thought-detail-minter" title={item.minter}>
                {shortValue(item.minter, 12, 8)}
              </span>
            </DetailField>
            {item.currentOwner &&
              item.currentOwner.toLowerCase() !== item.minter.toLowerCase() && (
                <DetailField label="owner">
                  <span title={item.currentOwner}>
                    {shortValue(item.currentOwner, 12, 8)}
                  </span>
                </DetailField>
              )}
            <DetailField label="network">{network.environment}</DetailField>
            <DetailField label="chain">
              {network.chain} · {network.chainId}
            </DetailField>
            <DetailField label="currency">{network.currency}</DetailField>
            {network.contract && (
              <DetailField label="contract">
                <span title={network.contract}>
                  {shortValue(network.contract, 12, 8)}
                </span>
              </DetailField>
            )}
            <DetailField label="minted">
              {formatTimestamp(item.mintedAt)}
            </DetailField>
            {item.blockNumber > 0 && (
              <DetailField label="block">{item.blockNumber}</DetailField>
            )}
            {txUrl && (
              <DetailField label="tx">
                <a
                  id="thought-detail-view-tx"
                  className="thought-detail__value-link"
                  href={txUrl}
                  title={item.txHash}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {shortValue(item.txHash, 14, 10)} ↗
                </a>
              </DetailField>
            )}
          </DetailFields>
        </ThoughtSection>
      </div>

      <details className="thought-detail__record thought-detail__verification">
        <summary>verify / raw data</summary>
        <div className="thought-detail__record-body">
          <div className="thought-detail__verification-grid">
            <div>
              <h3>contract commitments</h3>
              <DetailFields>
                <DetailField label="provenance hash">
                  <span title={item.provenanceHash}>
                    {shortValue(item.provenanceHash, 12, 10)}
                  </span>
                </DetailField>
                <DetailField label="prompt hash">
                  <span title={item.promptHash}>
                    {shortValue(item.promptHash, 12, 10)}
                  </span>
                </DetailField>
                <DetailField label="Agent line hash">
                  <span title={item.returnedTextHash || item.textHash}>
                    {shortValue(item.returnedTextHash || item.textHash, 12, 10)}
                  </span>
                </DetailField>
                {item.conversationIdentityHash && (
                  <DetailField label="dialogue hash">
                    <span title={item.conversationIdentityHash}>
                      {shortValue(item.conversationIdentityHash, 12, 10)}
                    </span>
                  </DetailField>
                )}
                {item.workHash && (
                  <DetailField label="work hash">
                    <span title={item.workHash}>
                      {shortValue(item.workHash, 12, 10)}
                    </span>
                  </DetailField>
                )}
                {item.creationAttestationDigest && (
                  <DetailField label="attestation digest">
                    <span title={item.creationAttestationDigest}>
                      {shortValue(item.creationAttestationDigest, 12, 10)}
                    </span>
                  </DetailField>
                )}
              </DetailFields>
            </div>
            <div>
              <h3>release binding</h3>
              <DetailFields>
                <DetailField label="spec ID">
                  <span title={item.thoughtSpecId}>
                    {shortValue(item.thoughtSpecId, 12, 10)}
                  </span>
                </DetailField>
                <DetailField label="spec hash">
                  <span title={item.thoughtSpecHash}>
                    {shortValue(item.thoughtSpecHash, 12, 10)}
                  </span>
                </DetailField>
                {provenance.protocolReleaseId && (
                  <DetailField label="protocol release">
                    <span title={provenance.protocolReleaseId}>
                      {shortValue(provenance.protocolReleaseId, 12, 10)}
                    </span>
                  </DetailField>
                )}
                {provenance.manifestHash && (
                  <DetailField label="manifest hash">
                    <span title={provenance.manifestHash}>
                      {shortValue(provenance.manifestHash, 12, 10)}
                    </span>
                  </DetailField>
                )}
                {provenance.schema && (
                  <DetailField label="schema">{provenance.schema}</DetailField>
                )}
                {provenance.resultEnvelopeHash && (
                  <DetailField label="result envelope hash">
                    <span title={provenance.resultEnvelopeHash}>
                      {shortValue(provenance.resultEnvelopeHash, 12, 10)}
                    </span>
                  </DetailField>
                )}
              </DetailFields>
            </div>
          </div>
          <div className="thought-detail__raw-heading">
            <h3>provenance · {provenanceBytes} bytes</h3>
            <pre className="thought-detail__json">
              {formatProvenanceJson(item.provenanceJson)}
            </pre>
          </div>
          <nav className="thought-detail__raw-links" aria-label="Raw THOUGHT data">
            <a
              className="thought-detail__value-link"
              href={provenanceHref(item)}
              target="_blank"
              rel="noopener noreferrer"
            >
              open raw provenance ↗
            </a>
            {tokenMetadataHref && (
              <a
                className="thought-detail__value-link"
                href={tokenMetadataHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                open token metadata ↗
              </a>
            )}
          </nav>
        </div>
      </details>
    </>
  );
}

export default function ThoughtDetailPage({ tokenId }: { tokenId: string }) {
  const targetTokenId = useMemo(() => Number(tokenId), [tokenId]);
  const [state, setState] = useState<LoadState>({
    status: "loading",
    item: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", item: null, error: null });
    void loadThoughtGalleryItem(targetTokenId)
      .then((item) => {
        if (!cancelled) {
          setState({ status: "ready", item, error: null });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          item: null,
          error:
            error instanceof Error && error.message.trim()
              ? error.message
              : "THOUGHT record unavailable.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [targetTokenId]);

  return (
    <main
      className="thought-detail thought-detail-page"
      aria-labelledby="thought-detail-title"
    >
      <header className="thought-detail__header">
        <h1 id="thought-detail-title" className="thought-detail__title">
          THOUGHT #<span>{tokenId}</span>
        </h1>
        <nav className="thought-detail__links" aria-label="THOUGHT detail links">
          <a
            className="thought-detail__link"
            href={`/#thought-${tokenId}`}
          >
            [ home ]
          </a>
          <a className="thought-detail__link" href={freshThoughtAppUrl()}>
            [ create yours ]
          </a>
        </nav>
      </header>

      {state.status === "error" ? (
        <p className="thought-detail__status thought-detail__status--error">
          {state.error}
        </p>
      ) : state.status === "loading" ? (
        <p className="thought-detail__status">
          reading THOUGHT #{tokenId} from chain...
        </p>
      ) : state.item ? (
        <ThoughtDetail item={state.item} />
      ) : (
        <p className="thought-detail__status">THOUGHT #{tokenId} not found.</p>
      )}
    </main>
  );
}
