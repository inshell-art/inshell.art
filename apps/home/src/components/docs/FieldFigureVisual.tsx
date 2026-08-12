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

function FlowConnector({
  edge,
  className = "",
}: {
  edge: DocsFigureEdge;
  className?: string;
}) {
  return (
    <span className="docs-figure__field-connector">
      <Glyph className={className} edgeId={edge.id} label={edge.label}>
        {edge.glyph}
      </Glyph>
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
      <NodeCopy node={thought} className="docs-figure__field-prompt-result" />
    </div>
  );
}

function AttestationFlow({ figure }: { figure: FieldFigure }) {
  const recorded = figureNode(figure, "recorded-values");
  const claim = figureNode(figure, "app-claim");
  const validation = figureNode(figure, "contract-validation");
  const attested = figureNode(figure, "app-attested");
  const unattested = figureNode(figure, "unattested");
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
        <NodeCopy node={recorded} />
        <FlowConnector
          edge={valuesEdge}
          className="docs-figure__field-attestation-arrow docs-figure__field-relation-glyph"
        />
        <NodeCopy node={claim} />
        <FlowConnector
          edge={validationEdge}
          className="docs-figure__field-attestation-arrow docs-figure__field-relation-glyph"
        />
        <NodeCopy node={validation} />
      </div>
      <div className="docs-figure__field-fork">
        <div className="docs-figure__field-fork-branch">
          <span className="docs-figure__field-fork-branch-rail">
            <Glyph
              className="docs-figure__field-attestation-branch-glyph"
              edgeId={validBranchEdge.id}
              label={validBranchEdge.label}
            >
              {validBranchEdge.glyph}
            </Glyph>
            <Glyph className="docs-figure__field-fork-continuation">
              {VERTICAL_RAIL}
            </Glyph>
          </span>
          <span className="docs-figure__copy">
            <span className="docs-figure__field-fork-proof">
              <StaticTerm
                className="docs-figure__field-proof-term"
                nodeId={validProof.id}
              >
                {validProof.term}
              </StaticTerm>
              <Glyph
                className="docs-figure__field-attestation-result-arrow docs-figure__field-relation-glyph"
                edgeId={validResultEdge.id}
                label={validResultEdge.label}
              >
                {validResultEdge.glyph}
              </Glyph>
            </span>
            <NodeCopy node={attested} />
          </span>
        </div>
        <div className="docs-figure__field-fork-branch">
          <span className="docs-figure__field-fork-branch-rail">
            <Glyph
              className="docs-figure__field-attestation-branch-glyph"
              edgeId={emptyBranchEdge.id}
              label={emptyBranchEdge.label}
            >
              {emptyBranchEdge.glyph}
            </Glyph>
          </span>
          <span className="docs-figure__copy">
            <span className="docs-figure__field-fork-proof">
              <StaticTerm
                className="docs-figure__field-proof-term"
                nodeId={emptyProof.id}
              >
                {emptyProof.term}
              </StaticTerm>
              <Glyph
                className="docs-figure__field-attestation-result-arrow docs-figure__field-relation-glyph"
                edgeId={emptyResultEdge.id}
                label={emptyResultEdge.label}
              >
                {emptyResultEdge.glyph}
              </Glyph>
            </span>
            <NodeCopy node={unattested} />
          </span>
        </div>
      </div>
    </div>
  );
}

