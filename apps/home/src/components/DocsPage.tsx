import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DOCS_SOURCE,
  agentDocsPrompt,
  type DocsFigure,
  type DocsParagraph,
} from "@/content/docs";
import { docsFigureLogic } from "@/content/docs-figure-logic";
import { PulseCurrentInstance } from "@/components/PulsePage";
import { FieldFigureVisual } from "@/components/docs/FieldFigureVisual";
import {
  LedgerFigureVisual,
  TraceFigureVisual,
} from "@/components/docs/FlowFigureVisual";
import { LaneFigureVisual } from "@/components/docs/LaneFigureVisual";

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Continue to the browser fallback.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

function currentOrigin() {
  if (typeof window === "undefined") return "https://inshell.art";
  return window.location.origin;
}

function renderDocsParagraph(paragraph: DocsParagraph) {
  if (typeof paragraph === "string") return paragraph;

  return paragraph.map((part, index) =>
    typeof part === "string" ? (
      <Fragment key={`text:${index}`}>{part}</Fragment>
    ) : (
      <a
        key={`${part.href}:${part.label}:${index}`}
        className="docs-page__inline-link"
        href={part.href}
      >
        {part.label}
      </a>
    ),
  );
}

function FigureVisual({ figure }: { figure: DocsFigure }) {
  if (figure.mode === "trace") return <TraceFigureVisual figure={figure} />;
  if (figure.mode === "ledger") return <LedgerFigureVisual figure={figure} />;
  if (figure.mode === "lanes") return <LaneFigureVisual figure={figure} />;
  return <FieldFigureVisual figure={figure} />;
}

function DocsCharacterFigure({
  figure,
  captionId,
}: {
  figure: DocsFigure;
  captionId: string;
}) {
  const logic = docsFigureLogic(figure);

  return (
    <figure
      className={`docs-figure docs-figure--${figure.mode}`}
      aria-labelledby={captionId}
      data-figure-form={logic.form}
      data-figure-id={logic.id}
      data-figure-logic={JSON.stringify(logic)}
      data-figure-mode={figure.mode}
    >
      <figcaption id={captionId}>{figure.label}</figcaption>
      <div className="docs-figure__visual">
        <FigureVisual figure={figure} />
      </div>
    </figure>
  );
}

type DocsPageProps = {
  topicSlug?: string | null;
};

