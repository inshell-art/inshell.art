import {
  PUBLIC_SITE_METADATA,
  absolutePublicAssetUrl,
  getProtocolRelease,
  getRecommendedThoughtSpec,
  getThoughtRelease,
  maybeResolveAddress,
} from "@inshell/contracts";
import {
  SURFACE_TERMINOLOGY,
  buildContractStatusSections,
  type ContractStatusRow,
  type ContractStatusSection,
} from "@inshell/shared";
import { COLOR_FONT } from "@/content/colorFont";

function VerifyRow(props: ContractStatusRow) {
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

function VerifySection(props: ContractStatusSection) {
  return (
    <section className="verify-page__section" aria-labelledby={`verify-${props.id}`}>
      <h2 id={`verify-${props.id}`}>{props.title}</h2>
      <dl className="primitive-page__fields verify-page__fields">
        {props.rows.map((row) => (
          <VerifyRow key={row.id} {...row} />
        ))}
      </dl>
    </section>
  );
}

export default function VerifyPage() {
  const pathRelease = getProtocolRelease();
  const thoughtRelease = getThoughtRelease();
  const recommendedSpec = getRecommendedThoughtSpec();
  const chainId = thoughtRelease?.chain_id ?? pathRelease?.chain_id;
  const pathNft = maybeResolveAddress("path_nft");
  const thoughtNft = maybeResolveAddress("thought_nft");
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const colorFontV1 = maybeResolveAddress("color_font_v1");
  const contractStatusSections = buildContractStatusSections({
    chainId,
    pathNft,
    thoughtNft,
    pulseAuction,
    colorFontV1,
    thoughtSpecName: recommendedSpec?.name,
    thoughtSpecId: recommendedSpec?.id,
    thoughtSpecHash: recommendedSpec?.hash,
    colorFontHash: COLOR_FONT.hash,
  });

  return (
    <main className="primitive-page verify-page" aria-labelledby="verify-title">
      <header className="primitive-page__header verify-page__header">
        <div>
          <h1 id="verify-title" className="primitive-page__title">
            verify
          </h1>
          <p className="primitive-page__subtitle">
            Official {SURFACE_TERMINOLOGY.ecosystem} dapp and wallet surfaces.
          </p>
        </div>
      </header>

      <section className="primitive-page__body verify-page__body inshell-contract-status">
        <div className="primitive-page__copy">
          <p>
            Use this page to compare domain, chain, and contracts before
            connecting or confirming a wallet action.
          </p>
        </div>

        <section className="verify-page__section" aria-labelledby="verify-wallet-warnings">
          <h2 id="verify-wallet-warnings">wallet warnings</h2>
          <p>
            New dapp domains may show low-reputation warnings in some wallets.
            This page does not bypass those warnings. It gives the public facts
            needed to verify the connection.
          </p>
        </section>

        {contractStatusSections.map((section) => (
          <VerifySection key={section.id} {...section} />
        ))}

        <p>
          Funds or tokens move only after wallet transaction confirmation.
        </p>

        <section className="verify-page__section" aria-labelledby="verify-metadata">
          <h2 id="verify-metadata">metadata</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow id="path-title" label="$PATH title" value={PUBLIC_SITE_METADATA.home.title} />
            <VerifyRow
              id="path-icon"
              label="$PATH icon"
              value={absolutePublicAssetUrl("home", PUBLIC_SITE_METADATA.home.iconPath)}
            />
            <VerifyRow id="thought-title" label="THOUGHT title" value={PUBLIC_SITE_METADATA.thought.title} />
            <VerifyRow
              id="thought-icon"
              label="THOUGHT icon"
              value={absolutePublicAssetUrl("thought", PUBLIC_SITE_METADATA.thought.iconPath)}
            />
          </dl>
        </section>
      </section>
    </main>
  );
}
