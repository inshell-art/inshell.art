import "./svg-lab.css";

import { DownloadSVG } from "./helpers/download-svg";
import {
  thoughtV2DefaultText,
  thoughtV2TextCorpuses,
  thoughtV2TextFixtures,
  type ThoughtV2TextFixture,
} from "./thought-v2-fixtures";
import { THOUGHT_V2_ARTIFACT, buildThoughtV2Svg, measureThoughtV2Line } from "./thought-v2-renderer";

const $ = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing #${id}`);
  }
  return element as T;
};

const preview = $("svg-preview");
const raw = $<HTMLTextAreaElement>("v2-raw");
const meta = $("v2-meta");
const promptInput = $<HTMLTextAreaElement>("v2-prompt");
const agentInput = $<HTMLTextAreaElement>("v2-agent");
const copyButton = $<HTMLButtonElement>("v2-copy");
const saveButton = $<HTMLButtonElement>("v2-save");
const resetButton = $<HTMLButtonElement>("v2-reset");
const saveAllButton = $<HTMLButtonElement>("v2-save-all");
const fixturesGrid = $("v2-fixtures");
const fixturesMeta = $("v2-fixtures-meta");

const defaults = thoughtV2DefaultText;
const corpuses = thoughtV2TextCorpuses;
const fixtures = thoughtV2TextFixtures;
const textEncoder = new TextEncoder();

const fixedRender = {
  agentFontSize: 44,
  promptFontSize: 16,
  agentTextColor: "#ffffff",
  promptTextColor: "#ffffff",
  canvasBgColor: "#000000",
} as const;

const saveSvg = (svg: string, filename: string) => {
  if (!svg.trim()) return;
  DownloadSVG(svg, filename);
};

type StableJsonValue =
  | string
  | number
  | boolean
  | null
  | StableJsonValue[]
  | { [key: string]: StableJsonValue };

const stableStringify = (value: StableJsonValue): string => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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

const fixtureProvenanceJson = (fixture: ThoughtV2TextFixture, agent: string) =>
  stableStringify({
    agent,
    app: "THOUGHT",
    fixture: {
      corpusId: fixture.corpusId,
      corpusName: fixture.corpusName,
      id: fixture.id,
      name: fixture.name,
    },
    output: {
      agentLine: fixture.agentLine,
      format: "thought-v2-line-pair",
      promptLine: fixture.promptLine,
    },
    renderer: {
      artifactId: THOUGHT_V2_ARTIFACT.artifactId,
      channel: THOUGHT_V2_ARTIFACT.channel,
    },
    route: agent.toLowerCase(),
    schema: "thought.provenance.lab.v1",
  });

const provenanceHref = (provenanceJson: string) =>
  `data:application/json;charset=utf-8,${encodeURIComponent(provenanceJson)}`;

const renderSvgImage = (container: HTMLElement, svg: string, alt: string) => {
  const image = document.createElement("img");
  image.alt = alt;
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  container.replaceChildren(image);
};

const renderRawSvgToPreview = (svg: string, validMeta: string): boolean => {
  const trimmed = svg.trim();
  if (!trimmed) {
    preview.replaceChildren();
    meta.textContent = "raw svg is empty";
    return false;
  }

  if (!trimmed.startsWith("<svg") || !trimmed.endsWith("</svg>")) {
    preview.replaceChildren();
    meta.textContent = "raw svg must contain one complete svg element";
    return false;
  }

  renderSvgImage(preview, trimmed, "THOUGHT V2 SVG preview");
  meta.textContent = validMeta;
  return true;
};

