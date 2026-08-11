import type { DocsFigure } from "@/content/docs";

type TraceFigure = Extract<DocsFigure, { mode: "trace" }>;
type LedgerFigure = Extract<DocsFigure, { mode: "ledger" }>;

const MOVEMENTS_PATH_LABEL = "Why the movements form a PATH";
const PATH_CONSUME_LABEL = "How one movement unit is consumed";
const HORIZONTAL_RAIL = "─".repeat(256);
const VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");

function TraceConnector() {
  return (
    <span
      className="docs-figure__shape-trace-connector"
      aria-label="then"
      role="img"
    >
      <span className="docs-figure__shape-character" aria-hidden="true">
        {"│\n↓"}
      </span>
    </span>
  );
}

function TreeBranch({
  children,
  continues = true,
}: {
  children: string;
  continues?: boolean;
}) {
  return (
    <span className="docs-figure__shape-tree-branch" aria-hidden="true">
      {continues ? (
        <span className="docs-figure__shape-character docs-figure__shape-tree-rail">
          {VERTICAL_RAIL}
        </span>
      ) : null}
      <span className="docs-figure__shape-character">{children}</span>
    </span>
  );
}

function MovementsPreamble() {
  return (
    <div
      className="docs-figure__shape-preamble docs-figure__shape-preamble--tree"
    >
      <strong className="docs-figure__shape-heading">INSHELL PRACTICE</strong>
      <div className="docs-figure__shape-tree">
        <div className="docs-figure__shape-tree-row">
          <TreeBranch>├─</TreeBranch>
          <span className="docs-figure__shape-label">DIRECTION:</span>
          <strong className="docs-figure__term">INSPECT SELF</strong>
        </div>
        <div className="docs-figure__shape-tree-row">
          <TreeBranch>├─</TreeBranch>
          <span className="docs-figure__shape-label">MEDIUM:</span>
          <strong className="docs-figure__term">AGENT ART</strong>
        </div>
        <div className="docs-figure__shape-tree-row docs-figure__shape-tree-row--nested">
          <TreeBranch>{"│  └─"}</TreeBranch>
          <span className="docs-figure__shape-label">INVARIANT:</span>
          <strong className="docs-figure__term">AN AGENT PARTICIPATES</strong>
        </div>
        <div className="docs-figure__shape-tree-row">
          <TreeBranch continues={false}>└─</TreeBranch>
          <span className="docs-figure__shape-label">PATH:</span>
          <strong className="docs-figure__term">INDIVIDUAL → CROWD → CORE</strong>
        </div>
      </div>
    </div>
  );
}

function TracePreamble({ figure }: { figure: TraceFigure }) {
  if (figure.label === MOVEMENTS_PATH_LABEL) {
    return (
      <>
        <MovementsPreamble />
        <TraceConnector />
      </>
    );
  }

  if (figure.label === PATH_CONSUME_LABEL) {
    return (
      <p className="docs-figure__shape-kicker">
        <strong className="docs-figure__term">
          ONE SUCCESSFUL MOVEMENT MINT CONSUMES 1 UNIT
        </strong>
      </p>
    );
  }

  return null;
}

export function TraceFigureVisual({ figure }: { figure: TraceFigure }) {
  return (
    <div className="docs-figure__shape-trace">
      <TracePreamble figure={figure} />
      <ol className="docs-figure__shape-trace-list">
        {figure.items.map((item, index) => {
          const isLast = index === figure.items.length - 1;
          const marker = String(index + 1).padStart(2, "0");

          return (
            <li
              className="docs-figure__shape-trace-item"
              key={`${item.title}:${item.detail}`}
            >
              <div className="docs-figure__shape-trace-step">
                <span className="docs-figure__marker">{marker}</span>
                <span className="docs-figure__copy">
                  <strong className="docs-figure__term">{item.title}</strong>
                  <small className="docs-figure__annotation">{item.detail}</small>
                </span>
              </div>
              {!isLast ? <TraceConnector /> : null}
              {isLast && figure.loop ? (
                <span
                  className="docs-figure__shape-loop"
                >
                  <span className="docs-figure__shape-character" aria-hidden="true">│</span>
                  <span className="docs-figure__shape-loop-return">
                    <span
                      className="docs-figure__shape-character"
                      aria-label={`repeat from stage ${figure.loop.to}`}
                      role="img"
                    >
                      └──↺
                    </span>
                    <span className="docs-figure__marker">
                      {String(figure.loop.to).padStart(2, "0")}
                    </span>
                    <small className="docs-figure__annotation">{figure.loop.condition}</small>
                  </span>
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
      headerDivider === -1 ? headerLine.trim() : headerLine.slice(0, headerDivider).trim(),
    rightHeader:
      headerDivider === -1 ? "" : headerLine.slice(headerDivider + 1).trim(),
  };
}

function LedgerRail() {
  return (
    <span
      className="docs-figure__shape-ledger-divider"
      aria-hidden="true"
    >
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
      <div className="docs-figure__shape-ledger-row docs-figure__shape-ledger-header" role="row">
        <span role="columnheader">{leftHeader}</span>
        <LedgerRail />
        <span role="columnheader">{rightHeader}</span>
      </div>
      <LedgerRule />
      {figure.items.map((item, index) => (
        <div className="docs-figure__shape-ledger-entry" key={`${item.title}:${item.detail}`}>
          <div className="docs-figure__shape-ledger-row" role="row">
            <strong className="docs-figure__term" role="cell">{item.title}</strong>
            <LedgerRail />
            <small className="docs-figure__annotation" role="cell">{item.detail}</small>
          </div>
          {index < figure.items.length - 1 ? (
            <LedgerRule />
          ) : null}
        </div>
      ))}
    </div>
  );
}
