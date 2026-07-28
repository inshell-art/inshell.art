export default function WillPage() {
  return (
    <main className="will-page" aria-labelledby="will-page-title">
      <header className="will-page__identity">
        <h1 id="will-page-title" className="will-page__title">
          WILL
        </h1>
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