const renderFixtureCard = (fixture: ThoughtV2TextFixture, index: number): HTMLElement => {
  const card = document.createElement("article");
  card.className = "svg-lab__fixture-card";
  card.dataset.fixtureId = fixture.id;

  const canvas = document.createElement("div");
  canvas.className = "svg-lab__fixture-canvas";
  canvas.setAttribute("aria-label", `${fixture.name} fixture preview`);

  try {
    const fixtureSvg = buildThoughtV2Svg({
      promptLine: fixture.promptLine,
      agentLine: fixture.agentLine,
      ...fixedRender,
    });
    renderSvgImage(canvas, fixtureSvg, `${fixture.name} fixture preview`);
  } catch (error) {
    canvas.textContent = error instanceof Error ? error.message : "render failed";
  }

  const agent = fixtureAgentLabel(index);
  const provenanceJson = fixtureProvenanceJson(fixture, agent);
  const provenanceBits = textEncoder.encode(provenanceJson).length * 8;

  const metadata = document.createElement("div");
  metadata.className = "svg-lab__fixture-meta";

  const thoughtLine = document.createElement("p");
  thoughtLine.className = "svg-lab__fixture-meta-line";
  thoughtLine.textContent = `THOUGHT #${index + 1}`;

  const agentLine = document.createElement("p");
  agentLine.className = "svg-lab__fixture-meta-line";
  agentLine.textContent = `Agent: ${agent}`;

  const provenanceLine = document.createElement("p");
  provenanceLine.className = "svg-lab__fixture-meta-line";

  const provenanceLink = document.createElement("a");
  provenanceLink.className = "svg-lab__fixture-provenance";
  provenanceLink.href = provenanceHref(provenanceJson);
  provenanceLink.target = "_blank";
  provenanceLink.rel = "noopener";
  provenanceLink.textContent = `Provenance ${provenanceBits} bit`;

  provenanceLine.append(provenanceLink);
  metadata.append(thoughtLine, agentLine, provenanceLine);
  card.append(canvas, metadata);
  return card;
};

const renderFixtures = () => {
  fixturesGrid.replaceChildren(...fixtures.map(renderFixtureCard));
  fixturesMeta.textContent = `${fixtures.length} works across ${corpuses.length} text corpuses`;
};

const render = () => {
  const promptLine = promptInput.value;
  const agentLine = agentInput.value;
  const promptMeasure = measureThoughtV2Line(promptLine, "prompt");
  const agentMeasure = measureThoughtV2Line(agentLine, "agent");
  const errors = [...agentMeasure.errors, ...promptMeasure.errors];

  if (errors.length > 0) {
    preview.replaceChildren();
    raw.value = "";
    meta.textContent = errors.join(" | ");
    return;
  }

  const svg = buildThoughtV2Svg({
    promptLine,
    agentLine,
    ...fixedRender,
  });
  const metaParts = [
    `agent ${agentMeasure.byteLength} bytes / ${agentMeasure.displayUnits} units`,
    `prompt ${promptMeasure.byteLength} bytes / ${promptMeasure.displayUnits} units`,
  ];
  raw.value = svg;
  renderRawSvgToPreview(svg, [...metaParts, `${textEncoder.encode(svg).length} svg bytes`].join(" | "));
};

const renderRawEdit = () => {
  const svg = raw.value;
  renderRawSvgToPreview(svg, `raw edit | ${textEncoder.encode(svg).length} svg bytes`);
};

const reset = () => {
  promptInput.value = defaults.promptLine;
  agentInput.value = defaults.agentLine;
  render();
};

promptInput.addEventListener("input", render);
agentInput.addEventListener("input", render);
raw.addEventListener("input", renderRawEdit);

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(raw.value);
  copyButton.textContent = "[ copied ]";
  window.setTimeout(() => {
    copyButton.textContent = "[ copy raw ]";
  }, 1000);
});

saveButton.addEventListener("click", () => {
  saveSvg(raw.value, "thought-v2-current.svg");
});

saveAllButton.addEventListener("click", () => {
  fixtures.forEach((fixture) => {
    const svg = buildThoughtV2Svg({
      promptLine: fixture.promptLine,
      agentLine: fixture.agentLine,
      ...fixedRender,
    });
    saveSvg(svg, `thought-v2-${fixture.corpusId}-${fixture.id}.svg`);
  });
});

resetButton.addEventListener("click", reset);

renderFixtures();
reset();
