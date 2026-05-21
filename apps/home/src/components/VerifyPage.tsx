import {
  OFFICIAL_DOMAINS,
  PUBLIC_SITE_METADATA,
  absolutePublicAssetUrl,
  getProtocolRelease,
  getRecommendedThoughtSpec,
  getThoughtRelease,
  maybeResolveAddress,
} from "@inshell/contracts";
import { COLOR_FONT } from "@/content/colorFont";

const NOT_LOADED = "not loaded";

function display(value: unknown): string {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number" && Number.isFinite(value)
    ? value.toString()
    : NOT_LOADED;
}

function chainName(chainId: number | undefined) {
  if (chainId === 11155111) return "Sepolia";
  if (chainId === 31337 || chainId === 31338) return "Local Devnet";
  return chainId ? `Chain ${chainId}` : NOT_LOADED;
}

function VerifyRow(props: { label: string; value: string; href?: string }) {
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

export default function VerifyPage() {
  const pathRelease = getProtocolRelease();
  const thoughtRelease = getThoughtRelease();
  const recommendedSpec = getRecommendedThoughtSpec();
  const chainId = thoughtRelease?.chain_id ?? pathRelease?.chain_id;
  const pathNft = maybeResolveAddress("path_nft");
  const thoughtNft = maybeResolveAddress("thought_nft");
  const pulseAuction = maybeResolveAddress("pulse_auction");
  const colorFontV1 = maybeResolveAddress("color_font_v1");
  const colorFontAuthority = colorFontV1
    ? `ColorFontV1 ${colorFontV1}`
    : thoughtNft
    ? `ThoughtNFT ${thoughtNft}`
    : NOT_LOADED;

  return (
    <main className="primitive-page verify-page" aria-labelledby="verify-title">
      <header className="primitive-page__header verify-page__header">
        <div>
          <h1 id="verify-title" className="primitive-page__title">
            verify
          </h1>
          <p className="primitive-page__subtitle">
            Official Inshell wallet surfaces.
          </p>
        </div>
      </header>

      <section className="primitive-page__body verify-page__body">
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

        <section className="verify-page__section" aria-labelledby="verify-domains">
          <h2 id="verify-domains">official domains</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow label="home" value={OFFICIAL_DOMAINS.home} href={OFFICIAL_DOMAINS.home} />
            <VerifyRow
              label="THOUGHT"
              value={OFFICIAL_DOMAINS.thought}
              href={OFFICIAL_DOMAINS.thought}
            />
          </dl>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-chain">
          <h2 id="verify-chain">current launch chain</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow label="chain" value={chainName(chainId)} />
            <VerifyRow label="chain id" value={display(chainId)} />
          </dl>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-contracts">
          <h2 id="verify-contracts">contracts</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow label="PathNFT" value={display(pathNft)} />
            <VerifyRow label="ThoughtNFT" value={display(thoughtNft)} />
            <VerifyRow label="PulseAuction" value={display(pulseAuction)} />
          </dl>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-spec">
          <h2 id="verify-spec">THOUGHT spec</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow label="recommended spec" value={display(recommendedSpec?.name)} />
            <VerifyRow label="spec id" value={display(recommendedSpec?.id)} />
            <VerifyRow label="spec hash" value={display(recommendedSpec?.hash)} />
          </dl>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-color-font">
          <h2 id="verify-color-font">color font</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow label="authority" value={colorFontAuthority} />
            <VerifyRow
              label="loaded from"
              value={colorFontV1 ? "ColorFontV1.data()" : thoughtNft ? "ThoughtNFT.colorFontData()" : NOT_LOADED}
            />
            <VerifyRow label="hash" value={display(COLOR_FONT.hash)} />
          </dl>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-actions">
          <h2 id="verify-actions">wallet actions</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow
              label="connect wallet"
              value="reads selected address and public ownership state."
            />
            <VerifyRow label="switch network" value="asks wallet to switch to Sepolia." />
            <VerifyRow
              label="mint PATH"
              value="submits a wallet-confirmed transaction for the Pulse auction."
            />
            <VerifyRow
              label="mint THOUGHT"
              value="submits a wallet-confirmed transaction using a selected PATH permission."
            />
          </dl>
          <p>
            Funds or tokens move only after wallet transaction confirmation.
          </p>
        </section>

        <section className="verify-page__section" aria-labelledby="verify-metadata">
          <h2 id="verify-metadata">metadata</h2>
          <dl className="primitive-page__fields verify-page__fields">
            <VerifyRow label="home title" value={PUBLIC_SITE_METADATA.home.title} />
            <VerifyRow
              label="home icon"
              value={absolutePublicAssetUrl("home", PUBLIC_SITE_METADATA.home.iconPath)}
            />
            <VerifyRow label="THOUGHT title" value={PUBLIC_SITE_METADATA.thought.title} />
            <VerifyRow
              label="THOUGHT icon"
              value={absolutePublicAssetUrl("thought", PUBLIC_SITE_METADATA.thought.iconPath)}
            />
          </dl>
        </section>
      </section>
    </main>
  );
}
