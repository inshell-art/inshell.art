import { Fragment, type ReactNode } from "react";

import type { DocsFigure } from "@/content/docs";
import {
  docsFigureLogic,
  type DocsFigureEdge,
  type DocsFigureGroup,
  type DocsFigureNode,
} from "@/content/docs-figure-logic";
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

function figureGroup(figure: FieldFigure, groupId: string): DocsFigureGroup {
  const group = docsFigureLogic(figure).groups.find(({ id }) => id === groupId);
  if (!group) {
    throw new Error(`Figure "${figure.id}" has no semantic group "${groupId}".`);
  }
  return group;
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
  edgeId,
  groupId,
  label,
}: {
  children: ReactNode;
  className?: string;
  edgeId?: string;
  groupId?: string;
  label?: string;
}) {
  return (
    <span
      className={`docs-figure__glyph${className ? ` ${className}` : ""}`}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      data-figure-edge-id={edgeId}
      data-figure-group-id={groupId}
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

function NodeCopy({
  node,
  className = "",
}: {
  node: DocsFigureNode;
  className?: string;
}) {
  return (
    <span
      className={`docs-figure__copy${className ? ` ${className}` : ""}`}
      data-figure-node={node.id}
    >
      <strong className="docs-figure__term">
        <FigureTitle>{node.term}</FigureTitle>
      </strong>
      {node.annotation ? (
        <small className="docs-figure__annotation">{node.annotation}</small>
      ) : null}
    </span>
  );
}

function StaticTerm({
  children,
  className = "",
  nodeId,
}: {
  children: string;
  className?: string;
  nodeId?: string;
}) {
  return (
    <strong
      className={`docs-figure__term${className ? ` ${className}` : ""}`}
      data-figure-node={nodeId}
    >
      {children}
    </strong>
  );
}

function CharacterBox({
  heading,
  children,
  className = "",
  junction = false,
  balancedCap = false,
  capAnnotation,
  nodeId,
}: {
  heading?: ReactNode;
  children?: ReactNode;
  className?: string;
  junction?: boolean;
  balancedCap?: boolean;
  capAnnotation?: ReactNode;
  nodeId?: string;
}) {
  return (
    <div
      className={`docs-figure__character-frame${className ? ` ${className}` : ""}`}
      data-figure-node={nodeId}
    >
      {balancedCap ? (
        <div className="docs-figure__frame-cap docs-figure__frame-cap--balanced">
          <span className="docs-figure__frame-cap-half docs-figure__frame-cap-half--left">
            <Glyph className="docs-figure__frame-character">┌─ </Glyph>
            <span className="docs-figure__frame-heading">{heading}</span>
            {capAnnotation}
            <Glyph className="docs-figure__frame-rule">
              {` ${HORIZONTAL_RAIL}`}
            </Glyph>
          </span>
          <Glyph className="docs-figure__frame-character">─</Glyph>
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
  const inspectEdge = figureEdge(figure, "inspect-self");

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="contained-axis"
    >
      <CharacterBox
        heading={<StaticTerm nodeId="shell">{shell.title}</StaticTerm>}
        balancedCap
        capAnnotation={
          shell.detail ? (
            <small className="docs-figure__annotation docs-figure__field-inward-note">
              {shell.detail}
            </small>
          ) : null
        }
      >
        <div className="docs-figure__field-tail">
          <span className="docs-figure__field-inward-axis" data-figure-node="in">
            <Glyph
              className="docs-figure__field-inward-arrow"
              edgeId={inspectEdge.id}
              label={inspectEdge.label}
            >
              {inspectEdge.glyph}
            </Glyph>
            <small className="docs-figure__annotation docs-figure__field-inward-label">
              {inward.title}
            </small>
          </span>
          <span
            className="docs-figure__copy docs-figure__field-destination-copy"
            data-figure-node="self"
          >
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
  if (figure.items.length < 2) {
    return <BranchFallback figure={figure} />;
  }
  const truth = figureNode(figure, "truth");
  const practice = figureNode(figure, "practice");
  const approachEdge = figureEdge(figure, "practice-approaches-truth");

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="framed-directed-relation"
    >
      <div className="docs-figure__field-chain docs-figure__field-chain--up">
        <CharacterBox className="docs-figure__field-entity-frame">
          <NodeCopy node={truth} />
        </CharacterBox>
        <span className="docs-figure__field-practice-relation">
          <Glyph
            className="docs-figure__field-practice-arrow"
            edgeId={approachEdge.id}
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
          <NodeCopy node={practice} />
        </CharacterBox>
      </div>
    </div>
  );
}

function AgentArtField({ figure }: { figure: FieldFigure }) {
  const invariant = figureNode(figure, "invariant");
  const artQuestion = figureNode(figure, "what-is-art");
  const agentQuestion = figureNode(figure, "what-is-an-agent");
  const questions = figureGroup(figure, "agent-art-questions");
  if (!questions.glyph) {
    throw new Error(
      `Figure "${figure.id}" semantic group "${questions.id}" has no membership glyph.`,
    );
  }

  const question = (node: DocsFigureNode) => (
    <li data-figure-node={node.id}>
      <Glyph
        className="docs-figure__field-membership-glyph"
        groupId={questions.id}
      >
        {questions.glyph}
      </Glyph>
      <strong className="docs-figure__term">
        <FigureTitle>{node.term}</FigureTitle>
      </strong>
      {node.annotation ? (
        <small className="docs-figure__annotation">{node.annotation}</small>
      ) : null}
    </li>
  );

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-invariant-field"
    >
      <NodeCopy
        className="docs-figure__field-governing-term"
        node={invariant}
      />
      <ul className="docs-figure__field docs-figure__field-open-questions">
        {question(artQuestion)}
        {question(agentQuestion)}
      </ul>
    </div>
  );
}

function PromptResponseField({ figure }: { figure: FieldFigure }) {
  const prompt = figureNode(figure, "human-prompt");
  const response = figureNode(figure, "agent-response");
  const thought = figureNode(figure, "one-thought");
  const pairGroup = figureGroup(figure, "thought-equation");
  const resultEdge = figureEdge(figure, "pair-forms-thought");
  if (!pairGroup.glyph) {
    throw new Error(
      `Figure "${figure.id}" semantic group "${pairGroup.id}" has no pair glyph.`,
    );
  }

  const resultPair = thought.term.match(/^(.*)\s+(\([^)]*\))$/);

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-prompt-response"
      data-figure-shape="prompt-response"
    >
      <div className="docs-figure__field-prompt-pair">
        <NodeCopy node={prompt} />
        <Glyph
          className="docs-figure__field-prompt-pair-glyph"
          groupId={pairGroup.id}
          label={pairGroup.label}
        >
          {pairGroup.glyph}
        </Glyph>
        <NodeCopy node={response} />
      </div>
      <Glyph
        className="docs-figure__field-prompt-arrow docs-figure__field-relation-glyph"
        edgeId={resultEdge.id}
        label={resultEdge.label}
      >
        {resultEdge.glyph}
      </Glyph>
      <span
        className="docs-figure__copy docs-figure__field-prompt-result"
        data-figure-node={thought.id}
      >
        <strong className="docs-figure__term">
          {resultPair ? (
            <>
              {resultPair[1]}{" "}
              <span className="docs-figure__field-prompt-result-pair">
                {resultPair[2]}
              </span>
            </>
          ) : (
            <FigureTitle>{thought.term}</FigureTitle>
          )}
        </strong>
        {thought.annotation ? (
          <small className="docs-figure__annotation">{thought.annotation}</small>
        ) : null}
      </span>
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
    default:
      return <BranchFallback figure={figure} />;
  }
}
