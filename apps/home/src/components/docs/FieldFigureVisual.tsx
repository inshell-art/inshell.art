import { Fragment, type ReactNode } from "react";

import type { DocsFigure } from "@/content/docs";

type FieldFigure = Extract<DocsFigure, { mode: "field" }>;
type FieldFigureItem = FieldFigure["items"][number];

export type FieldFigureVisualProps = {
  figure: FieldFigure;
};

const HORIZONTAL_RAIL = "─".repeat(256);
const VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");
const PRACTICE_RELATION_ANNOTATION =
  "Approaches without claiming possession";

function FigureTitle({ children }: { children: string }) {
  return children.split(/(?<=[a-z])(?=[A-Z])/).map((part, index) => (
    <Fragment key={`${part}:${index}`}>
      {index > 0 ? <wbr /> : null}
      {part}
    </Fragment>
  ));
}

function Glyph({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={`docs-figure__glyph${className ? ` ${className}` : ""}`}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {children}
    </span>
  );
}

function ItemCopy({
  item,
  eyebrow,
  className = "",
}: {
  item: FieldFigureItem;
  eyebrow?: string;
  className?: string;
}) {
  return (
    <span
      className={`docs-figure__copy${className ? ` ${className}` : ""}`}
    >
      {eyebrow ? <span className="docs-figure__eyebrow">{eyebrow}</span> : null}
      <strong className="docs-figure__term">
        <FigureTitle>{item.title}</FigureTitle>
      </strong>
      {item.detail ? (
        <small className="docs-figure__annotation">{item.detail}</small>
      ) : null}
    </span>
  );
}

function StaticTerm({ children }: { children: string }) {
  return <strong className="docs-figure__term">{children}</strong>;
}

function CharacterBox({
  heading,
  children,
  className = "",
  junction = false,
}: {
  heading: ReactNode;
  children?: ReactNode;
  className?: string;
  junction?: boolean;
}) {
  return (
    <div
      className={`docs-figure__character-frame${className ? ` ${className}` : ""}`}
    >
      <div className="docs-figure__frame-cap">
        <Glyph className="docs-figure__frame-character">┌──</Glyph>
        <span className="docs-figure__frame-heading">{heading}</span>
        <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
        <Glyph className="docs-figure__frame-character">┐</Glyph>
      </div>
      {children ? (
        <div className="docs-figure__frame-body">
          <Glyph className="docs-figure__frame-wall">{VERTICAL_RAIL}</Glyph>
          <div className="docs-figure__frame-content">{children}</div>
          <Glyph className="docs-figure__frame-wall">{VERTICAL_RAIL}</Glyph>
        </div>
      ) : null}
      <div
        className={`docs-figure__frame-foot${
          junction ? " docs-figure__frame-foot--junction" : ""
        }`}
      >
        <Glyph className="docs-figure__frame-character">└</Glyph>
        <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
        {junction ? (
          <>
            <Glyph className="docs-figure__frame-character">┬</Glyph>
            <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
          </>
        ) : null}
        <Glyph className="docs-figure__frame-character">┘</Glyph>
      </div>
    </div>
  );
}

function FlowConnector({ direction = "down" }: { direction?: "down" | "up" }) {
  return (
    <span
      className="docs-figure__field-connector"
      role="img"
      aria-label={direction === "down" ? "then" : "leads upward to"}
    >
      <Glyph>{direction === "down" ? "│\n↓" : "↑\n│"}</Glyph>
    </span>
  );
}

function BranchFallback({ figure }: { figure: FieldFigure }) {
  return (
    <ul
      className="docs-figure__field docs-figure__field-shape"
      data-figure-shape="field-branches"
    >
      {figure.items.map((item, index) => (
        <li key={`${item.title}:${item.detail ?? ""}`}>
          <Glyph className="docs-figure__branch">
            {index === 0 ? "┌─" : index === figure.items.length - 1 ? "└─" : "├─"}
          </Glyph>
          <ItemCopy item={item} />
        </li>
      ))}
    </ul>
  );
}

