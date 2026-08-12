import { Fragment, type ReactNode } from "react";

import type { DocsFigure } from "@/content/docs";
import {
  docsFigureLogic,
  type DocsFigureEdge,
  type DocsFigureNode,
} from "@/content/docs-figure-logic";
import {
  resolveEdgeByEndpoints,
  resolveSourceNode,
} from "@/components/docs/figureLogicResolvers";

type FieldFigure = Extract<DocsFigure, { mode: "field" }>;
type FieldFigureItem = FieldFigure["items"][number];

export type FieldFigureVisualProps = {
  figure: FieldFigure;
};

const HORIZONTAL_RAIL = "─".repeat(256);
const VERTICAL_RAIL = Array.from({ length: 64 }, () => "│").join("\n");

function figureEdge(figure: FieldFigure, edgeId: string): DocsFigureEdge {
  const edge = docsFigureLogic(figure).edges.find(({ id }) => id === edgeId);
  if (!edge) {
    throw new Error(`Figure "${figure.id}" has no semantic edge "${edgeId}".`);
  }
  return edge;
}

function figureNode(figure: FieldFigure, nodeId: string): DocsFigureNode {
  const node = docsFigureLogic(figure).nodes.find(({ id }) => id === nodeId);
  if (!node) {
    throw new Error(`Figure "${figure.id}" has no semantic node "${nodeId}".`);
  }
  return node;
}

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
  capJunction = false,
  capAnnotation,
}: {
  heading?: ReactNode;
  children?: ReactNode;
  className?: string;
  junction?: boolean;
  capJunction?: boolean;
  capAnnotation?: ReactNode;
}) {
  return (
    <div
      className={`docs-figure__character-frame${className ? ` ${className}` : ""}`}
    >
      {capJunction ? (
        <div className="docs-figure__frame-cap docs-figure__frame-cap--junction">
          <span className="docs-figure__frame-cap-half docs-figure__frame-cap-half--left">
            <Glyph className="docs-figure__frame-character">┌─ </Glyph>
            <span className="docs-figure__frame-heading">{heading}</span>
            {capAnnotation}
            <Glyph className="docs-figure__frame-rule">
              {` ${HORIZONTAL_RAIL}`}
            </Glyph>
          </span>
          <Glyph className="docs-figure__frame-character">┬</Glyph>
          <span className="docs-figure__frame-cap-half docs-figure__frame-cap-half--right">
            <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
            <Glyph className="docs-figure__frame-character">┐</Glyph>
          </span>
        </div>
      ) : heading ? (
        <div className="docs-figure__frame-cap">
          <Glyph className="docs-figure__frame-character">┌──</Glyph>
          <span className="docs-figure__frame-heading">{heading}</span>
          <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
          <Glyph className="docs-figure__frame-character">┐</Glyph>
        </div>
      ) : (
        <div className="docs-figure__frame-cap docs-figure__frame-cap--plain">
          <Glyph className="docs-figure__frame-character">┌</Glyph>
          <Glyph className="docs-figure__frame-rule">{HORIZONTAL_RAIL}</Glyph>
          <Glyph className="docs-figure__frame-character">┐</Glyph>
        </div>
      )}
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

function FlowConnector({
  direction = "down",
  label,
}: {
  direction?: "down" | "up";
  label: string;
}) {
  return (
    <span
      className="docs-figure__field-connector"
      role="img"
      aria-label={label}
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
  const enterEdge = figureEdge(figure, "enter-shell");
  const inspectEdge = figureEdge(figure, "inspect-self");

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="contained-axis"
    >
      <CharacterBox
        heading={<StaticTerm>{shell.title}</StaticTerm>}
        capJunction
        capAnnotation={
          shell.detail ? (
            <small className="docs-figure__annotation docs-figure__field-inward-note">
              {shell.detail}
            </small>
          ) : null
        }
      >
        <div className="docs-figure__field-tail">
          <span className="docs-figure__field-relation">
            <Glyph label={enterEdge.label}>
              {Array.from({ length: 64 }, () => enterEdge.glyph).join("\n")}
            </Glyph>
            <small className="docs-figure__annotation docs-figure__field-relation-label">
              {inward.title}
            </small>
          </span>
          <Glyph
            className="docs-figure__field-inward-arrow"
            label={inspectEdge.label}
          >
            {inspectEdge.glyph}
          </Glyph>
          <span className="docs-figure__copy docs-figure__field-destination-copy">
            {destinationLead ? (
              <small className="docs-figure__annotation">
                {destinationLead}{" "}
              </small>
            ) : null}
            <strong className="docs-figure__term">{destination}</strong>
          </span>
        </div>
      </CharacterBox>
    </div>
  );
}

function PracticeRelation({ figure }: { figure: FieldFigure }) {
  const [truth, practice] = figure.items;
  if (!truth || !practice) {
    return <BranchFallback figure={figure} />;
  }
  const approachEdge = figureEdge(figure, "practice-approaches-truth");

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="framed-directed-relation"
    >
      <div className="docs-figure__field-chain docs-figure__field-chain--up">
        <CharacterBox className="docs-figure__field-entity-frame">
          <ItemCopy item={truth} />
        </CharacterBox>
        <span className="docs-figure__field-practice-relation">
          <Glyph
            className="docs-figure__field-practice-arrow"
            label={approachEdge.label}
          >
            {approachEdge.glyph}
          </Glyph>
          {approachEdge.annotation ? (
            <small className="docs-figure__annotation">
              {approachEdge.annotation}
            </small>
          ) : null}
        </span>
        <CharacterBox className="docs-figure__field-entity-frame">
          <ItemCopy item={practice} />
        </CharacterBox>
      </div>
    </div>
  );
}

function AgentArtField({ figure }: { figure: FieldFigure }) {
  const [invariant, artQuestion, agentQuestion] = figure.items;
  if (!invariant || !artQuestion || !agentQuestion) {
    return <BranchFallback figure={figure} />;
  }
  const agentArtRoot = figureNode(figure, "agent-art");
  const openQuestions = figureNode(figure, "open-questions");

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-invariant-field"
    >
      <StaticTerm>{agentArtRoot.term}</StaticTerm>
      <div className="docs-figure__field-segment">
        <ItemCopy item={invariant} />
      </div>
      <span className="docs-figure__eyebrow">{openQuestions.term}</span>
      <ul className="docs-figure__field docs-figure__field-open-questions">
        <li>
          <Glyph>├─</Glyph>
          <ItemCopy item={artQuestion} />
        </li>
        <li>
          <Glyph>└─</Glyph>
          <ItemCopy item={agentQuestion} />
        </li>
      </ul>
    </div>
  );
}