function WillField({ figure }: { figure: FieldFigure }) {
  const people = figureNode(figure, "many-people");
  const agents = figureNode(figure, "many-agents");
  const oneWill = figureNode(figure, "one-will");

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-will-field"
    >
      <StaticTerm className="docs-figure__field-governing-term">
        WILL
      </StaticTerm>
      <ul className="docs-figure__field docs-figure__field-open-set">
        {[people, agents, oneWill].map((node) => (
          <li key={node.id}>
            <Glyph className="docs-figure__field-membership-glyph">•</Glyph>
            <NodeCopy node={node} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EvidenceInterpretation({ figure }: { figure: FieldFigure }) {
  const evidenceRoot = figureNode(figure, "evidence");
  const evidenceBranches = [
    {
      node: figureNode(figure, "identity"),
      edge: figureEdge(figure, "evidence-identity"),
    },
    {
      node: figureNode(figure, "contract"),
      edge: figureEdge(figure, "evidence-contract"),
    },
    {
      node: figureNode(figure, "release"),
      edge: figureEdge(figure, "evidence-release"),
    },
    {
      node: figureNode(figure, "context"),
      edge: figureEdge(figure, "evidence-context"),
    },
  ];
  const interpretation = figureNode(figure, "interpretation");
  const interpretationEdge = figureEdge(figure, "evidence-to-interpretation");

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-evidence"
      data-figure-shape="evidence-interpretation"
    >
      <div className="docs-figure__field-evidence-tree">
        <NodeCopy
          node={evidenceRoot}
          className="docs-figure__field-governing-node"
        />
        <ul className="docs-figure__field-evidence-list">
          {evidenceBranches.map(({ node, edge }) => (
            <li key={node.id}>
              <Glyph
                className="docs-figure__field-membership-glyph"
                edgeId={edge.id}
                label={edge.label}
              >
                {edge.glyph}
              </Glyph>
              <NodeCopy node={node} />
            </li>
          ))}
        </ul>
      </div>
      <div className="docs-figure__field-evidence-tail">
        <Glyph
          className="docs-figure__field-evidence-arrow docs-figure__field-relation-glyph"
          edgeId={interpretationEdge.id}
          label={interpretationEdge.label}
        >
          {interpretationEdge.glyph}
        </Glyph>
        <NodeCopy node={interpretation} />
      </div>
    </div>
  );
}

function DistinctionsField({ figure }: { figure: FieldFigure }) {
  const actionNodes = [
    figureNode(figure, "read"),
    figureNode(figure, "sign"),
    figureNode(figure, "transact"),
  ];
  const actionEdges = [
    figureEdge(figure, "read-not-sign"),
    figureEdge(figure, "sign-not-transact"),
  ];
  const recordNodes = [
    figureNode(figure, "local"),
    figureNode(figure, "onchain"),
  ];
  const recordEdges = [figureEdge(figure, "local-not-onchain")];

  const comparison = (
    nodes: readonly DocsFigureNode[],
    edges: readonly DocsFigureEdge[],
    className: string,
  ) => (
    <div className={`docs-figure__field-comparison ${className}`}>
      {nodes.map((node, index) => (
        <span className="docs-figure__field-comparison-member" key={node.id}>
          {index > 0 ? (
            <Glyph
              className="docs-figure__field-distinction-glyph docs-figure__field-relation-glyph"
              edgeId={edges[index - 1]?.id}
              label={edges[index - 1]?.label ?? "is distinct from"}
            >
              {edges[index - 1]?.glyph ?? "≠"}
            </Glyph>
          ) : null}
          <NodeCopy node={node} />
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="distinction-comparisons"
    >
      <div className="docs-figure__field-box-list">
        {comparison(
          actionNodes,
          actionEdges,
          "docs-figure__field-comparison--actions",
        )}
        {comparison(
          recordNodes,
          recordEdges,
          "docs-figure__field-comparison--records",
        )}
      </div>
    </div>
  );
}

function DistinctRecordsField({ figure }: { figure: FieldFigure }) {
  const records = [
    {
      node: figureNode(figure, "source"),
      precedingEdge: undefined,
    },
    {
      node: figureNode(figure, "release"),
      precedingEdge: figureEdge(figure, "source-not-release"),
    },
    {
      node: figureNode(figure, "deployment"),
      precedingEdge: figureEdge(figure, "release-not-deployment"),
    },
    {
      node: figureNode(figure, "observation"),
      precedingEdge: figureEdge(figure, "deployment-not-observation"),
    },
  ];

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="record-comparison"
    >
      <div className="docs-figure__field-records">
        {records.map(({ node, precedingEdge }) => (
          <span className="docs-figure__field-record" key={node.id}>
            {precedingEdge ? (
              <Glyph
                className="docs-figure__field-record-distinction-glyph docs-figure__field-relation-glyph"
                edgeId={precedingEdge.id}
                label={precedingEdge.label}
              >
                {precedingEdge.glyph}
              </Glyph>
            ) : null}
            <NodeCopy node={node} />
          </span>
        ))}
      </div>
    </div>
  );
}

function PrincipleField({ figure }: { figure: FieldFigure }) {
  const principles = [
    figureNode(figure, "bound"),
    figureNode(figure, "authorize"),
    figureNode(figure, "expose"),
    figureNode(figure, "pin"),
    figureNode(figure, "qualify"),
  ];

  return (
    <div
      className="docs-figure__field-shape docs-figure__field-open"
      data-figure-shape="open-principle-set"
    >
      <StaticTerm className="docs-figure__field-governing-term">
        CURRENT INSHELL PRINCIPLES
      </StaticTerm>
      <ul className="docs-figure__field docs-figure__field-open-set">
        {principles.map((node) => (
          <li key={node.id}>
            <Glyph className="docs-figure__field-membership-glyph">•</Glyph>
            <NodeCopy node={node} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CanonicalSourceFlow({ figure }: { figure: FieldFigure }) {
  const work = figureNode(figure, "identified-work");
  const surfaces = figureNode(figure, "reading-surfaces");
  const surfaceEdge = figureEdge(figure, "work-to-surfaces");

  return (
    <div
      className="docs-figure__field-shape"
      data-figure-shape="canonical-source-flow"
    >
      <CharacterBox
        heading={<StaticTerm>{work.term}</StaticTerm>}
        nodeId={work.id}
      >
        {work.annotation ? (
          <small className="docs-figure__annotation">{work.annotation}</small>
        ) : null}
      </CharacterBox>
      <div className="docs-figure__field-tail">
        <Glyph
          className="docs-figure__field-reading-arrow docs-figure__field-relation-glyph"
          edgeId={surfaceEdge.id}
          label={surfaceEdge.label}
        >
          {surfaceEdge.glyph}
        </Glyph>
        <NodeCopy node={surfaces} />
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