function InwardDirection({ figure }: { figure: FieldFigure }) {
  const [shell, inward] = figure.items;
  if (!shell || !inward?.detail) {
    return <BranchFallback figure={figure} />;
  }

  const destinationWords = inward.detail
    .trim()
    .replace(/[.!?]+$/, "")
    .split(/\s+/);
  const destination = destinationWords.pop();
  const destinationLead = destinationWords.join(" ");

  if (!destination) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div className="docs-figure__field-shape" data-figure-shape="box-tail">
      <CharacterBox heading={<StaticTerm>{shell.title}</StaticTerm>} junction>
        {shell.detail ? (
          <small className="docs-figure__annotation">{shell.detail}</small>
        ) : null}
      </CharacterBox>
      <div className="docs-figure__field-tail">
        <span className="docs-figure__field-relation">
          <Glyph>│</Glyph>
          <strong className="docs-figure__term docs-figure__field-relation-label">
            {inward.title}
          </strong>
        </span>
        <Glyph label="leads inward to">↓</Glyph>
        <span className="docs-figure__copy docs-figure__field-destination-copy">
          {destinationLead ? (
            <small className="docs-figure__annotation">
              {destinationLead}{" "}
            </small>
          ) : null}
          <strong className="docs-figure__term">{destination}</strong>
        </span>
      </div>
    </div>
  );
}

function PracticeChain({ figure }: { figure: FieldFigure }) {
  const [truth, practice] = figure.items;
  if (!truth || !practice) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div className="docs-figure__field-shape" data-figure-shape="boxed-chain">
      <CharacterBox heading={<StaticTerm>TRUTH AND PRACTICE</StaticTerm>}>
        <div className="docs-figure__field-chain docs-figure__field-chain--up">
          <ItemCopy item={truth} />
          <span className="docs-figure__field-practice-relation">
            <Glyph label="practice approaches truth">↑</Glyph>
            <small className="docs-figure__annotation">
              {PRACTICE_RELATION_ANNOTATION}
            </small>
          </span>
          <ItemCopy item={practice} />
        </div>
      </CharacterBox>
    </div>
  );
}

function SegmentDivider({ children }: { children: ReactNode }) {
  return (
    <div className="docs-figure__field-divider">
      <Glyph className="docs-figure__frame-character">├─</Glyph>
      {children}
      <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
      <Glyph className="docs-figure__frame-character">┤</Glyph>
    </div>
  );
}

function AgentArtField({ figure }: { figure: FieldFigure }) {
  const [invariant, artQuestion, agentQuestion] = figure.items;
  if (!invariant || !artQuestion || !agentQuestion) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div className="docs-figure__field-shape" data-figure-shape="segmented-box">
      <CharacterBox heading={<StaticTerm>AGENT ART</StaticTerm>}>
        <div className="docs-figure__field-segment">
          <ItemCopy item={invariant} />
        </div>
        <SegmentDivider>
          <span className="docs-figure__eyebrow">OPEN QUESTIONS</span>
        </SegmentDivider>
        <div className="docs-figure__field-segment docs-figure__field-questions">
          <ItemCopy item={artQuestion} />
          <ItemCopy item={agentQuestion} />
        </div>
      </CharacterBox>
    </div>
  );
}

function PromptResponseField({ figure }: { figure: FieldFigure }) {
  const [prompt, response, thought] = figure.items;
  if (!prompt || !response || !thought) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-prompt-response"
      data-figure-shape="prompt-response"
    >
      <div className="docs-figure__field-prompt-pair">
        <ItemCopy item={prompt} />
        <Glyph label="plus">+</Glyph>
        <ItemCopy item={response} />
      </div>
      <Glyph className="docs-figure__field-prompt-arrow" label="forms">
        ↓
      </Glyph>
      <ItemCopy item={thought} className="docs-figure__field-prompt-result" />
    </div>
  );
}

