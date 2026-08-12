import type { DocsFigure } from "@/content/docs";

type TraceFigure = Extract<DocsFigure, { mode: "trace" }>;
type LedgerFigure = Extract<DocsFigure, { mode: "ledger" }>;

const HORIZONTAL_RAIL = "─".repeat(256);
const VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");

function TraceConnector({
  alignWithDetail = false,
  relation,
  stacked = false,
}: {
  alignWithDetail?: boolean;
  relation?: string;
  stacked?: boolean;
}) {
  return (
    <span
      className={`docs-figure__shape-trace-connector${
        stacked ? " docs-figure__shape-trace-connector--stacked" : ""
      }${
        alignWithDetail
          ? " docs-figure__shape-trace-connector--detail"
          : ""
      }`}
      aria-label={relation ? `${relation}, then` : "then"}
      role="img"
    >
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-connector-inline"
        aria-hidden="true"
      >
        →
      </span>
      <span
        className="docs-figure__shape-character docs-figure__shape-trace-connector-stacked"
        aria-hidden="true"
      >
        {"│\n↓"}
      </span>
      {relation !== undefined ? (
        <small className="docs-figure__annotation docs-figure__shape-trace-relation">
          {relation}
        </small>
      ) : null}
    </span>
  );
}

export function TraceFigureVisual({ figure }: { figure: TraceFigure }) {
  const isCycle = figure.loop !== undefined;
  const loopTarget = figure.loop
    ? figure.items[figure.loop.to - 1]?.title
    : undefined;

  return (
    <div
      className={`docs-figure__shape-trace docs-figure__shape-trace--${
        isCycle ? "cycle" : "sequence"
      }`}
      data-trace-layout={isCycle ? "cycle" : "sequence"}
    >
      <ol className="docs-figure__shape-trace-list">
        {figure.items.map((item, index) => {
          const isLast = index === figure.items.length - 1;

          return (
            <li
              className="docs-figure__shape-trace-item"
              key={`${index}:${item.title}`}
            >
              <span className="docs-figure__copy docs-figure__shape-trace-copy">
                <strong className="docs-figure__term">{item.title}</strong>
                {!isCycle && item.detail !== undefined ? (
                  <>
                    <span
                      className="docs-figure__shape-character docs-figure__shape-trace-item-rail"
                      aria-hidden="true"
                    >
                      │
                    </span>
                    <small className="docs-figure__annotation">{item.detail}</small>
                  </>
                ) : null}
              </span>
              {!isLast ? (
                <TraceConnector
                  alignWithDetail={!isCycle && item.detail !== undefined}
                  relation={isCycle ? item.detail : undefined}
                  stacked={isCycle}
                />
              ) : null}
              {isLast && figure.loop ? (
                <span
                  className="docs-figure__shape-loop-return"
                  aria-label={
                    loopTarget
                      ? `returns to ${loopTarget} for ${figure.loop.condition}`
                      : `returns for ${figure.loop.condition}`
                  }
                  role="img"
                >
                  <span className="docs-figure__shape-character" aria-hidden="true">
                    └──↺
                  </span>
                  <small className="docs-figure__annotation">
                    {figure.loop.condition}
                  </small>
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ledgerShape(figureText: string) {
  const [headerLine = ""] = figureText.split("\n");
  const headerDivider = headerLine.indexOf("│");

  return {
    leftHeader:
      headerDivider === -1
        ? headerLine.trim()
        : headerLine.slice(0, headerDivider).trim(),
    rightHeader:
      headerDivider === -1 ? "" : headerLine.slice(headerDivider + 1).trim(),
  };
}

function LedgerRail() {
  return (
    <span className="docs-figure__shape-ledger-divider" aria-hidden="true">
      <span className="docs-figure__shape-character docs-figure__shape-ledger-rail">
        {VERTICAL_RAIL}
      </span>
    </span>
  );
}

function LedgerRule() {
  return (
    <div className="docs-figure__shape-ledger-rule" aria-hidden="true">
      <span className="docs-figure__shape-ledger-rule-run">
        {HORIZONTAL_RAIL}
      </span>
      <span className="docs-figure__shape-character">┼</span>
      <span className="docs-figure__shape-ledger-rule-run">
        {HORIZONTAL_RAIL}
      </span>
    </div>
  );
}

export function LedgerFigureVisual({ figure }: { figure: LedgerFigure }) {
  const { leftHeader, rightHeader } = ledgerShape(figure.figureText);

  return (
    <div className="docs-figure__shape-ledger" role="table">
      <div
        className="docs-figure__shape-ledger-row docs-figure__shape-ledger-header"
        role="row"
      >
        <span
          className="docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--left"
          role="columnheader"
        >
          {leftHeader}
        </span>
        <LedgerRail />
        {rightHeader ? (
          <span
            className="docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--right"
            role="columnheader"
          >
            {rightHeader}
          </span>
        ) : null}
      </div>
      <LedgerRule />
      {figure.items.map((item, index) => (
        <div
          className="docs-figure__shape-ledger-entry"
          key={`${index}:${item.title}`}
        >
          <div className="docs-figure__shape-ledger-row" role="row">
            <strong
              className="docs-figure__term docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--left"
              role="cell"
            >
              {item.title}
            </strong>
            <LedgerRail />
            {item.detail !== undefined ? (
              <strong
                className="docs-figure__term docs-figure__shape-ledger-cell docs-figure__shape-ledger-cell--right"
                role="cell"
              >
                {item.detail}
              </strong>
            ) : null}
          </div>
          {index < figure.items.length - 1 ? <LedgerRule /> : null}
        </div>
      ))}
    </div>
  );
}