export default function DocsPage({ topicSlug = null }: DocsPageProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const copyStatusTimer = useRef<number | null>(null);
  const prompt = useMemo(() => agentDocsPrompt(currentOrigin()), []);
  const topicsBySlug = useMemo(
    () => new Map(DOCS_SOURCE.topics.map((topic) => [topic.slug, topic])),
    [],
  );
  const groups = useMemo(
    () =>
      DOCS_SOURCE.groups.map((group) => ({
        ...group,
        topics: group.topicSlugs
          .map((slug) => topicsBySlug.get(slug))
          .filter((topic) => topic !== undefined),
      })),
    [topicsBySlug],
  );
  const selectedTopic = topicSlug
    ? topicsBySlug.get(topicSlug)
    : DOCS_SOURCE.topics[0];
  useEffect(
    () => () => {
      if (copyStatusTimer.current !== null) {
        window.clearTimeout(copyStatusTimer.current);
      }
    },
    [],
  );

  const flashCopyStatus = (status: "copied" | "failed") => {
    if (copyStatusTimer.current !== null) {
      window.clearTimeout(copyStatusTimer.current);
    }
    setCopyStatus(status);
    copyStatusTimer.current = window.setTimeout(() => {
      setCopyStatus("idle");
      copyStatusTimer.current = null;
    }, 1200);
  };

  const copyAgentPrompt = async () => {
    const copied = await copyText(prompt);
    flashCopyStatus(copied ? "copied" : "failed");
  };

  const copyLabel =
    copyStatus === "copied"
      ? "[ copied. ]"
      : copyStatus === "failed"
        ? "[ try again ]"
        : "[ copy prompt ]";

  return (
    <main className="primitive-page docs-page" aria-labelledby="docs-title">
      <header className="primitive-page__header docs-page__header">
        <div>
          <h1 id="docs-title" className="primitive-page__title">
            {DOCS_SOURCE.title}
          </h1>
          <p className="primitive-page__subtitle">{DOCS_SOURCE.subtitle}</p>
        </div>

        <section className="docs-agent" aria-label="Agent documentation prompt">
          <pre className="docs-agent__prompt">{prompt}</pre>
          <nav
            className="primitive-page__links docs-agent__links"
            aria-label="Agent documentation actions"
          >
            <button type="button" aria-live="polite" onClick={() => void copyAgentPrompt()}>
              {copyLabel}
            </button>
          </nav>
          <p className="docs-agent__scope-note">
            Your Agent can also read technical sources beyond the articles below.
          </p>
        </section>
      </header>

      <section className="docs-page__layout">
        <aside className="docs-page__sidebar" aria-label="Documentation menu">
          <nav className="docs-page__menu" aria-label="Documentation contents">
            {groups.map((group) => (
              <section
                key={group.id}
                className="docs-page__menu-group"
                aria-label={group.title}
              >
                <div>
                  {group.topics.map((topic) => (
                    <a
                      key={topic.id}
                      href={`/docs/${topic.slug}`}
                      aria-current={selectedTopic?.id === topic.id ? "page" : undefined}
                    >
                      {topic.title}
                    </a>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <article className="docs-page__content" aria-label="Documentation content">
          {selectedTopic ? [selectedTopic].map((topic) => (
            <section
              key={topic.id}
              className="verify-page__section docs-topic"
              aria-labelledby={topic.id}
            >
              {topic.aliases?.map((alias) => (
                <span
                  key={alias}
                  id={alias}
                  className="docs-page__anchor-alias"
                  aria-hidden="true"
                />
              ))}
              <header className="docs-topic__header">
                <div className="docs-topic__title-line">
                  <h2 id={topic.id}>{topic.title}</h2>
                  {topic.status === "current" ? null : (
                    <span className="docs-topic__status">{topic.status}</span>
                  )}
                </div>
                <p className="docs-topic__summary">{topic.summary}</p>
              </header>

              {topic.figure ? (
                <DocsCharacterFigure
                  figure={topic.figure}
                  captionId={`${topic.id}-figure-caption`}
                />
              ) : null}

              <div className="primitive-page__copy">
                {topic.paragraphs.map((paragraph, index) => (
                  <p key={`${topic.id}:lead:${index}`}>{renderDocsParagraph(paragraph)}</p>
                ))}
              </div>

              {topic.preformatted?.map((block) => (
                <pre
                  key={block.label}
                  className="primitive-page__formula pulse-page__math"
                  aria-label={block.label}
                >
                  {block.content}
                </pre>
              ))}
              {topic.id === "docs-pulse" ? <PulseCurrentInstance /> : null}

              {topic.sections?.map((section) => (
                <section
                  key={section.id}
                  className="docs-topic__section"
                  aria-labelledby={section.id}
                >
                  <h3 id={section.id}>{section.title}</h3>
                  {section.figure ? (
                    <DocsCharacterFigure
                      figure={section.figure}
                      captionId={`${section.id}-figure-caption`}
                    />
                  ) : null}
                  {section.paragraphs?.length ? (
                    <div className="primitive-page__copy">
                      {section.paragraphs.map((paragraph, index) => (
                        <p key={`${section.id}:paragraph:${index}`}>
                          {renderDocsParagraph(paragraph)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {section.points?.length ? (
                    <ul>
                      {section.points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  ) : null}
                  {section.steps?.length ? (
                    <ol>
                      {section.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  ) : null}
                  {section.note ? <blockquote>{section.note}</blockquote> : null}
                </section>
              ))}

              {topic.links?.length ? (
                <nav
                  className="primitive-page__links docs-topic__links"
                  aria-label={`${topic.title} documentation links`}
                >
                  {topic.links.map((link) => (
                    <a key={`${link.href}:${link.label}`} href={link.href}>
                      {link.label}
                    </a>
                  ))}
                  <a href={`/docs/${topic.slug}.md`}>read as Markdown ↗</a>
                </nav>
              ) : (
                <nav
                  className="primitive-page__links docs-topic__links"
                  aria-label={`${topic.title} machine-readable links`}
                >
                  <a href={`/docs/${topic.slug}.md`}>read as Markdown ↗</a>
                </nav>
              )}
            </section>
          )) : (
            <section className="verify-page__section docs-topic docs-topic--not-found">
              <header className="docs-topic__header">
                <h2>Article not found.</h2>
                <p className="docs-topic__summary">
                  This docs article does not exist.
                </p>
              </header>
              <nav
                className="primitive-page__links docs-topic__links"
                aria-label="Documentation recovery"
              >
                <a href="/docs">open docs ↗</a>
              </nav>
            </section>
          )}
        </article>

      </section>
    </main>
  );
}
