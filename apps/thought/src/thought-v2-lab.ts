import "./svg-lab.css";

import { DownloadSVG } from "./helpers/download-svg";
import {
  thoughtV2DefaultText,
  thoughtV2TextCorpuses,
  thoughtV2TextFixtures,
  type ThoughtV2TextFixture,
} from "./thought-v2-fixtures";
import { buildThoughtV2Svg, measureThoughtV2Line, type ThoughtV2LineKind } from "./thought-v2-renderer";

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

const measureLabel = (value: string, kind: ThoughtV2LineKind) => {
  const measure = measureThoughtV2Line(value, kind);
  return `${measure.byteLength}b / ${measure.displayUnits}u`;
};

const saveSvg = (svg: string, filename: string) => {
  if (!svg.trim()) return;
  DownloadSVG(svg, filename);
};

const renderRawSvgToPreview = (svg: string, validMeta: string): boolean => {
  const trimmed = svg.trim();
  if (!trimmed) {
    preview.replaceChildren();
    meta.textContent = "raw svg is empty";
    return false;
  }

  const documentSvg = new DOMParser().parseFromString(trimmed, "image/svg+xml");
  const parseError = documentSvg.querySelector("parsererror");
  if (parseError) {
    preview.replaceChildren();
    meta.textContent = `raw svg parse error | ${parseError.textContent?.replace(/\s+/g, " ").trim() ?? "invalid svg"}`;
    return false;
  }

  const svgElement = documentSvg.documentElement;
  if (svgElement.localName.toLowerCase() !== "svg") {
    preview.replaceChildren();
    meta.textContent = "raw svg must start with an svg element";
    return false;
  }

  preview.replaceChildren(document.importNode(svgElement, true));
  meta.textContent = validMeta;
  return true;
};

const lineItem = (labelText: string, value: string): HTMLElement => {
  const item = document.createElement("div");
  item.className = "svg-lab__fixture-line-item";

  const label = document.createElement("span");
  label.className = "svg-lab__fixture-line-label";
  label.textContent = labelText;

  const text = document.createElement("span");
  text.className = "svg-lab__fixture-line-value";
  text.textContent = value;

  item.append(label, text);
  return item;
};

const renderFixtureCard = (fixture: ThoughtV2TextFixture): HTMLElement => {
  const card = document.createElement("article");
  card.className = "svg-lab__fixture-card";
  card.dataset.fixtureId = fixture.id;

  const canvas = document.createElement("div");
  canvas.className = "svg-lab__fixture-canvas";
  canvas.setAttribute("aria-label", `${fixture.name} fixture preview`);

  const body = document.createElement("div");
  body.className = "svg-lab__fixture-body";

  const title = document.createElement("h3");
  title.className = "svg-lab__fixture-name";
  title.textContent = fixture.name;

  const corpus = document.createElement("p");
  corpus.className = "svg-lab__fixture-corpus";
  corpus.textContent = fixture.corpusName;

  const lines = document.createElement("p");
  lines.className = "svg-lab__fixture-lines";
  lines.textContent = `${measureLabel(fixture.agentLine, "agent")} agent | ${measureLabel(
    fixture.promptLine,
    "prompt",
  )} prompt`;

  const actions = document.createElement("div");
  actions.className = "svg-lab__fixture-actions";

  const saveFixtureButton = document.createElement("button");
  saveFixtureButton.className = "svg-lab__button svg-lab__fixture-button";
  saveFixtureButton.type = "button";
  saveFixtureButton.textContent = "[ save svg ]";
  saveFixtureButton.dataset.fixtureSave = fixture.id;

  const workList = document.createElement("div");
  workList.className = "svg-lab__fixture-work-list";
  workList.append(lineItem("promptLine", fixture.promptLine), lineItem("agentLine", fixture.agentLine));

  let fixtureSvg = "";
  try {
    fixtureSvg = buildThoughtV2Svg({
      promptLine: fixture.promptLine,
      agentLine: fixture.agentLine,
      ...fixedRender,
    });
    canvas.innerHTML = fixtureSvg;
  } catch (error) {
    canvas.textContent = error instanceof Error ? error.message : "render failed";
    saveFixtureButton.disabled = true;
  }

  saveFixtureButton.addEventListener("click", () => {
    saveSvg(fixtureSvg, `thought-v2-${fixture.corpusId}-${fixture.id}.svg`);
  });

  actions.append(saveFixtureButton);
  body.append(title, corpus, actions, workList, lines);
  card.append(canvas, body);
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
