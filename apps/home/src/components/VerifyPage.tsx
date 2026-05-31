import {
  PUBLIC_SITE_METADATA,
  absolutePublicAssetUrl,
  getProtocolRelease,
  getRecommendedThoughtSpec,
  getThoughtRelease,
  maybeResolveAddress,
} from "@inshell/contracts";
import { SURFACE_TERMINOLOGY } from "@inshell/shared";

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

function resolveExplorerAddressUrl(address: string) {
  return `https://sepolia.etherscan.io/address/${address}`;
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

function ContractTable(props: { contracts: VerifyContractRow[] }) {
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
            {contract.address !== "unavailable" ? (
              <a
                href={resolveExplorerAddressUrl(contract.address)}
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

export default function VerifyPage() {
  const pathRelease = getProtocolRelease();
  const thoughtRelease = getThoughtRelease();
  const recommendedSpec = getRecommendedThoughtSpec();
  const chainId = thoughtRelease?.chain_id ?? pathRelease?.chain_id ?? 11155111;
  const pathNft = maybeResolveAddress("path_nft") ?? "unavailable";
  const pathPulseAdapter = maybeResolveAddress("path_pulse_adapter") ?? "unavailable";
  const thoughtNft = maybeResolveAddress("thought_nft") ?? "unavailable";
  const thoughtSpecRegistry = maybeResolveAddress("thought_spec_registry") ?? "unavailable";
  const pulseAuction = maybeResolveAddress("pulse_auction") ?? "unavailable";
  const colorFontV1 = maybeResolveAddress("color_font_v1") ?? "unavailable";
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
        </div>

        <section className="verify-page__section" aria-labelledby="verify-domains">
          <h2 id="verify-domains">domains</h2>
          <VerifyFields
            rows={[
              { id: "path-domain", label: "$PATH", value: "https://inshell.art" },
              { id: "thought-domain", label: "THOUGHT", value: "https://thought.inshell.art" },
              { id: "chain", label: "chain", value: "Sepolia" },
              { id: "chain-id", label: "chain id", value: String(chainId) },
            ]}
          />
        </section>

        <section className="verify-page__section" aria-labelledby="verify-wallet-warnings">
          <h2 id="verify-wallet-warnings">wallet warnings</h2>
          <p>
            New dapp domains may show low-reputation warnings in some wallets.
            This page does not bypass those warnings. It gives the public facts
            needed to verify the connection.
          </p>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-contracts">
          <h2 id="verify-contracts">contracts</h2>
          <ContractTable contracts={contracts} />
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
