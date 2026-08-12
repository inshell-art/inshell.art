export default function WillPage() {
  return (
    <main className="will-page" aria-labelledby="will-page-title">
      <header className="will-page__identity">
        <div className="will-page__title-line">
          <h1 id="will-page-title" className="will-page__title">
            WILL
          </h1>
          <span className="will-page__launch-note">launch in 2027</span>
        </div>
        <p className="will-page__slogan">many people. many Agents. one will.</p>
      </header>
      <div
        className="will-page__dot-field"
        aria-hidden="true"
        data-dot-layout="even"
      />
    </main>
  );
}