function PromptResponseField({ figure }: { figure: FieldFigure }) {
  const [prompt, response, thought] = figure.items;
  if (!prompt || !response || !thought) {
    return <BranchFallback figure={figure} />;
  }
  const pairEdge = figureEdge(figure, "prompt-in-work");
  const resultEdge = figureEdge(figure, "response-in-work");

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-prompt-response"
      data-figure-shape="prompt-response"
    >
      <div className="docs-figure__field-prompt-pair">
        <ItemCopy item={prompt} />
        <Glyph label={pairEdge.label}>{pairEdge.glyph}</Glyph>
        <ItemCopy item={response} />
      </div>
      <Glyph
        className="docs-figure__field-prompt-arrow"
        label={resultEdge.label}
      >
        {resultEdge.glyph}
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
  const valuesEdge = figureEdge(figure, "values-to-claim");
  const validationEdge = figureEdge(figure, "claim-to-validation");
  const validBranchEdge = figureEdge(figure, "validation-valid-branch");
  const validResultEdge = figureEdge(figure, "valid-proof-result");
  const emptyBranchEdge = figureEdge(figure, "validation-empty-branch");
  const emptyResultEdge = figureEdge(figure, "empty-proof-result");
  const validProof = figureNode(figure, "valid-proof");
  const emptyProof = figureNode(figure, "empty-proof");

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="attestation-flow-fork"
    >
      <div className="docs-figure__field-chain">
        <ItemCopy item={recorded} />
        <FlowConnector label={valuesEdge.label} />
        <ItemCopy item={claim} />
        <FlowConnector label={validationEdge.label} />
        <ItemCopy item={validation} />
      </div>
      <div className="docs-figure__field-fork">
        <Glyph className="docs-figure__field-fork-stem">
          {VERTICAL_RAIL}
        </Glyph>
        <div className="docs-figure__field-fork-branch">
          <span className="docs-figure__field-fork-branch-rail">
            <Glyph label={validBranchEdge.label}>{validBranchEdge.glyph}</Glyph>
            <Glyph className="docs-figure__field-fork-continuation">
              {VERTICAL_RAIL}
            </Glyph>
          </span>
          <span className="docs-figure__copy">
            <span className="docs-figure__field-fork-proof">
              <span className="docs-figure__eyebrow">{validProof.term}</span>
              <Glyph label={validResultEdge.label}>{validResultEdge.glyph}</Glyph>
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
            <Glyph label={emptyBranchEdge.label}>{emptyBranchEdge.glyph}</Glyph>
          </span>
          <span className="docs-figure__copy">
            <span className="docs-figure__field-fork-proof">
              <span className="docs-figure__eyebrow">{emptyProof.term}</span>
              <Glyph label={emptyResultEdge.label}>{emptyResultEdge.glyph}</Glyph>
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
  const willRoot = figureNode(figure, "will");

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-will-field"
    >
      <StaticTerm>{willRoot.term}</StaticTerm>
      <ul className="docs-figure__field docs-figure__field-open-set">
        {[people, agents, will].map((item) => (
          <li key={`${item.title}:${item.detail ?? ""}`}>
            <Glyph>•</Glyph>
            <ItemCopy item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function AwaField({ figure }: { figure: FieldFigure }) {
  const logic = docsFigureLogic(figure);
  const sourceNodes = figure.items.map((_, sourceItem) =>
    resolveSourceNode(logic, sourceItem),
  );
  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-horizon"
    >
      <ol className="docs-figure__field-arc">
        {figure.items.map((stage, index) => {
          const currentNode = sourceNodes[index];
          const nextNode = sourceNodes[index + 1];
          const isLast = index === figure.items.length - 1;
          if (!isLast && (!currentNode || !nextNode)) {
            throw new Error(
              `Figure "${figure.id}" cannot resolve consecutive source items ${index} and ${index + 1}.`,
            );
          }
          const nextEdge =
            !isLast && currentNode && nextNode
              ? resolveEdgeByEndpoints(logic, currentNode.id, nextNode.id)
              : undefined;

          return (
            <li key={`${stage.title}:${stage.detail ?? ""}`}>
              <ItemCopy item={stage} />
              {nextEdge ? (
                <Glyph label={nextEdge.label}>{nextEdge.glyph}</Glyph>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EvidenceInterpretation({ figure }: { figure: FieldFigure }) {
  const interpretation = figure.items.at(-1);
  const evidence = figure.items.slice(0, -1);
  if (!interpretation || evidence.length === 0) {
    return <BranchFallback figure={figure} />;
  }
  const logic = docsFigureLogic(figure);
  const evidenceRoot = figureNode(figure, "evidence");
  const branchEdges = logic.edges.filter(({ from }) => from === "evidence").slice(0, 4);
  const interpretationEdge = figureEdge(figure, "evidence-to-interpretation");

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-evidence"
      data-figure-shape="evidence-interpretation"
    >
      <div className="docs-figure__field-evidence-tree">
        <StaticTerm>{evidenceRoot.term}</StaticTerm>
        <ul className="docs-figure__field-evidence-list">
          {evidence.map((item, index) => (
            <li key={`${item.title}:${item.detail ?? ""}`}>
              <Glyph label={branchEdges[index]?.label}>
                {branchEdges[index]?.glyph ??
                  (index === evidence.length - 1 ? "└─" : "├─")}
              </Glyph>
              <ItemCopy item={item} />
            </li>
          ))}
        </ul>
      </div>
      <div className="docs-figure__field-evidence-tail">
        <Glyph label={interpretationEdge.label}>{`│\n${interpretationEdge.glyph}`}</Glyph>
        <ItemCopy item={interpretation} />
      </div>
    </div>
  );
}

function DistinctionsField({ figure }: { figure: FieldFigure }) {
  const walletRoot = figureNode(figure, "wallet-local-data");
  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="distinctions-box"
    >
      <CharacterBox heading={<StaticTerm>{walletRoot.term}</StaticTerm>}>
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
  const edges = docsFigureLogic(figure).edges;
  const recordsRoot = figureNode(figure, "four-records");
  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="distinct-records-box"
    >
      <CharacterBox heading={<StaticTerm>{recordsRoot.term}</StaticTerm>}>
        <div className="docs-figure__field-records">
          {figure.items.map((item, index) => (
            <span
              className="docs-figure__field-record"
              key={`${item.title}:${item.detail ?? ""}`}
            >
              {index > 0 ? (
                <Glyph label={edges[index - 1]?.label ?? "is distinct from"}>
                  {edges[index - 1]?.glyph ?? "≠"}
                </Glyph>
              ) : null}
              <ItemCopy item={item} />
            </span>
          ))}
        </div>
      </CharacterBox>
    </div>
  );
}

function PrincipleField({ figure }: { figure: FieldFigure }) {
  const principlesRoot = figureNode(figure, "principles");
  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-principle-set"
    >
      <StaticTerm>{principlesRoot.term}</StaticTerm>
      <ul className="docs-figure__field docs-figure__field-open-set">
        {figure.items.map((item) => (
          <li key={`${item.title}:${item.detail ?? ""}`}>
            <Glyph>•</Glyph>
            <ItemCopy item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CanonicalSourceFlow({ figure }: { figure: FieldFigure }) {
  const [work, surfaces] = figure.items;
  if (!work || !surfaces) {
    return <BranchFallback figure={figure} />;
  }
  const surfaceEdge = figureEdge(figure, "work-to-surfaces");

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
        <Glyph label={surfaceEdge.label}>{surfaceEdge.glyph}</Glyph>
        <ItemCopy item={surfaces} />
      </div>
    </div>
  );
}

export function FieldFigureVisual({ figure }: FieldFigureVisualProps) {
  switch (figure.id) {
    case "inshell.inward-direction":
      return <InwardDirection figure={figure} />;
    case "inshell.practice-truth":
      return <PracticeRelation figure={figure} />;
    case "agent-art.open-field":
      return <AgentArtField figure={figure} />;
    case "thought.prompt-response":
      return <PromptResponseField figure={figure} />;
    case "thought.creation-attestation":
      return <AttestationFlow figure={figure} />;
    case "will.open-field":
      return <WillField figure={figure} />;
    case "awa.open-horizon":
      return <AwaField figure={figure} />;
    case "evidence.interpretation":
      return <EvidenceInterpretation figure={figure} />;
    case "wallet.distinctions":
      return <DistinctionsField figure={figure} />;
    case "source-release.records":
      return <DistinctRecordsField figure={figure} />;
    case "design.principles":
      return <PrincipleField figure={figure} />;
    case "design.reading-surfaces":
      return <CanonicalSourceFlow figure={figure} />;
    default:
      return <BranchFallback figure={figure} />;
  }
}
