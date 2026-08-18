import { useEffect, useMemo, useState } from "react";
import {
  PUBLIC_SITE_METADATA,
  absolutePublicAssetUrl,
  getProtocolRelease,
  getRecommendedThoughtSpec,
  getThoughtRelease,
  maybeResolveAddress,
} from "@inshell/contracts";
import {
  PUBLIC_NETWORK_CONFIG,
  SURFACE_TERMINOLOGY,
  formatChainName,
} from "@inshell/shared";
import { formatEther } from "viem";
import {
  parsePathVerificationTarget,
  verifyPathRecord,
  type PathVerificationResult,
  type PathVerificationTarget,
} from "@/services/pathVerification";

type VerifyField = {
  id: string;
  label: string;
  value: string;
  href?: string;
};

type VerifyContractRow = {
  id: string;
  name: string;
  role: string;
  address: string;
  codeHash: string;
  status: string;
};

function shortValue(value: string) {
  if (!value || value === "unavailable") return value || "unavailable";
  if (!/^0x[a-fA-F0-9]+$/.test(value) || value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function resolveExplorerUrl(
  chainId: number,
  kind: "address" | "block" | "tx",
  value: string | number,
) {
  if (chainId !== PUBLIC_NETWORK_CONFIG.chainId) return null;
  return `${PUBLIC_NETWORK_CONFIG.explorerBaseUrl}/${kind}/${value}`;
}

function VerifyRow(props: VerifyField) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>
        {props.href ? (
          <a href={props.href} target="_blank" rel="noopener noreferrer">
            {props.value}
          </a>
        ) : (
          props.value
        )}
      </dd>
    </div>
  );
}

function VerifyFields(props: { rows: VerifyField[] }) {
  return (
    <dl className="primitive-page__fields verify-page__fields">
      {props.rows.map((row) => (
        <VerifyRow key={row.id} {...row} />
      ))}
    </dl>
  );
}