function AttestationFlow({ figure }: { figure: FieldFigure }) {
  const [recorded, claim, validation, attested, unattested] = figure.items;
  if (!recorded || !claim || !validation || !attested || !unattested) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="attestation-flow-fork"
    >
      <div className="docs-figure__field-chain">
        <ItemCopy item={recorded} />
        <FlowConnector />
        <ItemCopy item={claim} />
        <FlowConnector />
        <ItemCopy item={validation} />
      </div>
      <div className="docs-figure__field-fork">
        <Glyph className="docs-figure__field-fork-stem">
          {VERTICAL_RAIL}
        </Glyph>
        <div className="docs-figure__field-fork-branch">
          <span className="docs-figure__field-fork-branch-rail">
            <Glyph>├─</Glyph>
            <Glyph className="docs-figure__field-fork-continuation">
              {VERTICAL_RAIL}
            </Glyph>
          </span>
          <span className="docs-figure__copy">
            <span className="docs-figure__field-fork-proof">
              <span className="docs-figure__eyebrow">VALID PROOF</span>
              <Glyph label="leads to">→</Glyph>
            </span>
            <strong className="docs-figure__term">
              <FigureTitle>{attested.title}</FigureTitle>
            </strong>
            {attested.detail ? (
              <small className="docs-figure__annotation">
                {attested.detail}
              </small>
            ) : null}
          </span>
        </div>
        <div className="docs-figure__field-fork-branch">
          <span className="docs-figure__field-fork-branch-rail">
            <Glyph>└─</Glyph>
          </span>
          <span className="docs-figure__copy">
            <span className="docs-figure__field-fork-proof">
              <span className="docs-figure__eyebrow">EMPTY PROOF</span>
              <Glyph label="leads to">→</Glyph>
            </span>
            <strong className="docs-figure__term">
              <FigureTitle>{unattested.title}</FigureTitle>
            </strong>
            {unattested.detail ? (
              <small className="docs-figure__annotation">
                {unattested.detail}
              </small>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}

function WillField({ figure }: { figure: FieldFigure }) {
  const [people, agents, will] = figure.items;
  if (!people || !agents || !will) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="will-convergence-box"
    >
      <CharacterBox heading={<StaticTerm>WILL</StaticTerm>}>
        <div className="docs-figure__field-convergence">
          <ItemCopy item={people} />
          <ItemCopy item={agents} />
          <ItemCopy item={will} className="docs-figure__field-convergence-result" />
        </div>
      </CharacterBox>
    </div>
  );
}

function AwaField({ figure }: { figure: FieldFigure }) {
  return (
    <div className="docs-figure__field-shape" data-figure-shape="awa-arc-box">
      <CharacterBox heading={<StaticTerm>AWA</StaticTerm>}>
        <ol className="docs-figure__field-arc">
          {figure.items.map((stage, index) => (
            <li key={`${stage.title}:${stage.detail ?? ""}`}>
              <ItemCopy item={stage} />
              {index < figure.items.length - 1 ? (
                <Glyph label="then">→</Glyph>
              ) : null}
            </li>
          ))}
        </ol>
      </CharacterBox>
    </div>
  );
}

function EvidenceInterpretation({ figure }: { figure: FieldFigure }) {
  const interpretation = figure.items.at(-1);
  const evidence = figure.items.slice(0, -1);
  if (!interpretation || evidence.length === 0) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-evidence"
      data-figure-shape="evidence-interpretation"
    >
      <div className="docs-figure__field-evidence-tree">
        <StaticTerm>EVIDENCE</StaticTerm>
        <ul className="docs-figure__field-evidence-list">
          {evidence.map((item, index) => (
            <li key={`${item.title}:${item.detail ?? ""}`}>
              <Glyph>{index === evidence.length - 1 ? "└─" : "├─"}</Glyph>
              <ItemCopy item={item} />
            </li>
          ))}
        </ul>
      </div>
      <div className="docs-figure__field-evidence-tail">
        <Glyph label="becomes">{"│\n↓"}</Glyph>
        <ItemCopy item={interpretation} />
      </div>
    </div>
  );
}

