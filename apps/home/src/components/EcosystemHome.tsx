import { useMemo } from "react";
import {
  THOUGHT_V2_ARTIFACT_SAMPLES,
  THOUGHT_V2_PINNED_ARTIFACT,
  thoughtV2ArtifactSampleUrl,
  type ThoughtV2ArtifactSample,
} from "@inshell/shared";

type Movement = {
  key: "thought" | "will" | "awa";
  title: string;
  note: string;
  href?: string;
};

const MOVEMENTS: Movement[] = [
  {
    key: "thought",
    title: "THOUGHT",
    note: "on Sepolia now",
    href: "thought",
  },
  {
    key: "will",
    title: "WILL",
    note: "launch in 2027",
  },
  {
    key: "awa",
    title: "AWA!",
    note: "launch in 2028",
  },
];

type StableJsonValue =
  | string
  | number
  | boolean
  | null
  | StableJsonValue[]
  | { [key: string]: StableJsonValue };

type FixtureWork = {
  agent: string;
  index: number;
  provenanceBits: number;
  provenanceHref: string;
  sample: ThoughtV2ArtifactSample;
  svgUrl: string;
};

const textEncoder = new TextEncoder();

const stableStringify = (value: StableJsonValue): string => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
};

const fixtureAgentLabel = (index: number) => (index % 2 === 0 ? "Codex" : "Claude");

const fixtureProvenanceJson = (sample: ThoughtV2ArtifactSample, agent: string) =>
  stableStringify({
    agent,
    app: "THOUGHT",
    fixture: {
      corpusId: sample.corpusId,
      corpusName: sample.corpusName,
      id: sample.fixtureId,
      name: sample.fixtureName,
    },
    output: {
      agentLine: sample.agentLine,
      format: "thought-v2-line-pair",
      promptLine: sample.promptLine,
    },
    renderer: {
      artifactId: THOUGHT_V2_PINNED_ARTIFACT.artifactId,
      channel: THOUGHT_V2_PINNED_ARTIFACT.channel,
      manifestSha256: THOUGHT_V2_PINNED_ARTIFACT.manifestSha256,
    },
    route: agent.toLowerCase(),
    schema: "thought.provenance.lab.v1",
  });

const provenanceHref = (provenanceJson: string) =>
  `data:application/json;charset=utf-8,${encodeURIComponent(provenanceJson)}`;

const fixtureWorks = (): FixtureWork[] =>
  THOUGHT_V2_ARTIFACT_SAMPLES.map((sample, index) => {
    const agent = fixtureAgentLabel(index);
    const provenanceJson = fixtureProvenanceJson(sample, agent);

    return {
      agent,
      index,
      provenanceBits: textEncoder.encode(provenanceJson).length * 8,
      provenanceHref: provenanceHref(provenanceJson),
      sample,
      svgUrl: thoughtV2ArtifactSampleUrl(sample),
    };
  });

export default function EcosystemHome() {
  const works = useMemo(() => fixtureWorks(), []);

  return (
    <main className="ecosystem-home" aria-labelledby="ecosystem-home-slogan">
      <section className="ecosystem-home__hero">
        <div className="ecosystem-home__movements" aria-label="Inshell movements">
          {MOVEMENTS.map((movement) => (
            movement.href === "thought" ? (
              <a
                key={movement.key}
                className="ecosystem-home__movement"
                href="/thought"
                aria-label={movement.title}
              >
                <span className="ecosystem-home__movement-note" data-note={movement.note}>
                  {movement.note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </a>
            ) : (
              <span key={movement.key} className="ecosystem-home__movement">
                <span className="ecosystem-home__movement-note" data-note={movement.note}>
                  {movement.note}
                </span>
                <span className="ecosystem-home__movement-title">{movement.title}</span>
              </span>
            )
          ))}
        </div>
        <h1 id="ecosystem-home-slogan" className="ecosystem-home__slogan">
          3 fully onchain movements for Agent Art.
        </h1>
      </section>
      <div
        className="ecosystem-home__fixture-works"
        aria-label="THOUGHT V2 fixture works"
        data-artifact-id={THOUGHT_V2_PINNED_ARTIFACT.artifactId}
        data-manifest-sha256={THOUGHT_V2_PINNED_ARTIFACT.manifestSha256}
      >
        {works.map((work) => (
          <article
            className="ecosystem-home__fixture-work-card"
            data-fixture-id={work.sample.fixtureId}
            key={work.sample.fixtureId}
            aria-label={`${work.sample.fixtureName} fixture work`}
          >
            <div
              className="ecosystem-home__fixture-work-canvas"
            >
              <img
                src={work.svgUrl}
                alt={`${work.sample.fixtureName} fixture preview`}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="ecosystem-home__fixture-work-meta">
              <p className="ecosystem-home__fixture-work-meta-line">THOUGHT #{work.index + 1}</p>
              <p className="ecosystem-home__fixture-work-meta-line">Agent: {work.agent}</p>
              <p className="ecosystem-home__fixture-work-meta-line">
                <a
                  className="ecosystem-home__fixture-work-provenance"
                  href={work.provenanceHref}
                  target="_blank"
                  rel="noopener"
                >
                  Provenance {work.provenanceBits} bit
                </a>
              </p>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
