export default function DocsPage() {
  return (
    <main className="primitive-page docs-page" aria-labelledby="docs-title">
      <header className="primitive-page__header">
        <div>
          <h1 id="docs-title" className="primitive-page__title">
            docs
          </h1>
          <p className="primitive-page__subtitle">
            Inshell protocol and product notes.
          </p>
        </div>
      </header>

      <section className="primitive-page__body verify-page__body">
        <section className="verify-page__section" aria-labelledby="docs-path">
          <h2 id="docs-path">$PATH</h2>
          <div className="primitive-page__copy">
            <p>$PATH is the permission token for movement mints.</p>
            <p>$PATH is minted by the Pulse auction on the active network.</p>
            <p>
              Each $PATH authorizes movement mints in order: THOUGHT, WILL,
              then AWA.
            </p>
            <p>
              A movement minted from $PATH consumes a movement unit and updates
              the $PATH lifecycle.
            </p>
            <p>
              The stage trait shows the current movement phase. Movement units
              show used / total capacity for THOUGHT, WILL, and AWA.
            </p>
            <p>The token image and traits show movement progress.</p>
          </div>
          <nav className="primitive-page__links" aria-label="$PATH documentation links">
            <a href="/pulse">view $PATH pricing rule ↗</a>
            <a href="/verify#verify-contracts">verify $PATH contracts ↗</a>
          </nav>
        </section>

        <section className="verify-page__section" aria-labelledby="docs-verification">
          <h2 id="docs-verification">verification</h2>
          <div className="primitive-page__copy">
            <p>
              Review official origins, wallet guidance, deployed contracts,
              system locks, and the active THOUGHT specification.
            </p>
          </div>
          <nav className="primitive-page__links" aria-label="Verification documentation links">
            <a href="/verify">open verification ↗</a>
          </nav>
        </section>
      </section>
    </main>
  );
}