function DistinctionsField({ figure }: { figure: FieldFigure }) {
  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="distinctions-box"
    >
      <CharacterBox heading={<StaticTerm>WALLET AND LOCAL DATA</StaticTerm>}>
        <div className="docs-figure__field-box-list">
          {figure.items.map((item) => (
            <ItemCopy
              item={item}
              key={`${item.title}:${item.detail ?? ""}`}
            />
          ))}
        </div>
      </CharacterBox>
    </div>
  );
}

function DistinctRecordsField({ figure }: { figure: FieldFigure }) {
  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="distinct-records-box"
    >
      <CharacterBox heading={<StaticTerm>FOUR DISTINCT RECORDS</StaticTerm>}>
        <div className="docs-figure__field-records">
          {figure.items.map((item, index) => (
            <span
              className="docs-figure__field-record"
              key={`${item.title}:${item.detail ?? ""}`}
            >
              {index > 0 ? <Glyph label="is distinct from">≠</Glyph> : null}
              <ItemCopy item={item} />
            </span>
          ))}
        </div>
      </CharacterBox>
    </div>
  );
}

function PrincipleBoxes({ figure }: { figure: FieldFigure }) {
  return (
    <div
      className="docs-figure__field-shape docs-figure__field-stack"
      data-figure-shape="stacked-principle-boxes"
    >
      {figure.items.map((item) => (
        <CharacterBox
          heading={
            <strong className="docs-figure__term">
              <FigureTitle>{item.title}</FigureTitle>
            </strong>
          }
          key={`${item.title}:${item.detail ?? ""}`}
        >
          {item.detail ? (
            <small className="docs-figure__annotation">{item.detail}</small>
          ) : null}
        </CharacterBox>
      ))}
    </div>
  );
}

function CanonicalSourceFlow({ figure }: { figure: FieldFigure }) {
  const [work, surfaces] = figure.items;
  if (!work || !surfaces) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="canonical-source-flow"
    >
      <CharacterBox
        heading={<StaticTerm>{work.title}</StaticTerm>}
        junction
      >
        {work.detail ? (
          <small className="docs-figure__annotation">{work.detail}</small>
        ) : null}
      </CharacterBox>
      <div className="docs-figure__field-tail">
        <Glyph label="appears through">↓</Glyph>
        <ItemCopy item={surfaces} />
      </div>
    </div>
  );
}

export function FieldFigureVisual({ figure }: FieldFigureVisualProps) {
  switch (figure.label) {
    case "The inward direction":
      return <InwardDirection figure={figure} />;
    case "How practice relates to truth":
      return <PracticeChain figure={figure} />;
    case "The invariant and the open field":
      return <AgentArtField figure={figure} />;
    case "One prompt, one response":
      return <PromptResponseField figure={figure} />;
    case "Creation Attestation":
      return <AttestationFlow figure={figure} />;
    case "Many people. Many Agents. One will.":
      return <WillField figure={figure} />;
    case "Toward the core":
      return <AwaField figure={figure} />;
    case "Evidence becomes interpretation":
      return <EvidenceInterpretation figure={figure} />;
    case "Two distinctions":
      return <DistinctionsField figure={figure} />;
    case "Four distinct records":
      return <DistinctRecordsField figure={figure} />;
    case "Current Inshell principles across systems":
      return <PrincipleBoxes figure={figure} />;
    case "Many surfaces, one identified record":
      return <CanonicalSourceFlow figure={figure} />;
    default:
      return <BranchFallback figure={figure} />;
  }
}
