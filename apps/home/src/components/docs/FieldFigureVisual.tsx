import { Fragment, type ReactNode } from "react";

import type { DocsFigure } from "@/content/docs";

type FieldFigure = Extract<DocsFigure, { mode: "field" }>;
type FieldFigureItem = FieldFigure["items"][number];

export type FieldFigureVisualProps = {
  figure: FieldFigure;
};

const HORIZONTAL_RAIL = "─".repeat(256);
const VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");

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
      <small className="docs-figure__annotation">{item.detail}</small>
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
  children: ReactNode;
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
      <div className="docs-figure__frame-body">
        <Glyph className="docs-figure__frame-wall">{VERTICAL_RAIL}</Glyph>
        <div className="docs-figure__frame-content">{children}</div>
        <Glyph className="docs-figure__frame-wall">{VERTICAL_RAIL}</Glyph>
      </div>
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
        <li key={`${item.title}:${item.detail}`}>
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
  const [shell, surface, boundary, inward] = figure.items;
  if (!shell || !surface || !boundary || !inward) {
    return <BranchFallback figure={figure} />;
  }

  const destinationBreak = inward.detail.lastIndexOf(" ");
  const destinationLead = inward.detail.slice(0, destinationBreak);
  const destination = inward.detail.slice(destinationBreak + 1);

  return (
    <div className="docs-figure__field-shape" data-figure-shape="box-tail">
      <CharacterBox heading={<StaticTerm>{shell.title}</StaticTerm>} junction>
        <small className="docs-figure__annotation">{shell.detail}</small>
        <ItemCopy item={surface} />
        <ItemCopy item={boundary} />
      </CharacterBox>
      <div className="docs-figure__field-tail">
        <span className="docs-figure__field-relation">
          <Glyph>{"│\n│\n│"}</Glyph>
          <strong className="docs-figure__term docs-figure__field-relation-label">
            {inward.title}
          </strong>
        </span>
        <Glyph label="leads inward to">{"│\n↓"}</Glyph>
        <small className="docs-figure__annotation docs-figure__field-destination-copy">
          {destinationLead}{" "}
          <strong className="docs-figure__term">{destination}</strong>
        </small>
      </div>
    </div>
  );
}

function PracticeChain({ figure }: { figure: FieldFigure }) {
  const [truth, relation, practice, boundary] = figure.items;
  if (!truth || !relation || !practice || !boundary) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div className="docs-figure__field-shape" data-figure-shape="boxed-chain">
      <CharacterBox heading={<StaticTerm>TRUTH AND PRACTICE</StaticTerm>}>
        <div className="docs-figure__field-chain docs-figure__field-chain--up">
          <ItemCopy item={truth} />
          <FlowConnector direction="up" />
          <ItemCopy item={relation} />
          <FlowConnector direction="up" />
          <ItemCopy item={practice} />
        </div>
        <ItemCopy item={boundary} className="docs-figure__field-boundary" />
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

function OrderedPair({ figure }: { figure: FieldFigure }) {
  const [pair, response, prompt, preservation] = figure.items;
  if (!pair || !response || !prompt || !preservation) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div className="docs-figure__field-shape" data-figure-shape="ordered-pair-box">
      <CharacterBox
        heading={
          <strong className="docs-figure__term">
            <FigureTitle>{pair.title}</FigureTitle>
          </strong>
        }
      >
        <small className="docs-figure__annotation">{pair.detail}</small>
        <div className="docs-figure__field-pair-variants">
          <ItemCopy item={response} />
          <ItemCopy item={prompt} />
        </div>
        <ItemCopy item={preservation} />
      </CharacterBox>
    </div>
  );
}

function AttestationFlow({ figure }: { figure: FieldFigure }) {
  const [recorded, claim, validation, attested, unattested, ceiling] = figure.items;
  if (!recorded || !claim || !validation || !attested || !unattested || !ceiling) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="attestation-flow-fork-ceiling"
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
            <small className="docs-figure__annotation">{attested.detail}</small>
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
            <small className="docs-figure__annotation">{unattested.detail}</small>
          </span>
        </div>
      </div>
      <CharacterBox
        className="docs-figure__field-ceiling"
        heading={
          <strong className="docs-figure__term">
            <FigureTitle>{ceiling.title}</FigureTitle>
          </strong>
        }
      >
        <small className="docs-figure__annotation">{ceiling.detail}</small>
      </CharacterBox>
    </div>
  );
}

function WillField({ figure }: { figure: FieldFigure }) {
  return (
    <div className="docs-figure__field-shape" data-figure-shape="will-box">
      <CharacterBox heading={<StaticTerm>WILL</StaticTerm>}>
        <div className="docs-figure__field-box-list">
          {figure.items.map((item) => (
            <ItemCopy item={item} key={`${item.title}:${item.detail}`} />
          ))}
        </div>
      </CharacterBox>
    </div>
  );
}

const AWA_ARC = [
  { title: "THOUGHT", detail: "INDIVIDUAL" },
  { title: "WILL", detail: "CROWD" },
  { title: "AWA", detail: "TOWARD THE CORE" },
] as const;

function AwaField({ figure }: { figure: FieldFigure }) {
  return (
    <div className="docs-figure__field-shape" data-figure-shape="awa-arc-box">
      <CharacterBox heading={<StaticTerm>AWA</StaticTerm>}>
        <ol className="docs-figure__field-arc">
          {AWA_ARC.map((stage, index) => (
            <li key={stage.title}>
              <span className="docs-figure__copy">
                <strong className="docs-figure__term">{stage.title}</strong>
                <small className="docs-figure__annotation">{stage.detail}</small>
              </span>
              {index < AWA_ARC.length - 1 ? (
                <Glyph label="then">→</Glyph>
              ) : null}
            </li>
          ))}
        </ol>
        <div className="docs-figure__field-box-list">
          {figure.items.map((item) => (
            <ItemCopy item={item} key={`${item.title}:${item.detail}`} />
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
          key={`${item.title}:${item.detail}`}
        >
          <small className="docs-figure__annotation">{item.detail}</small>
        </CharacterBox>
      ))}
    </div>
  );
}

function CanonicalSourceFlow({ figure }: { figure: FieldFigure }) {
  const [origin, surfaces, relation, boundary] = figure.items;
  if (!origin || !surfaces || !relation || !boundary) {
    return <BranchFallback figure={figure} />;
  }

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="canonical-source-flow"
    >
      <CharacterBox
        heading={<StaticTerm>IDENTIFIED ONCHAIN WORK</StaticTerm>}
        junction
      >
        <ItemCopy item={origin} />
      </CharacterBox>
      <div className="docs-figure__field-tail">
        <FlowConnector />
        <ItemCopy item={surfaces} />
      </div>
      <div className="docs-figure__field-source-notes">
        <ItemCopy item={relation} />
        <ItemCopy item={boundary} className="docs-figure__field-boundary" />
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
    case "The ordered-pair boundary":
      return <OrderedPair figure={figure} />;
    case "Creation Attestation bindings":
      return <AttestationFlow figure={figure} />;
    case "WILL: known and forming":
      return <WillField figure={figure} />;
    case "AWA: known and forming":
      return <AwaField figure={figure} />;
    case "Current Inshell principles across systems":
      return <PrincipleBoxes figure={figure} />;
    case "Many surfaces, one identified record":
      return <CanonicalSourceFlow figure={figure} />;
    default:
      return <BranchFallback figure={figure} />;
  }
}