function ContractTable(props: { chainId: number; contracts: VerifyContractRow[] }) {
  return (
    <div className="verify-page__contract-table" role="table" aria-label="Contracts">
      <div className="verify-page__contract-row verify-page__contract-row--head" role="row">
        <span role="columnheader">name</span>
        <span role="columnheader">role</span>
        <span role="columnheader">address</span>
        <span role="columnheader">code hash</span>
        <span role="columnheader">status</span>
        <span role="columnheader">explorer</span>
      </div>
      {props.contracts.map((contract) => (
        <div className="verify-page__contract-row" role="row" key={contract.id}>
          <span role="cell">{contract.name}</span>
          <span role="cell">{contract.role}</span>
          <span role="cell" title={contract.address}>
            {shortValue(contract.address)}
          </span>
          <span role="cell" title={contract.codeHash}>
            {shortValue(contract.codeHash)}
          </span>
          <span role="cell">{contract.status}</span>
          <span role="cell">
            {contract.address !== "unavailable" &&
            resolveExplorerUrl(props.chainId, "address", contract.address) ? (
              <a
                href={resolveExplorerUrl(props.chainId, "address", contract.address) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
              >
                explorer ↗
              </a>
            ) : (
              "—"
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

type PathRecordVerifierState =
  | { status: "loading"; result: null; error: null }
  | { status: "ready"; result: PathVerificationResult; error: null }
  | { status: "error"; result: null; error: string };

function readPathVerificationTarget(): {
  target: PathVerificationTarget | null;
  error: string | null;
} {
  try {
    return {
      target: parsePathVerificationTarget(globalThis.location?.search ?? ""),
      error: null,
    };
  } catch (error) {
    return {
      target: null,
      error: String((error as Error)?.message ?? error),
    };
  }
}

function verificationValue(matches: boolean) {
  return matches ? "match" : "mismatch";
}

function PathRecordVerifier(props: {
  initialError: string | null;
  target: PathVerificationTarget | null;
}) {
  const [retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<PathRecordVerifierState>(() =>
    props.initialError
      ? { status: "error", result: null, error: props.initialError }
      : { status: "loading", result: null, error: null },
  );

  useEffect(() => {
    if (!props.target) return;
    let cancelled = false;
    setState({ status: "loading", result: null, error: null });
    verifyPathRecord(props.target)
      .then((result) => {
        if (!cancelled) setState({ status: "ready", result, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: "error",
            result: null,
            error: String((error as Error)?.message ?? error),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [props.target, retryNonce]);

  if (!props.target && !props.initialError) return null;
  const tokenId = props.target?.tokenId ?? "—";
  const result = state.result;
  const ownerHref = result
    ? resolveExplorerUrl(result.observedChainId, "address", result.owner)
    : null;
  const transactionHref = result?.target.transactionHash
    ? resolveExplorerUrl(
        result.observedChainId,
        "tx",
        result.target.transactionHash,
      )
    : null;
  const blockHref = result
    ? resolveExplorerUrl(result.observedChainId, "block", result.observedAtBlock)
    : null;

  return (
    <section
      className="verify-page__section verify-page__record"
      aria-labelledby="verify-path-record"
    >
      <h2 id="verify-path-record">verify $PATH #{tokenId}</h2>
      <p>
        The URL locates the record. This verifier reads the active chain and
        compares it with the PATH release pinned by this App build.
      </p>
      {state.status === "loading" ? (
        <p className="verify-page__record-status">reading chain...</p>
      ) : state.status === "error" ? (
        <div className="verify-page__record-error">
          <p title={state.error}>record verification unavailable.</p>
          <button type="button" onClick={() => setRetryNonce((value) => value + 1)}>
            retry
          </button>
        </div>
      ) : result ? (
        <>
          <p className="verify-page__record-status">
            {result.passed ? "verified" : "verification mismatch"} at block{" "}
            {blockHref ? (
              <a href={blockHref} target="_blank" rel="noopener noreferrer">
                {result.observedAtBlock} ↗
              </a>
            ) : (
              result.observedAtBlock
            )}
          </p>
          <VerifyFields
            rows={[
              {
                id: "path-record-chain",
                label: "chain",
                value: `${result.observedChainId} · ${verificationValue(
                  result.observedChainId === result.configuredChainId &&
                    result.target.chainId === result.configuredChainId,
                )}`,
              },
              {
                id: "path-record-contract",
                label: "contract",
                value: `${shortValue(result.target.contract)} · ${verificationValue(
                  result.contractMatches,
                )}`,
                href:
                  resolveExplorerUrl(
                    result.observedChainId,
                    "address",
                    result.target.contract,
                  ) ?? undefined,
              },
              {
                id: "path-record-code-hash",
                label: "runtime code",
                value: verificationValue(result.codeHashMatches),
              },
              {
                id: "path-record-token",
                label: "token ID",
                value: result.target.tokenId,
              },
              {
                id: "path-record-owner",
                label: "ownerOf()",
                value: shortValue(result.owner),
                href: ownerHref ?? undefined,
              },
              {
                id: "path-record-token-uri",
                label: "tokenURI()",
                value: "returned",
              },
              {
                id: "path-record-metadata-name",
                label: "metadata name",
                value: result.metadataName,
              },
              {
                id: "path-record-attributes",
                label: "attributes",
                value: String(result.metadataAttributeCount),
              },
              ...(result.transaction
                ? [
                    {
                      id: "path-record-transaction",
                      label: "mint transaction",
                      value: `${shortValue(result.target.transactionHash ?? "")} · ${
                        result.transaction.status
                      }`,
                      href: transactionHref ?? undefined,
                    },
                    {
                      id: "path-record-transfer",
                      label: "PathNFT.Transfer",
                      value: result.transaction.transferEvent,
                    },
                    {
                      id: "path-record-minter",
                      label: "initial minter",
                      value: result.transaction.from
                        ? shortValue(result.transaction.from)
                        : "unavailable",
                      href: result.transaction.from
                        ? resolveExplorerUrl(
                            result.observedChainId,
                            "address",
                            result.transaction.from,
                          ) ?? undefined
                        : undefined,
                    },
                    {
                      id: "path-record-value",
                      label: "mint value",
                      value: result.transaction.valueWei
                        ? `${formatEther(BigInt(result.transaction.valueWei))} ETH`
                        : "unavailable",
                    },
                  ]
                : []),
            ]}
          />
          <details className="verify-page__raw">
            <summary>raw evidence</summary>
            <dl>
              <div>
                <dt>expected code hash</dt>
                <dd>{result.expectedCodeHash ?? "unavailable"}</dd>
              </div>
              <div>
                <dt>observed code hash</dt>
                <dd>{result.actualCodeHash ?? "unavailable"}</dd>
              </div>
            </dl>
            <pre>{result.tokenUri}</pre>
          </details>
        </>
      ) : null}
      <a
        className="verify-page__record-back"
        href={props.target ? `/path/${tokenId}` : "/path"}
      >
        {props.target ? `back to $PATH #${tokenId}` : "back to all $PATH"}
      </a>
    </section>
  );
}

export default function VerifyPage() {
  const pathRelease = getProtocolRelease();
  const thoughtRelease = getThoughtRelease();
  const recommendedSpec = getRecommendedThoughtSpec();
  const chainId = thoughtRelease?.chain_id ?? pathRelease?.chain_id ?? 11155111;
  const isPublicNetwork = chainId === PUBLIC_NETWORK_CONFIG.chainId;
  const networkLabel = isPublicNetwork
    ? PUBLIC_NETWORK_CONFIG.environmentLabel
    : chainId === 31337 || chainId === 31338
      ? "Local Anvil"
      : formatChainName(chainId);
  const chainLabel = formatChainName(chainId);
  const currencyLabel = isPublicNetwork
    ? PUBLIC_NETWORK_CONFIG.currencyLabel
    : chainId === 31337 || chainId === 31338
      ? "local ETH"
      : "ETH";
  const networkExplanation = isPublicNetwork
    ? PUBLIC_NETWORK_CONFIG.verifyExplanation
    : "This build reads its configured local chain. Local contracts, balances, and tokens are disposable test records, not public-network records.";
  const pathNft = maybeResolveAddress("path_nft") ?? "unavailable";
  const pathPulseAdapter = maybeResolveAddress("path_pulse_adapter") ?? "unavailable";
  const thoughtNft = maybeResolveAddress("thought_nft") ?? "unavailable";
  const thoughtSpecRegistry = maybeResolveAddress("thought_spec_registry") ?? "unavailable";
  const pulseAuction = maybeResolveAddress("pulse_auction") ?? "unavailable";
  const colorFontV1 = maybeResolveAddress("color_font_v1") ?? "unavailable";
  const pathVerification = useMemo(readPathVerificationTarget, []);
  const contracts: VerifyContractRow[] = [
    {
      id: "pulse-auction",
      name: "PulseAuction",
      role: "auction / payment / curve",
      address: pulseAuction,
      codeHash: pathRelease?.code_hashes?.pulse_auction ?? "unavailable",
      status: "live",
    },
    {
      id: "path-pulse-adapter",
      name: "PathPulseAdapter",
      role: "settlement bridge",
      address: pathPulseAdapter,
      codeHash: pathRelease?.code_hashes?.path_pulse_adapter ?? "unavailable",
      status: "frozen",
    },
    {
      id: "path-nft",
      name: "PathNFT",
      role: "permission token",
      address: pathNft,
      codeHash: pathRelease?.code_hashes?.path_nft ?? "unavailable",
      status: "minter frozen",
    },
    {
      id: "thought-nft",
      name: "ThoughtNFT",
      role: "THOUGHT movement",
      address: thoughtNft,
      codeHash: thoughtRelease?.code_hashes?.thought_nft ?? "unavailable",
      status: "live",
    },
    {
      id: "spec-registry",
      name: "SpecRegistry",
      role: "THOUGHT spec archive",
      address: thoughtSpecRegistry,
      codeHash: thoughtRelease?.code_hashes?.thought_spec_registry ?? "unavailable",
      status: "live",
    },
    {
      id: "color-font",
      name: "ColorFont",
      role: "color-font renderer/data",
      address: colorFontV1,
      codeHash: thoughtRelease?.code_hashes?.color_font_v1 ?? "unavailable",
      status: "live",
    },
  ];

  return (
    <main className="primitive-page verify-page" aria-labelledby="verify-title">
      <header className="primitive-page__header verify-page__header">
        <div>
          <h1 id="verify-title" className="primitive-page__title">
            verify
          </h1>
          <p className="primitive-page__subtitle">
            Official {SURFACE_TERMINOLOGY.ecosystem} contracts and wallet surfaces.
          </p>
        </div>
      </header>

      <section className="primitive-page__body verify-page__body inshell-contract-status">
        <div className="primitive-page__copy">
          <p>
            Compare domain, chain, contracts, and locks before connecting or
            confirming a wallet action.
          </p>
          <p>{networkExplanation}</p>
        </div>

        {pathVerification.target || pathVerification.error ? (
          <PathRecordVerifier
            initialError={pathVerification.error}
            target={pathVerification.target}
          />
        ) : null}

        <section className="verify-page__section" aria-labelledby="verify-domains">
          <h2 id="verify-domains">domains</h2>
          <VerifyFields
            rows={[
              { id: "path-domain", label: "$PATH", value: "https://inshell.art" },
              { id: "path-route", label: "$PATH route", value: "https://inshell.art/path" },
              { id: "thought-domain", label: "THOUGHT", value: "https://inshell.art/thought" },
              { id: "gallery-domain", label: "gallery", value: "https://inshell.art/gallery" },
              { id: "network", label: "network", value: networkLabel },
              { id: "chain", label: "chain", value: chainLabel },
              { id: "chain-id", label: "chain id", value: String(chainId) },
              { id: "currency", label: "currency", value: currencyLabel },
            ]}
          />
        </section>

        <section className="verify-page__section" aria-labelledby="official-origins">
          <h2 id="official-origins">official origins</h2>
          <VerifyFields
            rows={[
              { id: "origin-main", label: "inshell.art", value: "main Inshell surface" },
              { id: "origin-path", label: "inshell.art/path", value: "PATH / Pulse surface" },
              { id: "origin-gallery", label: "inshell.art/gallery", value: "public gallery" },
              { id: "origin-verify", label: "inshell.art/verify", value: "verification room" },
              { id: "origin-thought", label: "inshell.art/thought", value: "THOUGHT movement app" },
              { id: "origin-preview", label: "preview.inshell.art", value: "preview / staging surface" },
            ]}
          />
          <p>
            Preview origin may change and is not the canonical public origin.
          </p>
        </section>

        <section className="verify-page__section" aria-labelledby="wallet-notes">
          <h2 id="wallet-notes">verification notes</h2>
          <div className="verify-page__notes">
            <article>
              <h3>Why can a wallet show low popularity or listed by none?</h3>
              <p>
                Wallets may warn on new, low-traffic, or preview domains. This
                is a domain reputation notice, not a contract-state result.
                Verify the official origin and deployed contracts on this page.
              </p>
            </article>
            <article>
              <h3>Does connecting wallet sign anything?</h3>
              <p>
                No. Connecting exposes the selected address to the site. It does
                not send ETH, sign a message, mint PATH, or approve tokens.
              </p>
            </article>
            <article>
              <h3>Does PATH mint require token approval?</h3>
              <p>
                No for the current native ETH PATH bid. It calls
                PulseAuction.bid(uint256 maxPrice) with ETH. It does not request
                ERC20 allowance.
              </p>
            </article>
            <article>
              <h3>What should I verify before signing a bid?</h3>
              <p>
                Network, contract, function, ETH sent, max price, and expected
                PATH token.
              </p>
            </article>
            <article>
              <h3>Where can I verify a mint after it happens?</h3>
              <p>
                Use the Inshell source page for the semantic event record and
                the explorer link for external chain verification.
              </p>
            </article>
          </div>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-contracts">
          <h2 id="verify-contracts">contracts</h2>
          <ContractTable chainId={chainId} contracts={contracts} />
        </section>

        <section className="verify-page__section" aria-labelledby="verify-locks">
          <h2 id="verify-locks">system locks</h2>
          <VerifyFields
            rows={[
              { id: "pulse-economics", label: "Pulse economics", value: "fixed" },
              { id: "pulse-admin", label: "Pulse admin", value: "none after launch" },
              { id: "adapter-wiring", label: "Adapter wiring", value: "frozen" },
              { id: "path-minter", label: "PATH public minter", value: "frozen" },
              { id: "thought-movement", label: "THOUGHT movement", value: "configured + frozen" },
              { id: "will-movement", label: "WILL movement", value: "unset" },
              { id: "awa-movement", label: "AWA movement", value: "unset" },
            ]}
          />
        </section>

        <section className="verify-page__section" aria-labelledby="verify-validation">
          <h2 id="verify-validation">validation</h2>
          <VerifyFields
            rows={[
              { id: "last-report", label: "Last report", value: "READY_WITH_WARNINGS" },
              { id: "critical-findings", label: "Critical findings", value: "0" },
              { id: "pass", label: "Pass", value: "68" },
              { id: "fail", label: "Fail", value: "0" },
              { id: "warn", label: "Warn", value: "4" },
              { id: "na", label: "N/A", value: "1" },
              { id: "report-md", label: "report.md", value: "not published" },
              { id: "report-json", label: "report.json", value: "not published" },
              { id: "onchain-reads", label: "onchain reads", value: "not published" },
            ]}
          />
          <p>
            Remaining warnings are release-evidence/tooling/frontend-depth items,
            not observed contract failures.
          </p>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-thought-spec">
          <h2 id="verify-thought-spec">THOUGHT spec registry</h2>
          <VerifyFields
            rows={[
              {
                id: "thought-spec-name",
                label: "spec",
                value: recommendedSpec?.name ?? "THOUGHT.v1.md",
              },
              {
                id: "thought-spec-id",
                label: "spec id",
                value: recommendedSpec?.id ?? "unavailable",
              },
              {
                id: "thought-spec-hash",
                label: "spec hash",
                value: recommendedSpec?.hash ?? "unavailable",
              },
              {
                id: "thought-spec-length",
                label: "byte length",
                value:
                  typeof recommendedSpec?.byteLength === "number"
                    ? String(recommendedSpec.byteLength)
                    : "unavailable",
              },
              { id: "thought-spec-registered", label: "registered", value: "yes" },
              { id: "thought-spec-validated", label: "validated", value: "yes" },
            ]}
          />
        </section>

        <p>
          Funds or tokens move only after wallet transaction confirmation.
        </p>

        <section className="verify-page__section" aria-labelledby="verify-metadata">
          <h2 id="verify-metadata">metadata</h2>
          <VerifyFields
            rows={[
              { id: "path-title", label: "$PATH title", value: PUBLIC_SITE_METADATA.home.title },
              {
                id: "path-icon",
                label: "$PATH icon",
                value: absolutePublicAssetUrl("home", PUBLIC_SITE_METADATA.home.iconPath),
              },
              { id: "thought-title", label: "THOUGHT title", value: PUBLIC_SITE_METADATA.thought.title },
              {
                id: "thought-icon",
                label: "THOUGHT icon",
                value: absolutePublicAssetUrl("thought", PUBLIC_SITE_METADATA.thought.iconPath),
              },
            ]}
          />
        </section>
      </section>
    </main>
  );
}
