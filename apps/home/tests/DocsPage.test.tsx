import React from "react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import nodePath from "node:path";
import { cwd } from "node:process";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/components/PulsePage", () => ({
  __esModule: true,
  PulseCurrentInstance: () => <div data-testid="pulse-current-instance" />,
}));

import DocsPage from "../src/components/DocsPage";
import {
  DOCS_AUTHORITY_MAP,
  DOCS_FIGURE_MODES,
  DOCS_SOURCE,
  type DocsAuthority,
  type DocsFigure,
  type DocsParagraph,
  type DocsTopic,
} from "../src/content/docs";
import {
  DOCS_FIGURE_FORMS,
  DOCS_FIGURE_LOGIC_IDS,
  docsFigureLogic,
  validateDocsFigureLogic,
  type DocsFigureForm,
} from "../src/content/docs-figure-logic";
import {
  resolveEdgeByEndpoints,
  resolveSourceNode,
} from "../src/components/docs/figureLogicResolvers";
import { THOUGHT_MACHINE_HANDOFF_SOURCE } from "../src/content/thought-machine-handoff";

afterEach(() => {
  cleanup();
});

function renderedTopicHeader(topic: DocsTopic) {
  const heading = screen.getByRole("heading", {
    level: 2,
    name: new RegExp(`^${topic.title}`),
  });
  const header = heading.closest("header");
  expect(header).not.toBeNull();
  return within(header as HTMLElement);
}

const SUMMARY_DUPLICATION_THRESHOLD = 0.8;

const CANONICAL_DOCS_APP_ROUTES = new Set([
  "/",
  "/color-font",
  "/docs",
  "/path",
  "/pulse",
  "/thought",
  "/verify",
  ...DOCS_SOURCE.topics.map((topic) => `/docs/${topic.slug}`),
]);

function isSupportedDocsAppRoute(pathname: string) {
  return (
    CANONICAL_DOCS_APP_ROUTES.has(pathname) ||
    /^\/(?:path|thought)\/[1-9]\d{0,8}$/.test(pathname)
  );
}

function docsLinks() {
  return DOCS_SOURCE.topics.flatMap((topic) =>
    (topic.links ?? []).map((link) => ({
      topic: topic.slug,
      label: link.label,
      href: link.href,
    })),
  );
}

function hrefPathname(href: string) {
  return href.split(/[?#]/, 1)[0];
}

function normalizedWords(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function docsParagraphText(paragraph: DocsParagraph) {
  if (typeof paragraph === "string") return paragraph;
  return paragraph
    .map((part) => (typeof part === "string" ? part : part.label))
    .join("");
}

function docsParagraphMarkdown(paragraph: DocsParagraph, canonicalOrigin: string) {
  if (typeof paragraph === "string") return paragraph;
  return paragraph
    .map((part) => {
      if (typeof part === "string") return part;
      const href = part.href.startsWith("/")
        ? `${canonicalOrigin}${part.href}`
        : part.href;
      return `[${part.label}](${href})`;
    })
    .join("");
}

function figureTextFields(figure: DocsFigure | undefined) {
  if (!figure) return [];
  return [
    figure.id,
    figure.label,
    figure.mode,
    figure.figureText,
    ...figure.items.flatMap(({ title, detail }) => [
      title,
      ...(detail ? [detail] : []),
    ]),
  ];
}

function topicFigureEntries(topic: DocsTopic) {
  return [
    ...(topic.figure
      ? [
          {
            key: `${topic.slug}:lead`,
            sectionId: null,
            figure: topic.figure,
          },
        ]
      : []),
    ...(topic.sections ?? []).flatMap((section) =>
      section.figure
        ? [
            {
              key: `${topic.slug}:${section.id}`,
              sectionId: section.id,
              figure: section.figure,
            },
          ]
        : [],
    ),
  ];
}

function allFigureEntries() {
  return DOCS_SOURCE.topics.flatMap((topic) =>
    topicFigureEntries(topic).map((entry) => ({ topic, ...entry })),
  );
}

function topicText(topic: DocsTopic) {
  return [
    topic.summary,
    ...topic.paragraphs.map(docsParagraphText),
    ...figureTextFields(topic.figure),
    ...(topic.sections?.flatMap((section) => [
      section.title,
      ...figureTextFields(section.figure),
      ...(section.paragraphs?.map(docsParagraphText) ?? []),
      ...(section.points ?? []),
      ...(section.steps ?? []),
      section.note,
    ]) ?? []),
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function wordEditDistance(left: string[], right: string[]) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[right.length];
}

function highestContiguousWordSimilarity(summary: string, paragraph: string) {
  const summaryWords = normalizedWords(summary);
  const paragraphWords = normalizedWords(paragraph);
  if (!summaryWords.length || !paragraphWords.length) return 0;

  // Equal-length windows catch a copied lead even when it moves within the
  // paragraph, while ordinary reuse of a topic name or a few key terms is safe.
  const windowLength = Math.min(summaryWords.length, paragraphWords.length);
  let highestSimilarity = 0;
  for (let start = 0; start <= paragraphWords.length - windowLength; start += 1) {
    const paragraphWindow = paragraphWords.slice(start, start + windowLength);
    const distance = wordEditDistance(summaryWords, paragraphWindow);
    highestSimilarity = Math.max(
      highestSimilarity,
      1 - distance / Math.max(summaryWords.length, paragraphWindow.length),
    );
  }

  return highestSimilarity;
}

describe("Docs source editorial guardrails", () => {
  test("keeps Inshell's anonymous artist identity and in-shell direction bounded", () => {
    const inshell = DOCS_SOURCE.topics.find(({ slug }) => slug === "inshell");
    expect(inshell).toBeDefined();
    if (!inshell) return;

    const text = topicText(inshell);

    expect(text).toMatch(/anonymous artist/i);
    expect(text).toMatch(
      /(?:has no|without|refus(?:es|ing))[^.]{0,140}(?:public|external) persona|(?:public|external) persona[^.]{0,140}(?:absent|withheld|refused)/i,
    );
    expect(text).not.toMatch(
      /Inshell is (?:an?|the) (?:individual|person|group|collective|company|studio|organization|protocol|Agent|machine|fictional character|brand mascot)\b/i,
    );
    expect(text).not.toMatch(
      /(?:Inshell (?:may|might|could) be|whether Inshell is) (?:an?|the)? ?(?:individual|person|group|collective|company|studio|organization|protocol|Agent|machine|fictional character|brand mascot)\b/i,
    );

    expect(text).toMatch(
      /anonym(?:ity|ous)[\s\S]{0,320}(?:Inshell(?:'s)? own shell|shell of Inshell|artist(?:'s)? own shell|artist itself)/i,
    );
    expect(text).toMatch(/(?:in-shell|inward)[\s\S]{0,240}(?:direction|movement|look beneath|go into)/i);
    expect(text).toMatch(
      /(?:does not|doesn't|without)[\s\S]{0,180}(?:prescribe|define|resolve)[\s\S]{0,100}(?:essence|self)|not[\s\S]{0,100}(?:doctrine|closed definition)[\s\S]{0,100}(?:essence|self)/i,
    );

    expect(text).toMatch(/shell[\s\S]{0,160}(?:real|necessary)/i);
    expect(text).not.toMatch(/the shell is (?:false|disposable|hostile|the enemy)/i);
    expect(text).toMatch(
      /(?:movements|artworks|works|participatory systems)[\s\S]{0,260}(?:invite|call)[\s\S]{0,180}(?:inward|in-shell)/i,
    );
    expect(text).toMatch(/Freedom is a possibility[\s\S]{0,160}not an outcome/i);
  });

  test("keeps truth before practice as self-inspection rather than doctrine or proof", () => {
    const inshell = DOCS_SOURCE.topics.find(({ slug }) => slug === "inshell");
    expect(inshell).toBeDefined();
    if (!inshell) return;

    const truthIndex = inshell.sections?.findIndex(({ id }) => id === "docs-inshell-truth") ?? -1;
    const practiceIndex = inshell.sections?.findIndex(({ id }) => id === "docs-inshell-practice") ?? -1;
    const text = topicText(inshell);

    expect(truthIndex).toBeGreaterThanOrEqual(0);
    expect(practiceIndex).toBeGreaterThan(truthIndex);
    expect(text).toMatch(/The truth is simple: inspect self\./i);
    expect(text).toMatch(/Simply inspect your thought\./i);
    expect(text).toMatch(/not a specification to implement, a theory to apply, or a principle to prove/i);
    expect(text).toMatch(/Practice approaches it\./i);
    expect(text).toMatch(/Agent Art is the medium of this age\./i);
    expect(inshell.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/docs/agent-art" }),
        expect.objectContaining({ href: "/docs/thought" }),
      ]),
    );
  });

  test("integrates truth and practice without promoting artistic meaning to technical proof", () => {
    const topicBySlug = new Map(
      DOCS_SOURCE.topics.map((topic) => [topic.slug, topicText(topic)]),
    );
    const expectedMeanings = new Map<string, RegExp[]>([
      [
        "agent-art",
        [
          /Agent Art is the medium of this age/i,
          /direction of that practice is simple: inspect self[\s\S]{0,180}not a definition or doctrine for Agent Art/i,
        ],
      ],
      [
        "movements",
        [
          /inward direction—inspect self/i,
          /without claiming to contain or prove truth/i,
        ],
      ],
      [
        "thought",
        [
          /simply inspect your thought/i,
          /does not resolve the thought or claim possession of its truth/i,
        ],
      ],
      [
        "path",
        [/does not measure self-knowledge, certify an inner truth/i],
      ],
      [
        "pulse",
        [
          /collective timing and choice available for inspection/i,
          /neither price nor timing measures inward progress or establishes possession of truth/i,
        ],
      ],
      [
        "contracts",
        [/do not implement the truth named by Inshell[^.]{0,120}prove a participant's inward understanding/i],
      ],
      [
        "artwork-metadata-chain",
        [/cannot prove the inward truth of the work or possess its meaning/i],
      ],
      [
        "verification",
        [
          /Verification here concerns bounded public claims/i,
          /not the truth named in Inshell's artistic position/i,
        ],
      ],
      [
        "design-principles",
        [
          /give the practice form as it approaches truth without claiming possession/i,
          /not a doctrine, a set of propositions to prove, or a definition of Agent Art/i,
        ],
      ],
    ]);

    for (const [slug, patterns] of expectedMeanings) {
      const text = topicBySlug.get(slug);
      expect(text).toBeDefined();
      for (const pattern of patterns) expect(text).toMatch(pattern);
    }

    expect([...topicBySlug.values()].join("\n")).not.toMatch(/\bsources? of truth\b/i);
  });

  test("reveals the Movements path from individual to crowd to core without filling unfinished work", () => {
    const movements = DOCS_SOURCE.topics.find(({ slug }) => slug === "movements");
    expect(movements).toBeDefined();
    if (!movements) return;

    const text = topicText(movements);
    expect(text).toMatch(
      /path from the individual[\s\S]{0,100}through the crowd[\s\S]{0,100}toward the core of Inshell/i,
    );
    expect(text).toMatch(/arc gives PATH its name and its design/i);
    expect(text).toMatch(
      /Agent participation remains the invariant[\s\S]{0,180}relation[\s\S]{0,120}change from movement to movement/i,
    );
    expect(text).toMatch(
      /THOUGHT begins with the individual[\s\S]{0,180}inspect a thought[\s\S]{0,180}one exact Agent response/i,
    );
    expect(text).toMatch(
      /WILL moves the inquiry from the individual to the crowd[\s\S]{0,220}crowd forms[\s\S]{0,80}one will/i,
    );
    expect(text).toMatch(
      /still being created and developed[\s\S]{0,260}not because Inshell is intentionally withholding a completed design/i,
    );
    expect(text).toMatch(
      /AWA turns from the crowd toward the core of Inshell[\s\S]{0,320}still forming[\s\S]{0,80}take time/i,
    );
    expect(text).toMatch(/PATH is the route and ledger, not a fourth movement/i);
    expect(text).toMatch(/not requirements for Agent Art as a field/i);

    expect(movements.figure?.mode).toBe("trace");
    expect(movements.figure?.items.map(({ title }) => title)).toEqual([
      "THOUGHT",
      "WILL",
      "AWA",
    ]);
    expect(movements.figure?.figureText).toMatch(
      /THOUGHT\s+→\s+WILL\s+→\s+AWA[\s\S]*INDIVIDUAL\s+CROWD\s+TOWARD THE CORE/i,
    );
    expect(movements.figure?.figureText).not.toContain("│");
    expect(DOCS_AUTHORITY_MAP.movements.figure).toEqual(["artist-editorial"]);
  });

  test("keeps focused movement pages integrated, linked, and honest about their state", () => {
    const movementTopics = new Map(
      DOCS_SOURCE.topics
        .filter(({ slug }) => ["movements", "thought", "will", "awa"].includes(slug))
        .map((topic) => [topic.slug, topic]),
    );
    const movements = movementTopics.get("movements");
    const thought = movementTopics.get("thought");
    const will = movementTopics.get("will");
    const awa = movementTopics.get("awa");

    expect([...movementTopics.keys()]).toEqual([
      "movements",
      "thought",
      "will",
      "awa",
    ]);
    if (!movements || !thought || !will || !awa) return;
    expect(thought?.status).toBe("current");
    expect(will?.status).toBe("study");
    expect(awa?.status).toBe("future");
    expect(will?.figure).toMatchObject({
      label: "Many people. Many Agents. One will.",
      mode: "field",
    });
    expect(awa?.figure).toMatchObject({
      label: "Toward the core",
      mode: "trace",
    });
    expect(will?.figure?.figureText).toMatch(
      /MANY PEOPLE[\s\S]*MANY AGENTS[\s\S]*ONE WILL/,
    );
    expect(awa?.figure?.figureText).toMatch(
      /THOUGHT\s+→\s+WILL\s+→\s+AWA\s+→\s+…[\s\S]*INDIVIDUAL\s+CROWD\s+TOWARD THE CORE/i,
    );
    expect(will?.figure?.figureText).not.toMatch(/2027|deploy|mint surface/i);
    expect(awa?.figure?.figureText).not.toMatch(/2028|deploy|mint surface/i);
    expect(DOCS_AUTHORITY_MAP.will.figure).toEqual(["artist-editorial"]);
    expect(DOCS_AUTHORITY_MAP.awa.figure).toEqual(["artist-editorial"]);

    expect(topicText(thought as DocsTopic)).toMatch(
      /first movement[\s\S]{0,100}begins with the individual[\s\S]{0,180}one Agent responds/i,
    );
    expect(topicText(will as DocsTopic)).toMatch(
      /second movement[\s\S]{0,180}crowd behavior[\s\S]{0,180}crowd forms[\s\S]{0,80}one will/i,
    );
    expect(topicText(will as DocsTopic)).toMatch(
      /still being created and developed[\s\S]{0,300}not intentional concealment of a completed design/i,
    );
    expect(topicText(awa as DocsTopic)).toMatch(
      /third movement[\s\S]{0,180}core of Inshell/i,
    );
    expect(topicText(awa as DocsTopic)).toMatch(/still forming[\s\S]{0,80}take time/i);
    expect(topicText(will as DocsTopic)).toMatch(/Agent participation keeps WILL within Agent Art/i);
    expect(topicText(awa as DocsTopic)).toMatch(/Agent participation keeps AWA within Agent Art/i);

    const expectedLinks = new Map([
      ["movements", ["/docs/thought", "/docs/will", "/docs/awa"]],
      ["thought", ["/docs/movements", "/docs/will", "/docs/awa"]],
      ["will", ["/docs/movements", "/docs/thought", "/docs/awa"]],
      ["awa", ["/docs/movements", "/docs/thought", "/docs/will"]],
    ]);
    for (const [slug, hrefs] of expectedLinks) {
      const topicHrefs = new Set(movementTopics.get(slug)?.links?.map(({ href }) => href));
      for (const href of hrefs) expect(topicHrefs.has(href)).toBe(true);
    }

    expect(movements?.sections?.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "docs-movements-thought",
        "docs-movements-will",
        "docs-movements-awa",
      ]),
    );
  });

  test("documents the current THOUGHT, PATH, and Pulse operating boundaries", () => {
    const thought = topicText(
      DOCS_SOURCE.topics.find(({ slug }) => slug === "thought") as DocsTopic,
    );
    const path = topicText(
      DOCS_SOURCE.topics.find(({ slug }) => slug === "path") as DocsTopic,
    );
    const pulse = topicText(
      DOCS_SOURCE.topics.find(({ slug }) => slug === "pulse") as DocsTopic,
    );

    expect(thought).toMatch(/sealed task/i);
    expect(thought).toMatch(/does not choose a PATH/i);
    expect(thought).toMatch(/direct mint/i);
    expect(thought).toMatch(/Unattested/i);

    expect(path).toMatch(/remaining entitlement/i);
    expect(path).toMatch(/permission epoch/i);
    expect(path).toMatch(/ERC-5192/i);
    expect(path).toMatch(/Spark PATH/i);

    expect(pulse).toMatch(/maximum acceptable price/i);
    expect(pulse).toMatch(/exact ask to the treasury/i);
    expect(pulse).toMatch(/refunds surplus value/i);
    expect(pulse).toMatch(/PathPulseAdapter/i);
  });

  test("documents the v0.5.0 movement-unit consume boundary without inventing per-token quotas", () => {
    const path = DOCS_SOURCE.topics.find(({ slug }) => slug === "path");
    const contracts = DOCS_SOURCE.topics.find(({ slug }) => slug === "contracts");
    const movements = DOCS_SOURCE.topics.find(({ slug }) => slug === "movements");
    expect(path).toBeDefined();
    expect(contracts).toBeDefined();
    expect(movements).toBeDefined();
    if (!path || !contracts || !movements) return;

    const pathText = topicText(path);
    expect(pathText).not.toMatch(/configured per movement and per PATH/i);
    expect(pathText).toMatch(
      /one quota and one authorized minter for each movement across the deployment[\s\S]{0,180}Every PATH uses those movement totals[\s\S]{0,180}each token stores its own current stage and in-stage minted count/i,
    );
    expect(pathText).toMatch(
      /v0\.5\.0 canonical deployment policy[\s\S]{0,100}THOUGHT 1[\s\S]{0,40}WILL 10[\s\S]{0,40}AWA 1/i,
    );
    expect(pathText).toMatch(/not a live chain observation/i);
    expect(pathText).toMatch(/read getMovementQuota[\s\S]{0,100}instead of hard-coding/i);

    const consumption = path.sections?.find(
      ({ id }) => id === "docs-path-consumption",
    );
    expect(consumption).toBeDefined();
    const consumptionText = (consumption?.paragraphs ?? [])
      .map(docsParagraphText)
      .join("\n");
    expect(consumptionText).toMatch(
      /EIP-191[\s\S]{0,300}PathNFT address[\s\S]{0,80}chain ID[\s\S]{0,80}PATH ID[\s\S]{0,80}movement[\s\S]{0,80}owner[\s\S]{0,80}configured movement minter[\s\S]{0,100}permission epoch[\s\S]{0,100}consume nonce[\s\S]{0,80}deadline/i,
    );
    expect(consumptionText).toMatch(
      /only the configured movement minter may call consumeUnit/i,
    );
    expect(consumptionText).toMatch(
      /checks the configured caller[\s\S]{0,160}current-owner authorization[\s\S]{0,120}fixed movement order[\s\S]{0,80}remaining quota/i,
    );
    expect(consumptionText).toMatch(
      /zero-based in-movement serial[\s\S]{0,140}consume nonce[\s\S]{0,120}increments that PATH's current count/i,
    );
    expect(consumptionText).toMatch(
      /count reaches the movement quota[\s\S]{0,120}advances to the next movement[\s\S]{0,100}resets its in-stage count/i,
    );
    expect(consumptionText).toMatch(
      /configured movement contract[\s\S]{0,180}same transaction[\s\S]{0,160}later mint step reverts[\s\S]{0,180}rolls back/i,
    );
    expect(consumptionText).toMatch(/canceled or failed flow consumes nothing/i);
    expect(DOCS_AUTHORITY_MAP.path.sections["docs-path-consumption"]).toEqual([
      "contract-release",
    ]);

    expect(consumption?.figure).toBeUndefined();
    expect(DOCS_AUTHORITY_MAP.path.sectionFigures).not.toHaveProperty(
      "docs-path-consumption",
    );
    expect(path.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/docs/contracts#docs-contracts-consumption",
        }),
        expect.objectContaining({
          href: "/protocol/releases/path-v0.5.0/DOWNSTREAM_HANDOFF.md",
        }),
      ]),
    );

    const contractText = topicText(contracts);
    expect(contractText).toMatch(
      /PathNFT owns permission accounting; the movement contract owns work validation and minting/i,
    );
    expect(contractText).toMatch(
      /If either half reverts, the transaction commits neither/i,
    );
    expect(
      DOCS_AUTHORITY_MAP.contracts.sections["docs-contracts-consumption"],
    ).toEqual(["contract-release"]);

    expect(topicText(movements)).not.toMatch(
      /EIP-191|permission epoch|consume nonce|configured movement minter/i,
    );
  });

  test("keeps internal documentation links on supported canonical App routes", () => {
    const unsupportedLinks = docsLinks()
      .filter(({ href }) => href.startsWith("/") && !href.startsWith("/protocol/"))
      .filter(({ href }) => !isSupportedDocsAppRoute(hrefPathname(href)))
      .map(({ topic, label, href }) => `${topic}: ${label} -> ${href}`);

    expect(unsupportedLinks).toEqual([]);
  });

  test("does not revive obsolete separate gallery routes or product subdomains", () => {
    const staleLinks = docsLinks()
      .filter(({ label, href }) => {
        if (/\bTHOUGHT gallery\b/i.test(label)) return true;

        const pathname = href.startsWith("/") ? hrefPathname(href) : null;
        if (pathname === "/gallery" || pathname === "/works") return true;

        try {
          const hostname = new URL(href).hostname.toLowerCase();
          return [
            "thought.inshell.art",
            "gallery.inshell.art",
            "thought.preview.inshell.art",
            "gallery.preview.inshell.art",
          ].includes(hostname);
        } catch {
          return false;
        }
      })
      .map(({ topic, label, href }) => `${topic}: ${label} -> ${href}`);

    expect(staleLinks).toEqual([]);
  });

  test("keeps internal schema links backed by public artifacts", () => {
    const missingArtifacts = docsLinks()
      .filter(({ href }) => href.startsWith("/protocol/"))
      .filter(({ href }) => {
        const path = nodePath.resolve(cwd(), "public", hrefPathname(href).slice(1));
        try {
          readFileSync(path);
          return false;
        } catch {
          return true;
        }
      })
      .map(({ topic, label, href }) => `${topic}: ${label} -> ${href}`);

    expect(missingArtifacts).toEqual([]);
  });

  test("does not duplicate a topic summary verbatim or near-identically in its opening paragraph", () => {
    const repeatedLeads = DOCS_SOURCE.topics.flatMap((topic) => {
      const similarity = highestContiguousWordSimilarity(
        topic.summary,
        docsParagraphText(topic.paragraphs[0] ?? ""),
      );
      return similarity >= SUMMARY_DUPLICATION_THRESHOLD
        ? [`${topic.slug} (${similarity.toFixed(2)})`]
        : [];
    });

    expect(repeatedLeads).toEqual([]);
  });

  test("keeps generated summaries and opening paragraphs aligned with the source", () => {
    const outputRoot = nodePath.resolve(cwd(), "public/docs");
    const index = JSON.parse(
      readFileSync(nodePath.join(outputRoot, "agent-index.json"), "utf8"),
    ) as {
      documents: Array<{ id: string; summary: string }>;
    };

    for (const topic of DOCS_SOURCE.topics) {
      const indexedTopic = index.documents.find((document) => document.id === topic.slug);
      expect(indexedTopic?.summary).toBe(topic.summary);

      const markdown = readFileSync(
        nodePath.join(outputRoot, `${topic.slug}.md`),
        "utf8",
      );
      expect(markdown.startsWith(`# ${topic.title}\n\n> ${topic.summary}\n`)).toBe(true);
      expect(markdown).toContain(
        [
          "## Overview",
          "",
          `- Authority: ${DOCS_AUTHORITY_MAP[topic.slug].lead.join(", ")}`,
          "",
          docsParagraphText(topic.paragraphs[0]),
          "",
        ].join("\n"),
      );
      if (topic.figure) {
        expect(markdown.indexOf(`## ${topic.figure.label}`)).toBeLessThan(
          markdown.indexOf(docsParagraphText(topic.paragraphs[0])),
        );
      }
    }
  });

  test("publishes the canonical gallery deployment context", () => {
    const outputRoot = nodePath.resolve(cwd(), "public");
    const index = JSON.parse(
      readFileSync(nodePath.join(outputRoot, "docs/agent-index.json"), "utf8"),
    ) as {
      liveReadOnlyResources: Array<{ title: string; url?: string }>;
      pageContexts: Array<{ route: string; topics: string[] }>;
    };

    expect(index.pageContexts.find(({ route }) => route === "/gallery")?.topics).toEqual([
      "thought",
      "artwork-metadata-chain",
      "verification",
    ]);
    expect(index.pageContexts.find(({ route }) => route === "/")?.topics).toEqual(
      expect.arrayContaining(["thought", "artwork-metadata-chain"]),
    );
    expect(
      index.liveReadOnlyResources.find(({ url }) => url === "/api/thought-gallery"),
    ).toMatchObject({ title: "THOUGHT gallery deployment state" });

    const sitemap = readFileSync(nodePath.join(outputRoot, "sitemap.xml"), "utf8");
    expect(sitemap).toContain("https://inshell.art/gallery");
  });

  test("keeps Agent Art broader than THOUGHT's prompt-response format", () => {
    const agentArt = DOCS_SOURCE.topics.find(({ slug }) => slug === "agent-art");
    expect(agentArt).toBeDefined();
    if (!agentArt) return;

    const text = topicText(agentArt);
    const missingDimensions = [
      ["open or variable relations", /\b(?:open|vary|varies|variable|different|another|other|change)\b/i],
      ["agency and roles", /\b(?:agency|role|participant|participate)\b/i],
      ["protocol or boundary", /\b(?:protocol|bound(?:ary|ed)?|constraint|rule)\b/i],
      ["visible form", /\b(?:form|render(?:er|ing)?|visual|composition)\b/i],
      ["optional traces or records", /\b(?:trace|record|metadata|provenance|evidence)\b/i],
    ]
      .filter(([, pattern]) => !(pattern as RegExp).test(text))
      .map(([dimension]) => dimension);

    expect(missingDimensions).toEqual([]);
  });

  test("defines Agent Art by Agent participation rather than an ideology or spirit", () => {
    const agentArt = DOCS_SOURCE.topics.find(({ slug }) => slug === "agent-art");
    expect(agentArt).toBeDefined();
    if (!agentArt) return;

    const text = topicText(agentArt);
    expect(text).toMatch(/\bart in which an Agent participates\b/i);
    expect(text).toMatch(/\bfield\b/i);
    expect(text).toMatch(/\bform\b/i);
    expect(text).toMatch(/\bnot\b[^.]{0,160}\b(?:agentic-ism|ideology)\b/i);
    expect(text).toMatch(/\bnot\b[^.]{0,160}\bspirit\b/i);
  });

  test("does not prescribe one human-Agent relation as Agent Art", () => {
    const agentArt = DOCS_SOURCE.topics.find(({ slug }) => slug === "agent-art");
    expect(agentArt).toBeDefined();
    if (!agentArt) return;

    const nonPrescription = agentArt.paragraphs.find(
      (statement) => {
        const text = docsParagraphText(statement);
        return (
          /\b(?:does not|doesn't|need not|is not required to)\b/i.test(text) &&
          /\b(?:help|assist)\w*\b/i.test(text) &&
          /\binject\w*\b/i.test(text) &&
          /\bcollaborat\w*\b/i.test(text) &&
          /\b(?:coauthorship|authorship)\b/i.test(text)
        );
      },
    );

    expect(nonPrescription).toBeDefined();
  });

  test("leaves Agent Art open through the source questions of Art and Agent", () => {
    const agentArt = DOCS_SOURCE.topics.find(({ slug }) => slug === "agent-art");
    expect(agentArt).toBeDefined();
    if (!agentArt) return;

    const text = topicText(agentArt);
    expect(text).toMatch(/\bWhat is Art\?/i);
    expect(text).toMatch(/\bWhat is an Agent\?/i);
  });

  test("places Inshell in the Agent Art field without making Inshell the field", () => {
    const agentArt = DOCS_SOURCE.topics.find(({ slug }) => slug === "agent-art");
    expect(agentArt).toBeDefined();
    if (!agentArt) return;

    const inshellStatements = topicText(agentArt)
      .split(/(?<=[.!?])\s+|\n+/)
      .filter((statement) => /\bInshell\b/i.test(statement));

    expect(inshellStatements.some((statement) => /\bworks? in (?:this|the) field\b/i.test(statement))).toBe(
      true,
    );
    expect(
      inshellStatements.some(
        (statement) => /\bInshell\b[^.]{0,160}\b(?:is not|does not equal)\b[^.]{0,80}\bfield\b/i.test(statement),
      ),
    ).toBe(true);
  });

  test("identifies THOUGHT as one practice or movement within broader Agent Art", () => {
    const relatedTopics = DOCS_SOURCE.topics.filter(({ slug }) =>
      ["agent-art", "movements", "thought"].includes(slug),
    );
    expect(new Set(relatedTopics.map(({ slug }) => slug))).toEqual(
      new Set(["agent-art", "movements", "thought"]),
    );

    const relationshipStatements = relatedTopics
      .flatMap((topic) => topicText(topic).split(/(?<=[.!?])\s+|\n+/))
      .filter((statement) => /\bTHOUGHT\b/i.test(statement))
      .filter((statement) => /\bAgent Art\b/i.test(statement))
      .filter((statement) => /\b(?:one|a|an)\b/i.test(statement))
      .filter((statement) => /\b(?:movement|practice|approach|form|example)\b/i.test(statement));

    expect(relationshipStatements.length).toBeGreaterThan(0);

    const agentArt = relatedTopics.find(({ slug }) => slug === "agent-art");
    expect(agentArt).toBeDefined();
    if (!agentArt) return;

    const agentArtText = topicText(agentArt);
    expect(agentArtText).toMatch(/\bTHOUGHT\b[^.]{0,100}\bone\b[^.]{0,100}\bpractice\b/i);
    expect(agentArtText).toMatch(
      /\bTHOUGHT\b[^.]{0,160}\bnot\b[^.]{0,80}\b(?:definition|boundary)\b/i,
    );
  });
});

describe("DocsPage navigation", () => {
  test("renders THOUGHT, WILL, and AWA as top-level siblings without a Movements submenu", () => {
    const { rerender } = render(<DocsPage topicSlug="movements" />);
    const documentationMenu = screen.getByRole("navigation", {
      name: "Documentation contents",
    });
    expect(
      within(documentationMenu).getByRole("link", { name: "Movements" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("group", { name: "Movements sections" }),
    ).not.toBeInTheDocument();

    for (const [title, slug] of [
      ["THOUGHT", "thought"],
      ["WILL", "will"],
      ["AWA", "awa"],
    ] as const) {
      const link = within(documentationMenu).getByRole("link", { name: title });
      expect(link).toHaveAttribute("href", `/docs/${slug}`);

      rerender(<DocsPage topicSlug={slug} />);
      expect(
        within(documentationMenu).getByRole("link", { name: title }),
      ).toHaveAttribute("aria-current", "page");
    }
  });
});

describe("DocsPage character figures", () => {
  const expectedModes = {
    "inshell:lead": "field",
    "inshell:docs-inshell-practice": "field",
    "agent-art:lead": "field",
    "movements:lead": "trace",
    "thought:docs-thought-work": "field",
    "thought:docs-thought-agent-handoff": "trace",
    "thought:docs-thought-provenance": "field",
    "will:lead": "field",
    "awa:lead": "trace",
    "path:docs-path-capacity": "ledger",
    "pulse:docs-pulse-serial": "trace",
    "contracts:docs-contracts-responsibilities": "lanes",
    "artwork-metadata-chain:lead": "field",
    "mono-76:lead": "trace",
    "wallet-local-data:lead": "field",
    "source-release-boundaries:lead": "field",
    "design-principles:lead": "field",
    "design-principles:docs-design-selection": "lanes",
    "design-principles:docs-design-canonical": "field",
  } as const;

  const expectedForms = {
    "inshell.inward-direction": "axis",
    "inshell.practice-truth": "axis",
    "agent-art.open-field": "field",
    "movements.arc": "trace",
    "thought.prompt-response": "axis",
    "thought.creative-handoff": "trace",
    "thought.creation-attestation": "fork",
    "will.open-field": "field",
    "awa.open-horizon": "trace",
    "path.capacity-progress": "ledger",
    "pulse.epoch": "cycle",
    "contracts.handoffs": "lanes",
    "evidence.interpretation": "fork",
    "mono-76.canonical-artwork": "trace",
    "wallet.distinctions": "ledger",
    "source-release.records": "axis",
    "design.principles": "field",
    "design.preservation": "lanes",
    "design.reading-surfaces": "fork",
  } as const satisfies Readonly<Record<string, DocsFigureForm>>;

  const expectedFieldShapes = {
    "The inward direction": "contained-axis",
    "How practice relates to truth": "framed-directed-relation",
    "The invariant and the open field": "open-invariant-field",
    "One prompt, one response": "prompt-response",
    "Creation Attestation": "attestation-flow-fork",
    "Many people. Many Agents. One will.": "open-will-field",
    "Evidence becomes interpretation": "evidence-interpretation",
    "Two distinctions": "distinction-comparisons",
    "Four distinct records": "record-comparison",
    "Current Inshell principles across systems": "open-principle-set",
    "Many surfaces, one identified record": "canonical-source-flow",
  } as const;

  const expectedFieldAnnotationCounts = {
    "The inward direction": 3,
    "How practice relates to truth": 3,
    "The invariant and the open field": 3,
    "One prompt, one response": 1,
    "Creation Attestation": 5,
    "Many people. Many Agents. One will.": 1,
    "Evidence becomes interpretation": 5,
    "Two distinctions": 5,
    "Four distinct records": 4,
    "Current Inshell principles across systems": 5,
    "Many surfaces, one identified record": 2,
  } as const;

  const expectedFrameCounts: Readonly<Record<string, number>> = {
    "inshell.inward-direction": 1,
    "inshell.practice-truth": 2,
    "design.reading-surfaces": 1,
  };

  function normalizedFigureText(value: string) {
    return value.replace(/│/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  test("resolves source nodes and relations independently of edge array order", () => {
    const awaFigure = allFigureEntries().find(
      ({ figure }) => figure.id === "awa.open-horizon",
    )?.figure;
    const pulseFigure = allFigureEntries().find(
      ({ figure }) => figure.id === "pulse.epoch",
    )?.figure;
    const pathFigure = allFigureEntries().find(
      ({ figure }) => figure.id === "path.capacity-progress",
    )?.figure;
    expect(awaFigure).toBeDefined();
    expect(pulseFigure).toBeDefined();
    expect(pathFigure).toBeDefined();

    const awaLogic = docsFigureLogic(awaFigure as DocsFigure);
    const reorderedAwaLogic = {
      ...awaLogic,
      edges: [...awaLogic.edges].reverse(),
    };
    const thought = resolveSourceNode(reorderedAwaLogic, 0);
    const will = resolveSourceNode(reorderedAwaLogic, 1);
    const awa = resolveSourceNode(reorderedAwaLogic, 2);
    expect(resolveEdgeByEndpoints(reorderedAwaLogic, thought.id, will.id).id)
      .toBe("thought-to-will");
    expect(resolveEdgeByEndpoints(reorderedAwaLogic, will.id, awa.id).id)
      .toBe("will-toward-awa");

    const pulseLogic = docsFigureLogic(pulseFigure as DocsFigure);
    const reorderedPulseLogic = {
      ...pulseLogic,
      edges: [pulseLogic.edges[2], pulseLogic.edges[0], pulseLogic.edges[1]],
    };
    const ask = resolveSourceNode(reorderedPulseLogic, 0);
    const nextAsk = resolveSourceNode(reorderedPulseLogic, 2);
    expect(resolveEdgeByEndpoints(reorderedPulseLogic, nextAsk.id, ask.id).id)
      .toBe("next-epoch-loop");

    const pathLogic = docsFigureLogic(pathFigure as DocsFigure);
    expect(resolveSourceNode(pathLogic, 0, "title").id).toBe("capacity");
    expect(resolveSourceNode(pathLogic, 0, "detail").id).toBe("progress");
    expect(() => resolveSourceNode(pathLogic, 0)).toThrow(
      /no semantic node for source item 0 part "item"/i,
    );
  });

  test("uses each mode only where its relationship fits", () => {
    expect(
      Object.fromEntries(
        allFigureEntries().map(({ key, figure }) => [key, figure.mode]),
      ),
    ).toEqual(expectedModes);
    expect(
      new Set(allFigureEntries().map(({ figure }) => figure.mode)),
    ).toEqual(new Set(DOCS_FIGURE_MODES));

    expect(
      DOCS_SOURCE.topics
        .filter((topic) => !topic.figure)
        .map(({ slug }) => slug),
    ).toEqual(["thought", "path", "pulse", "contracts", "verification"]);
    expect(
      DOCS_SOURCE.topics.flatMap((topic) => topic.sections ?? []).filter(
        (section) => !section.figure,
      ).length,
    ).toBeGreaterThan(allFigureEntries().length);
  });

  test("publishes one stable literal semantic graph for every figure", () => {
    const entries = allFigureEntries();
    const formById: Readonly<Record<string, DocsFigureForm>> = expectedForms;
    expect(entries).toHaveLength(19);
    expect(entries.map(({ figure }) => figure.id)).toEqual(
      expect.arrayContaining(DOCS_FIGURE_LOGIC_IDS),
    );
    expect(new Set(entries.map(({ figure }) => figure.id)).size).toBe(
      entries.length,
    );
    expect(new Set(DOCS_FIGURE_FORMS)).toEqual(
      new Set(Object.values(expectedForms)),
    );

    for (const { figure } of entries) {
      const logic = docsFigureLogic(figure);
      expect(validateDocsFigureLogic(figure, logic)).toEqual({
        valid: true,
        errors: [],
      });
      expect(logic.id).toBe(figure.id);
      expect(logic.label).toBe(figure.label);
      expect(logic.form).toBe(formById[figure.id]);

      const nodeIds = new Set(logic.nodes.map(({ id }) => id));
      const groupIds = new Set(logic.groups.map(({ id }) => id));
      const endpointIds = new Set([...nodeIds, ...groupIds]);
      expect([...nodeIds].filter((id) => groupIds.has(id))).toEqual([]);
      for (const edge of logic.edges) {
        expect(endpointIds).toContain(edge.from);
        expect(endpointIds).toContain(edge.to);
        expect(edge.glyph.trim()).not.toBe("");
        expect(edge.label.trim()).not.toBe("");
        expect(
          figure.figureText.includes(edge.glyph) ||
            (edge.stackedGlyph !== undefined &&
              figure.figureText.includes(edge.stackedGlyph)),
        ).toBe(true);
      }
      for (const group of logic.groups) {
        expect(group.members.length).toBeGreaterThan(0);
        for (const member of group.members) expect(nodeIds).toContain(member);
        if (group.glyph) {
          for (const glyph of group.glyph.split(/\s*\/\s*/)) {
            expect(figure.figureText).toContain(glyph);
          }
        }
      }
    }

    const prompt = docsFigureLogic(
      entries.find(({ figure }) => figure.id === "thought.prompt-response")
        ?.figure as DocsFigure,
    );
    expect(prompt.groups).toContainEqual(
      expect.objectContaining({
        id: "thought-equation",
        glyph: "+",
        members: ["human-prompt", "agent-response"],
      }),
    );
    expect(prompt.edges).toEqual([
      expect.objectContaining({
        id: "pair-forms-thought",
        from: "thought-equation",
        to: "one-thought",
        glyph: "↓",
      }),
    ]);
  });

  test("keeps every impression and figure record in literal character text", () => {
    for (const { figure } of allFigureEntries()) {
      expect(figure.figureText).not.toMatch(/\t| +$/m);
      expect(Math.max(...figure.figureText.split("\n").map((line) => line.length)))
        .toBeLessThanOrEqual(80);

      const normalized = normalizedFigureText(figure.figureText);
      for (const item of figure.items) {
        expect(normalized).toContain(normalizedFigureText(item.title));
        if (item.detail) {
          expect(normalized).toContain(normalizedFigureText(item.detail));
        }
        if (figure.mode === "lanes" && "lane" in item) {
          expect(normalized).toContain(normalizedFigureText(item.lane));
          if (item.phase) {
            expect(normalized).toContain(normalizedFigureText(item.phase));
          }
        }
      }

      if (figure.mode === "trace") {
        expect(figure.figureText).toMatch(/[→↓]/);
        if (figure.loop) {
          expect(figure.figureText).toContain("↺");
          expect(normalized).toContain(normalizedFigureText(figure.loop.condition));
        }
      } else if (figure.mode === "ledger") {
        expect(figure.figureText).toContain("≠");
        expect(figure.figureText).not.toMatch(/[│┼]/);
      } else if (figure.mode === "lanes") {
        expect(figure.figureText).toContain("→");
        expect(figure.figureText).not.toContain("│");
      } else {
        expect(figure.figureText).toMatch(/[┌┐└┘├┬│↓↑→≠•]/);
      }

      if (["wallet.distinctions", "source-release.records"].includes(figure.id)) {
        expect(figure.figureText).toContain("≠");
        expect(figure.figureText).not.toMatch(/[┌┐└┘│]/);
      }
    }
  });

  test("keeps every closed character frame on one column grid", () => {
    for (const { key, figure } of allFigureEntries()) {
      const lines = figure.figureText.split("\n").map((line) => [...line]);

      for (let start = 0; start < lines.length; start += 1) {
        const left = lines[start].indexOf("┌");
        const right = lines[start].lastIndexOf("┐");
        if (left < 0 || right < 0) continue;

        const end = lines.findIndex(
          (line, index) =>
            index > start && line[left] === "└" && line.includes("┘"),
        );
        expect(end).toBeGreaterThan(start);
        if (end <= start) continue;

        expect(lines[end][right]).toBe("┘");
        for (let row = start + 1; row < end; row += 1) {
          expect(["│", "├"]).toContain(lines[row][left]);
          expect(["│", "┤"]).toContain(lines[row][right]);
          expect(lines[row].length).toBe(lines[start].length);
        }

        start = end;
      }
    }
  });

  test("scopes each figure to an apt lead or section without inventing forming work", () => {
    const topics = new Map(DOCS_SOURCE.topics.map((topic) => [topic.slug, topic]));
    const inshellFigure = topics.get("inshell")?.figure?.figureText ?? "";
    const agentArtFigure = topics.get("agent-art")?.figure?.figureText ?? "";
    const inshellPracticeFigure = topics
      .get("inshell")
      ?.sections?.find(({ id }) => id === "docs-inshell-practice")?.figure;
    const pathCapacityFigure = topics
      .get("path")
      ?.sections?.find(({ id }) => id === "docs-path-capacity")?.figure;

    expect(inshellFigure).toMatch(
      /A BODY, FACE, OR HEAD[\s\S]*REPUTATION, ROLE\.\.\.[\s\S]*SHELL[\s\S]*IN[\s\S]*SELF/i,
    );
    expect(inshellFigure).not.toMatch(/BOUNDARY/);
    expect(inshellPracticeFigure?.figureText).toMatch(
      /TRUTH[\s\S]*INSPECT SELF[\s\S]*↑[\s\S]*APPROACHES WITHOUT CLAIMING POSSESSION[\s\S]*PRACTICE/i,
    );
    expect(inshellPracticeFigure?.figureText).not.toMatch(
      /TRUTH AND PRACTICE/,
    );
    expect(inshellPracticeFigure?.figureText).not.toMatch(
      /RELATION|BOUNDARY|DOES NOT PROVE/,
    );
    expect(agentArtFigure).toMatch(
      /AGENT ART[\s\S]*An Agent participates[\s\S]*• What is Art\?[\s\S]*• What is an Agent\?/i,
    );
    expect(agentArtFigure).not.toMatch(/\bINVARIANT\b|OPEN QUESTIONS/i);
    expect(agentArtFigure).not.toMatch(/NO PRESCRIBED RELATION/);
    expect(pathCapacityFigure?.figureText).toMatch(
      /DEPLOYMENT[\s\S]*EACH PATH[\s\S]*MOVEMENT QUOTA[\s\S]*USED \+ REMAINING/,
    );

    for (const [slug, sectionId] of [
      ["movements", "docs-movements-agent-art"],
      ["path", "docs-path-consumption"],
      ["pulse", "docs-pulse-live-price"],
      ["verification", "docs-verification-levels"],
      ["verification", "docs-verification-checklist"],
    ] as const) {
      expect(
        topics
          .get(slug)
          ?.sections?.find(({ id }) => id === sectionId)?.figure,
      ).toBeUndefined();
      expect(
        DOCS_AUTHORITY_MAP[slug].sectionFigures?.[sectionId],
      ).toBeUndefined();
    }
    expect(allFigureEntries().map(({ figure }) => figure.label).join("\n")).not.toMatch(
      /at a glance/i,
    );
    expect(DOCS_AUTHORITY_MAP.inshell.figure).toEqual(["artist-editorial"]);
    expect(DOCS_AUTHORITY_MAP["agent-art"].figure).toEqual(["artist-editorial"]);
    expect(DOCS_AUTHORITY_MAP.inshell.sectionFigures).toEqual({
      "docs-inshell-practice": ["artist-editorial"],
    });
  });

  test("renders every figure as selectable character topology without a duplicate disclosure", () => {
    for (const topic of DOCS_SOURCE.topics) {
      render(<DocsPage topicSlug={topic.slug} />);
      for (const { sectionId, figure: sourceFigure } of topicFigureEntries(topic)) {
        const figure = screen.getByRole("figure", { name: sourceFigure.label });
        const logic = docsFigureLogic(sourceFigure);
        expect(figure).toHaveAttribute("data-figure-mode", sourceFigure.mode);
        expect(figure).toHaveAttribute("data-figure-id", sourceFigure.id);
        expect(figure).toHaveAttribute("data-figure-form", logic.form);
        expect(JSON.parse(figure.getAttribute("data-figure-logic") ?? "null"))
          .toEqual(logic);
        expect(
          figure.querySelector(
            ".docs-figure__source, .docs-figure__text, details, pre, svg, canvas, img",
          ),
        ).toBeNull();
        expect(figure.textContent).not.toContain(sourceFigure.figureText);

        const visual = figure.querySelector(".docs-figure__visual");
        expect(visual).not.toBeNull();
        expect(
          visual?.querySelectorAll(".docs-figure__character-frame"),
        ).toHaveLength(expectedFrameCounts[sourceFigure.id] ?? 0);
        expect(
          visual?.querySelectorAll(".docs-figure__term").length,
        ).toBeGreaterThanOrEqual(sourceFigure.items.length);
        for (const annotation of [
          ...(visual?.querySelectorAll(".docs-figure__annotation") ?? []),
        ]) {
          expect(annotation.textContent?.trim()).not.toBe("");
        }
        for (const item of sourceFigure.items) {
          expect(visual).toHaveTextContent(item.title);
          if (item.detail) expect(visual).toHaveTextContent(item.detail);
        }
        for (const node of logic.nodes) {
          expect(visual?.textContent?.toLocaleLowerCase("en-US")).toContain(
            node.term.toLocaleLowerCase("en-US"),
          );
          if (node.annotation) {
            expect(visual?.textContent?.toLocaleLowerCase("en-US")).toContain(
              node.annotation.toLocaleLowerCase("en-US"),
            );
          }
        }
        for (const edge of logic.edges) {
          expect(
            visual?.textContent?.includes(edge.glyph) ||
              (edge.stackedGlyph !== undefined &&
                visual?.textContent?.includes(edge.stackedGlyph)),
          ).toBe(true);
        }
        for (const group of logic.groups) {
          if (!group.glyph) continue;
          for (const glyph of group.glyph.split(/\s*\/\s*/)) {
            expect(visual).toHaveTextContent(glyph);
          }
        }

        if (sourceFigure.mode === "trace") {
          const trace = visual?.querySelector(".docs-figure__shape-trace");
          expect(
            visual?.querySelector("ol.docs-figure__shape-trace-list"),
          ).not.toBeNull();
          expect(
            [
              ...(trace?.querySelectorAll<HTMLElement>(
                ".docs-figure__shape-trace-node[data-figure-node-id]",
              ) ?? []),
            ].map((node) => node.dataset.figureNodeId),
          ).toEqual(logic.nodes.map(({ id }) => id));
          const renderedEdges = [
            ...(trace?.querySelectorAll<HTMLElement>(
              "[data-figure-edge-id]",
            ) ?? []),
          ];
          expect(renderedEdges.map((edge) => edge.dataset.figureEdgeId)).toEqual(
            logic.edges.map(({ id }) => id),
          );
          for (const edge of logic.edges) {
            const renderedEdge = renderedEdges.find(
              (candidate) => candidate.dataset.figureEdgeId === edge.id,
            );
            expect(renderedEdge).toHaveAttribute("aria-label", edge.label);
            expect(
              renderedEdge?.textContent?.includes(edge.glyph) ||
                (edge.stackedGlyph !== undefined &&
                  renderedEdge?.textContent?.includes(edge.stackedGlyph)),
            ).toBe(true);
          }
          expect(
            trace?.querySelector(".docs-figure__shape-trace-item-rail"),
          ).toBeNull();
          expect(visual?.querySelector(".docs-figure__marker")).toBeNull();
          if (sourceFigure.loop) {
            expect(trace).toHaveAttribute("data-trace-layout", "cycle");
            expect(
              trace?.querySelector(".docs-figure__shape-trace-return"),
            ).toHaveAttribute("data-return-to", "ask");
            expect(visual).toHaveTextContent(sourceFigure.loop.condition);
          } else {
            expect(trace).toHaveAttribute(
              "data-trace-layout",
              {
                "movements.arc": "sequence",
                "thought.creative-handoff": "sequence",
                "awa.open-horizon": "sequence",
                "mono-76.canonical-artwork": "stack",
              }[sourceFigure.id],
            );
          }
        } else if (sourceFigure.mode === "ledger") {
          const comparison = visual?.querySelector(
            ".docs-figure__shape-ledger[data-figure-shape='capacity-comparison']",
          );
          expect(comparison).not.toBeNull();
          expect(
            [
              ...(comparison?.querySelectorAll<HTMLElement>(
                "[data-figure-node-id]",
              ) ?? []),
            ].map((node) => node.dataset.figureNodeId),
          ).toEqual(["capacity", "progress"]);
          const relation = comparison?.querySelector(
            "[data-figure-edge-id='capacity-not-progress']",
          );
          expect(relation).toHaveAttribute("role", "img");
          expect(relation).toHaveTextContent("≠");
          expect(relation).toHaveClass(
            "docs-figure__shape-ledger-relation--governing",
          );
          expect(comparison).toHaveTextContent(/Deployment[\s\S]*Each PATH/);
          expect(comparison?.textContent).not.toMatch(/[│┼]/);
          expect(
            comparison?.querySelector(
              ".docs-figure__shape-ledger-rail, .docs-figure__shape-ledger-rule, [role='table']",
            ),
          ).toBeNull();
        } else if (sourceFigure.mode === "lanes") {
          const lanes = visual?.querySelector(".docs-figure__lanes");
          expect(lanes).toHaveClass("docs-figure__lanes--open");
          expect(visual).toHaveTextContent("→");
          expect(visual?.textContent).not.toContain("│");
          expect(visual?.querySelector(".docs-figure__lane-axis")).toBeNull();
          expect(visual?.querySelector(".docs-figure__marker")).toBeNull();
          expect(
            visual?.querySelector(
              ".docs-figure__lane-rail, .docs-figure__lane-separator, [style]",
            ),
          ).toBeNull();
          expect(
            [
              ...(lanes?.querySelectorAll<HTMLElement>(
                ".docs-figure__lane-event[data-figure-node-id]",
              ) ?? []),
            ].map((node) => node.dataset.figureNodeId),
          ).toEqual(logic.nodes.map(({ id }) => id));
          expect(
            [
              ...(lanes?.querySelectorAll<HTMLElement>(
                ".docs-figure__lane-relation[data-figure-edge-id]",
              ) ?? []),
            ].map((edge) => edge.dataset.figureEdgeId),
          ).toEqual(logic.edges.map(({ id }) => id));
          expect(
            new Set(
              [
                ...(lanes?.querySelectorAll<HTMLElement>(
                  "[data-figure-group-id]",
                ) ?? []),
              ].map((group) => group.dataset.figureGroupId),
            ),
          ).toEqual(new Set(logic.groups.map(({ id }) => id)));
          expect(
            [...(lanes?.querySelectorAll(".docs-figure__annotation") ?? [])].map(
              (annotation) => annotation.textContent,
            ),
          ).toEqual(
            logic.nodes.flatMap(({ annotation }) =>
              annotation === undefined ? [] : [annotation],
            ),
          );
        } else {
          const shape = visual?.querySelector<HTMLElement>("[data-figure-shape]");
          expect(shape).not.toBeNull();
          expect(shape).not.toHaveAttribute("data-figure-shape", "field-branches");
          expect(shape).toHaveAttribute(
            "data-figure-shape",
            expectedFieldShapes[
              sourceFigure.label as keyof typeof expectedFieldShapes
            ],
          );
          expect(
            visual?.querySelectorAll(".docs-figure__annotation"),
          ).toHaveLength(
            expectedFieldAnnotationCounts[
              sourceFigure.label as keyof typeof expectedFieldAnnotationCounts
            ],
          );
        }
        if (sectionId) {
          expect(figure.parentElement).toHaveClass("docs-topic__section");
          expect(figure.previousElementSibling).toHaveAttribute("id", sectionId);
          expect(figure.previousElementSibling?.tagName).toBe("H3");
        } else {
          expect(figure.previousElementSibling).toHaveClass("docs-topic__header");
        }
      }
      cleanup();
    }
  });

  test("renders semantic lane groups as open chains without stage scaffolding", () => {
    const cases = [
      {
        slug: "contracts",
        id: "contracts.handoffs",
        label: "Contract handoffs across issuance and minting",
        layout: "phase",
        chainGroups: [
          {
            id: "public-issuance-phase",
            nodes: ["pulse-settle", "adapter-issue", "path-record"],
            edges: ["settle-to-issue", "issue-to-record"],
          },
          {
            id: "later-thought-mint-phase",
            nodes: ["thought-validate", "path-consume", "thought-mint"],
            edges: ["validate-to-consume", "consume-to-mint"],
          },
        ],
      },
      {
        slug: "design-principles",
        id: "design.preservation",
        label: "Two preservation boundaries",
        layout: "parallel",
        chainGroups: [
          {
            id: "thought-preservation-lane",
            nodes: [
              "thought-agent-return",
              "thought-human-review",
              "thought-successful-mint",
              "thought-public-corpus",
            ],
            edges: [
              "thought-return-to-review",
              "thought-review-to-mint",
              "thought-mint-to-corpus",
            ],
          },
          {
            id: "pulse-preservation-lane",
            nodes: [
              "pulse-visible-ask",
              "pulse-confirmed-bid",
              "pulse-settlement",
              "pulse-sale-record",
            ],
            edges: [
              "pulse-ask-to-bid",
              "pulse-bid-to-settlement",
              "pulse-settlement-to-record",
            ],
          },
        ],
      },
    ] as const;

    for (const laneCase of cases) {
      const sourceFigure = allFigureEntries().find(
        ({ figure }) => figure.id === laneCase.id,
      )?.figure;
      expect(sourceFigure).toBeDefined();
      const logic = docsFigureLogic(sourceFigure as DocsFigure);

      render(<DocsPage topicSlug={laneCase.slug} />);
      const renderedFigure = screen.getByRole("figure", {
        name: laneCase.label,
      });
      const lanes = renderedFigure.querySelector<HTMLElement>(
        ".docs-figure__lanes",
      );
      expect(lanes).toHaveClass("docs-figure__lanes--open");
      expect(lanes).toHaveAttribute("data-lane-layout", laneCase.layout);
      expect(lanes).not.toHaveAttribute("style");
      expect(
        lanes?.querySelector(
          ".docs-figure__lane-axis, .docs-figure__lane-rail, .docs-figure__lane-separator, [style]",
        ),
      ).toBeNull();
      expect(lanes?.textContent).not.toContain("│");

      const chainSections = [
        ...(lanes?.querySelectorAll<HTMLElement>(
          ":scope > .docs-figure__lane-chain[data-figure-group-id]",
        ) ?? []),
      ];
      expect(
        chainSections.map((section) => section.dataset.figureGroupId),
      ).toEqual(laneCase.chainGroups.map(({ id }) => id));

      for (const expectedGroup of laneCase.chainGroups) {
        const chain = chainSections.find(
          (section) => section.dataset.figureGroupId === expectedGroup.id,
        );
        expect(chain).toBeDefined();
        expect(
          [
            ...(chain?.querySelectorAll<HTMLElement>(
              ".docs-figure__lane-event[data-figure-node-id]",
            ) ?? []),
          ].map((event) => event.dataset.figureNodeId),
        ).toEqual([...expectedGroup.nodes]);
        expect(
          [
            ...(chain?.querySelectorAll<HTMLElement>(
              ".docs-figure__lane-relation[data-figure-edge-id]",
            ) ?? []),
          ].map((relation) => relation.dataset.figureEdgeId),
        ).toEqual([...expectedGroup.edges]);
      }

      expect(
        new Set(
          [
            ...(lanes?.querySelectorAll<HTMLElement>(
              "[data-figure-group-id]",
            ) ?? []),
          ].map((group) => group.dataset.figureGroupId),
        ),
      ).toEqual(new Set(logic.groups.map(({ id }) => id)));
      expect(
        [...(lanes?.querySelectorAll(".docs-figure__annotation") ?? [])].map(
          (annotation) => annotation.textContent,
        ),
      ).toEqual(
        logic.nodes.flatMap(({ annotation }) =>
          annotation === undefined ? [] : [annotation],
        ),
      );
      expect(
        [...(lanes?.querySelectorAll(".docs-figure__lane-relation") ?? [])]
          .every((relation) =>
            relation.classList.contains(
              "docs-figure__lane-relation--governing",
            ),
          ),
      ).toBe(true);
      cleanup();
    }
  });

  test("dispatches all current field figures to a distinct shape-preserving renderer", () => {
    const fieldLabels = allFigureEntries()
      .filter(({ figure }) => figure.mode === "field")
      .map(({ figure }) => figure.label)
      .sort();

    expect(fieldLabels).toEqual(Object.keys(expectedFieldShapes).sort());
    expect(new Set(Object.values(expectedFieldShapes))).toHaveProperty(
      "size",
      Object.keys(expectedFieldShapes).length,
    );
  });

  test("preserves representative box, chain, segment, fork, arc, and source-flow impressions", () => {
    render(<DocsPage topicSlug="inshell" />);
    const inwardFigure = screen.getByRole("figure", {
      name: "The inward direction",
    });
    const inward = inwardFigure.querySelector(
      "[data-figure-shape='contained-axis']",
    );
    const practice = screen
      .getByRole("figure", { name: "How practice relates to truth" })
      .querySelector("[data-figure-shape='framed-directed-relation']");

    expect(inward).toHaveTextContent(/SHELL[\s\S]*a body, face, or head/i);
    expect(inward).toHaveTextContent(/└─+┘/);
    expect(
      inward?.querySelector(".docs-figure__frame-cap--balanced"),
    ).not.toBeNull();
    expect(
      inward?.querySelectorAll(
        ".docs-figure__frame-cap--balanced .docs-figure__frame-rule",
      ),
    ).toHaveLength(2);
    const inwardFrame = inward?.querySelector(
      ":scope > .docs-figure__character-frame",
    );
    const inwardCap = inwardFrame?.querySelector(
      ":scope > .docs-figure__frame-cap--balanced",
    );
    const inwardLeftCap = inwardCap?.querySelector(
      ":scope > .docs-figure__frame-cap-half--left",
    );
    const inwardHeading = inwardLeftCap?.querySelector(
      ":scope > .docs-figure__frame-heading",
    );
    const inwardNote = inwardLeftCap?.querySelector(
      ":scope > .docs-figure__field-inward-note",
    );
    expect(inwardNote).toHaveTextContent(
      /a body, face, or head; a name, honor, reputation, role\.\.\./i,
    );
    expect(inwardHeading?.nextElementSibling).toBe(inwardNote);
    expect(inwardNote?.nextElementSibling).toHaveClass(
      "docs-figure__frame-rule",
    );
    expect(inwardLeftCap).toHaveTextContent(/┌─\s*SHELL[\s\S]*─/i);
    expect(inwardCap).not.toHaveTextContent(/┬/);
    expect(inwardCap).toHaveTextContent(/─[\s\S]*┐/);
    expect(inwardNote?.parentElement).toBe(inwardLeftCap);
    expect(
      inwardFrame?.querySelector(".docs-figure__frame-content"),
    ).not.toHaveTextContent(/a body, face, or head/i);
    expect(
      inward?.querySelector(".docs-figure__frame-content"),
    ).toHaveTextContent(/SELF/i);
    expect(
      JSON.parse(
        inwardFigure.getAttribute("data-figure-logic") ?? "null",
      ).groups.find(({ id }: { id: string }) => id === "shell-boundary")
        ?.members,
    ).toEqual(["shell", "in", "self"]);
    const inwardArrow = inward?.querySelector(
      ".docs-figure__field-inward-arrow[role='img']",
    );
    expect(inwardArrow).toHaveAttribute(
      "aria-label",
      "In directs inspection toward the self.",
    );
    expect(inwardArrow).toHaveClass("docs-figure__field-inward-arrow");
    expect(inward?.querySelector(".docs-figure__field-inward-axis"))
      .toHaveTextContent(/↓\s*IN/i);
    expect(
      inward?.querySelector(".docs-figure__field-inward-label"),
    ).toHaveClass("docs-figure__annotation");
    const inwardLogic = JSON.parse(
      inwardFigure.getAttribute("data-figure-logic") ?? "null",
    );
    expect(inwardLogic.edges).toEqual([
      expect.objectContaining({
        id: "inspect-self",
        from: "in",
        to: "self",
        glyph: "↓",
      }),
    ]);
    expect(inward?.querySelector(".docs-figure__field-tail")).toHaveTextContent(
      /↓\s*IN[\s\S]*Inspect what forms the[\s\S]*self/i,
    );
    const practiceRelation = practice?.querySelector(
      ".docs-figure__field-practice-relation",
    );
    const practiceConnectors = [
      ...(practiceRelation?.querySelectorAll(".docs-figure__glyph") ?? []),
    ];
    expect(practiceConnectors).toHaveLength(1);
    for (const connector of practiceConnectors) {
      expect(connector.textContent).toBe("↑");
    }
    expect(practiceConnectors[0]).toHaveClass(
      "docs-figure__field-practice-arrow",
    );
    const practiceFigure = screen.getByRole("figure", {
      name: "How practice relates to truth",
    });
    const practiceLogic = JSON.parse(
      practiceFigure.getAttribute("data-figure-logic") ?? "null",
    );
    expect(practice).toHaveTextContent(/TRUTH[\s\S]*↑[\s\S]*PRACTICE/i);
    expect(
      practice?.querySelectorAll(":scope .docs-figure__character-frame"),
    ).toHaveLength(2);
    const practiceFrames = [
      ...(practice?.querySelectorAll(".docs-figure__character-frame") ?? []),
    ];
    const practiceChain = practice?.querySelector(
      ":scope > .docs-figure__field-chain",
    );
    expect([...(practiceChain?.children ?? [])]).toEqual([
      practiceFrames[0],
      practiceRelation,
      practiceFrames[1],
    ]);
    expect(practiceRelation?.closest(".docs-figure__character-frame"))
      .toBeNull();
    expect(practiceFrames[0]).toHaveTextContent(/TRUTH[\s\S]*Inspect self/i);
    expect(practiceFrames[1]).toHaveTextContent(
      /PRACTICE[\s\S]*Examine[\s\S]*feel/i,
    );
    expect(practice?.querySelectorAll(".docs-figure__frame-heading"))
      .toHaveLength(0);
    expect(practiceFrames[0]).toHaveTextContent(/┌─+[\s\S]*└─+┘/);
    expect(practiceFrames[1]).toHaveTextContent(/┌─+[\s\S]*└─+┘/);
    expect(practiceLogic.nodes.map(({ id }: { id: string }) => id)).toEqual([
      "truth",
      "practice",
    ]);
    expect(practiceLogic.edges).toEqual([
      expect.objectContaining({
        from: "practice",
        to: "truth",
        glyph: "↑",
      }),
    ]);
    expect(practiceLogic.groups).toEqual([]);
    expect(practiceRelation).toHaveTextContent(
      "Approaches without claiming possession",
    );
    expect(practice).toHaveTextContent(
      "Examine · inspect · suspect · read · listen · feel",
    );
    expect(practice).not.toHaveTextContent(/RELATION|BOUNDARY/i);
    cleanup();

    render(<DocsPage topicSlug="agent-art" />);
    const openAgentArt = screen
      .getByRole("figure", { name: "The invariant and the open field" })
      .querySelector("[data-figure-shape='open-invariant-field']");
    expect(openAgentArt).toHaveTextContent(
      /AGENT ART[\s\S]*An Agent participates in the art activity[\s\S]*•[\s\S]*WHAT IS ART/i,
    );
    expect(openAgentArt).toHaveTextContent(/•[\s\S]*WHAT IS AN AGENT/i);
    expect(openAgentArt).not.toHaveTextContent(/\bINVARIANT\b|OPEN QUESTIONS/i);
    expect(
      Array.from(openAgentArt?.querySelectorAll(".docs-figure__term") ?? []).map(
        (term) => term.textContent?.trim(),
      ),
    ).toEqual(["Agent Art", "What is Art?", "What is an Agent?"]);
    expect(
      Array.from(openAgentArt?.querySelectorAll(".docs-figure__shape-label") ?? []).map(
        (label) => label.textContent?.trim(),
      ),
    ).toEqual([]);
    expect(
      Array.from(
        openAgentArt?.querySelectorAll(".docs-figure__field-membership-glyph") ?? [],
      ).map((glyph) => glyph.textContent),
    ).toEqual(["•", "•"]);
    expect(
      openAgentArt?.querySelector("[data-figure-node='invariant']"),
    ).toHaveTextContent(/Agent Art[\s\S]*An Agent participates in the art activity/i);
    expect(
      Array.from(
        openAgentArt?.querySelectorAll("[data-figure-group-id='agent-art-questions']") ?? [],
      ).map((glyph) => glyph.textContent),
    ).toEqual(["•", "•"]);
    expect(openAgentArt?.querySelector(".docs-figure__character-frame")).toBeNull();
    expect(
      screen.queryByRole("figure", { name: "One practice within Agent Art" }),
    ).not.toBeInTheDocument();
    cleanup();

    render(<DocsPage topicSlug="thought" />);
    const promptResponse = screen
      .getByRole("figure", { name: "One prompt, one response" })
      .querySelector("[data-figure-shape='prompt-response']");
    const attestation = screen
      .getByRole("figure", { name: "Creation Attestation" })
      .querySelector("[data-figure-shape='attestation-flow-fork']");

    expect(promptResponse).toHaveTextContent(
      /HUMAN PROMPT P[\s\S]*\+[\s\S]*AGENT RESPONSE R[\s\S]*↓[\s\S]*ONE THOUGHT \(P, R\)/i,
    );
    expect(
      promptResponse?.querySelector(".docs-figure__field-prompt-pair-glyph"),
    ).toHaveTextContent("+");
    expect(
      promptResponse?.querySelector(".docs-figure__field-prompt-arrow"),
    ).toHaveClass("docs-figure__field-relation-glyph");
    const promptLogic = JSON.parse(
      screen
        .getByRole("figure", { name: "One prompt, one response" })
        .getAttribute("data-figure-logic") ?? "null",
    );
    expect(promptLogic.groups).toContainEqual(
      expect.objectContaining({ id: "thought-equation", glyph: "+" }),
    );
    expect(promptLogic.edges).toEqual([
      expect.objectContaining({
        id: "pair-forms-thought",
        from: "thought-equation",
        to: "one-thought",
        glyph: "↓",
      }),
    ]);
    expect(attestation?.querySelectorAll(".docs-figure__field-fork-branch"))
      .toHaveLength(2);
    expect(
      attestation?.querySelector(".docs-figure__field-fork-stem"),
    ).toBeNull();
    expect(
      attestation?.querySelector(".docs-figure__field-fork-continuation")
        ?.textContent,
    ).toContain("│");
    const attestationFlowArrows = [
      ...(attestation?.querySelectorAll(
        ".docs-figure__field-attestation-arrow",
      ) ?? []),
    ];
    expect(attestationFlowArrows).toHaveLength(2);
    for (const arrow of attestationFlowArrows) {
      expect(arrow).toHaveTextContent("↓");
      expect(arrow).not.toHaveTextContent("│");
      expect(arrow).toHaveClass("docs-figure__field-relation-glyph");
    }
    for (const arrow of [
      ...(attestation?.querySelectorAll(
        ".docs-figure__field-attestation-result-arrow",
      ) ?? []),
    ]) {
      expect(arrow).toHaveClass("docs-figure__field-relation-glyph");
      expect(arrow).toHaveTextContent("→");
    }
    expect(attestation).toHaveTextContent(/CONTRACT VALIDATION[\s\S]*├─[\s\S]*APP ATTESTED/i);
    expect(attestation).toHaveTextContent(/└─[\s\S]*UNATTESTED/i);
    expect(attestation?.querySelector(".docs-figure__field-ceiling")).toBeNull();
    expect(attestation?.querySelector(".docs-figure__character-frame")).toBeNull();
    cleanup();

    render(<DocsPage topicSlug="awa" />);
    const awaFigure = screen.getByRole("figure", { name: "Toward the core" });
    const awa = awaFigure.querySelector(
      ".docs-figure__shape-trace[data-trace-layout='sequence']",
    );
    expect(awa).toHaveTextContent(
      /THOUGHT[\s\S]*INDIVIDUAL[\s\S]*→[\s\S]*WILL[\s\S]*CROWD[\s\S]*→[\s\S]*AWA[\s\S]*TOWARD THE CORE[\s\S]*→[\s\S]*…/i,
    );
    expect(
      [
        ...(awa?.querySelectorAll<HTMLElement>("[data-figure-node-id]") ?? []),
      ].map((node) => node.dataset.figureNodeId),
    ).toEqual(["thought", "will", "awa", "open-horizon"]);
    expect(
      [
        ...(awa?.querySelectorAll<HTMLElement>("[data-figure-edge-id]") ?? []),
      ].map((edge) => edge.dataset.figureEdgeId),
    ).toEqual([
      "thought-to-will",
      "will-toward-awa",
      "awa-toward-open-horizon",
    ]);
    expect(awaFigure).toHaveAttribute("data-figure-mode", "trace");
    expect(awaFigure).toHaveAttribute("data-figure-form", "trace");
    cleanup();

    render(<DocsPage topicSlug="artwork-metadata-chain" />);
    const evidence = screen
      .getByRole("figure", { name: "Evidence becomes interpretation" })
      .querySelector("[data-figure-shape='evidence-interpretation']");
    expect(evidence).toHaveTextContent(
      /EVIDENCE[\s\S]*├─[\s\S]*IDENTITY[\s\S]*├─[\s\S]*CONTRACT[\s\S]*├─[\s\S]*RELEASE[\s\S]*└─[\s\S]*CONTEXT[\s\S]*↓[\s\S]*INTERPRETATION/i,
    );
    const evidenceArrow = evidence?.querySelector(
      ".docs-figure__field-evidence-arrow",
    );
    expect(evidenceArrow).toHaveTextContent("↓");
    expect(evidenceArrow).not.toHaveTextContent("│");
    expect(evidenceArrow).toHaveClass("docs-figure__field-relation-glyph");
    expect(
      evidence?.querySelector(
        ".docs-figure__field-fork-stem, .docs-figure__field-connector, .docs-figure__character-frame",
      ),
    ).toBeNull();
    expect(evidence?.querySelectorAll(".docs-figure__annotation"))
      .toHaveLength(5);
    cleanup();

    render(<DocsPage topicSlug="wallet-local-data" />);
    const distinctions = screen
      .getByRole("figure", { name: "Two distinctions" })
      .querySelector("[data-figure-shape='distinction-comparisons']");
    expect(distinctions?.querySelector(".docs-figure__character-frame"))
      .toBeNull();
    expect(
      [
        ...(distinctions?.querySelectorAll<HTMLElement>(
          "[data-figure-node]",
        ) ?? []),
      ].map((node) => node.dataset.figureNode),
    ).toEqual(["read", "sign", "transact", "local", "onchain"]);
    expect(
      distinctions?.querySelectorAll(".docs-figure__field-distinction-glyph"),
    ).toHaveLength(3);
    expect(distinctions).toHaveTextContent(
      /READ[\s\S]*≠[\s\S]*SIGN[\s\S]*≠[\s\S]*TRANSACT[\s\S]*LOCAL[\s\S]*≠[\s\S]*ONCHAIN/i,
    );
    cleanup();

    render(<DocsPage topicSlug="source-release-boundaries" />);
    const records = screen
      .getByRole("figure", { name: "Four distinct records" })
      .querySelector("[data-figure-shape='record-comparison']");
    expect(records?.querySelector(".docs-figure__character-frame")).toBeNull();
    expect(
      [
        ...(records?.querySelectorAll<HTMLElement>("[data-figure-node]") ?? []),
      ].map((node) => node.dataset.figureNode),
    ).toEqual(["source", "release", "deployment", "observation"]);
    expect(
      records?.querySelectorAll(
        ".docs-figure__field-record-distinction-glyph",
      ),
    ).toHaveLength(3);
    expect(records).toHaveTextContent(
      /SOURCE[\s\S]*≠[\s\S]*RELEASE[\s\S]*≠[\s\S]*DEPLOYMENT[\s\S]*≠[\s\S]*OBSERVATION/i,
    );
    cleanup();

    render(<DocsPage topicSlug="design-principles" />);
    const principles = screen
      .getByRole("figure", { name: "Current Inshell principles across systems" })
      .querySelector("[data-figure-shape='open-principle-set']");
    const sourceFlow = screen
      .getByRole("figure", { name: "Many surfaces, one identified record" })
      .querySelector("[data-figure-shape='canonical-source-flow']");

    expect(principles?.querySelectorAll(".docs-figure__character-frame"))
      .toHaveLength(0);
    expect(principles?.querySelectorAll(".docs-figure__field-open-set > li"))
      .toHaveLength(5);
    expect(sourceFlow).toHaveTextContent(
      /IDENTIFIED ONCHAIN WORK[\s\S]*NETWORK \+ CONTRACT \+ TOKEN ID \+ TOKENURI \+ RELEASE[\s\S]*│[\s\S]*↓[\s\S]*READING SURFACES/i,
    );
    expect(
      sourceFlow?.querySelector(
        ".docs-figure__field-tail > .docs-figure__glyph",
      )?.textContent,
    ).toBe("↓");
    expect(sourceFlow?.querySelectorAll(".docs-figure__character-frame"))
      .toHaveLength(1);
    expect(sourceFlow?.querySelector(".docs-figure__frame-foot"))
      .not.toHaveTextContent("┬");
    expect(
      sourceFlow?.querySelector(".docs-figure__field-reading-arrow"),
    ).toHaveClass("docs-figure__field-relation-glyph");
  });

  test("uses literal DOM logic and no more than three figure typography tiers", () => {
    const css = [
      readFileSync(nodePath.resolve(cwd(), "src/main.css"), "utf8"),
      readFileSync(
        nodePath.resolve(cwd(), "src/components/docs/figures.css"),
        "utf8",
      ),
    ].join("\n");
    expect(css).not.toMatch(/\.docs-figure[^{}]*(?:::before|::after)/);
    expect(css).not.toContain("--docs-sequence");

    const tierTokens = [
      "--docs-figure-title-font-size",
      "--docs-figure-term-font-size",
      "--docs-figure-annotation-font-size",
    ];
    for (const token of tierTokens) expect(css).toContain(`${token}:`);
    for (const obsoleteToken of [
      "--docs-figure-dense-term-font-size",
      "--docs-figure-marker-font-size",
      "--docs-figure-relation-font-size",
      "--docs-figure-eyebrow-font-size",
      "--docs-figure-frame-key-font-size",
      "--docs-figure-source-summary-font-size",
      "--docs-figure-font-size",
    ]) {
      expect(css).not.toContain(obsoleteToken);
    }

    const figureRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, selectors, body]) => ({ selectors: selectors.trim(), body }))
      .filter(({ selectors }) => selectors.includes(".docs-figure"));
    const figureFontSizes = figureRules.flatMap(({ body }) =>
      [...body.matchAll(/^\s*font-size:\s*([^;]+);/gm)].map(([, value]) =>
        value.trim(),
      ),
    );
    expect(new Set(figureFontSizes)).toEqual(
      new Set(tierTokens.map((token) => `var(${token})`)),
    );

    function expectSelectorTier(selector: string, token: string) {
      const matchingRules = figureRules.filter(({ selectors }) =>
        selectors.split(",").some((candidate) => candidate.trim() === selector),
      );
      expect(matchingRules.length).toBeGreaterThan(0);
      expect(matchingRules.some(({ body }) =>
        body.includes(`font-size: var(${token})`),
      )).toBe(true);
    }

    for (const selector of [
      ".docs-figure figcaption",
      ".docs-figure__glyph",
      ".docs-figure__shape-character",
      ".docs-figure__shape-heading",
      ".docs-figure__shape-label",
      ".docs-figure__frame-heading",
      ".docs-figure__shape-ledger-header",
    ]) {
      expectSelectorTier(selector, "--docs-figure-title-font-size");
    }
    expectSelectorTier(".docs-figure__term", "--docs-figure-term-font-size");
    expectSelectorTier(
      '[data-figure-shape="contained-axis"]\n  .docs-figure__field-inward-arrow',
      "--docs-figure-term-font-size",
    );
    expectSelectorTier(
      ".docs-figure__field-practice-arrow",
      "--docs-figure-term-font-size",
    );
    for (const selector of [
      ".docs-figure__field-prompt-pair-glyph",
      ".docs-figure__field-relation-glyph",
      ".docs-figure__shape-trace-edge-glyph",
      ".docs-figure__shape-trace-return-glyph",
      ".docs-figure__shape-ledger-relation--governing",
      ".docs-figure__lane-relation--governing",
    ]) {
      expectSelectorTier(selector, "--docs-figure-term-font-size");
    }
    for (const selector of [
      ".docs-figure__annotation",
      ".docs-figure__marker",
      ".docs-figure__eyebrow",
      ".docs-figure__lane-heading",
      ".docs-figure__lane-event-label",
    ]) {
      expectSelectorTier(selector, "--docs-figure-annotation-font-size");
    }
  });

  test("styles Pulse record and action links with the docs link treatment", () => {
    const css = readFileSync(
      nodePath.resolve(cwd(), "src/main.css"),
      "utf8",
    );

    expect(css).toMatch(
      /\.docs-page \.pulse-page__instance-fields dd a,\s*\.docs-page \.pulse-page__instance-links a\s*\{[^}]*color:\s*inherit;[^}]*text-decoration:\s*underline;[^}]*text-decoration-thickness:\s*var\(--docs-menu-link-decoration-thickness\);[^}]*text-underline-offset:\s*var\(--docs-menu-link-underline-offset\);[^}]*\}/,
    );
    expect(css).toMatch(
      /\.docs-page \.pulse-page__instance-links a\s*\{[^}]*color:\s*var\(--muted\);[^}]*\}/,
    );
    expect(css).toMatch(
      /\.docs-page \.pulse-page__instance-fields dd a:hover,\s*\.docs-page \.pulse-page__instance-fields dd a:focus-visible,\s*\.docs-page \.pulse-page__instance-links a:hover,\s*\.docs-page \.pulse-page__instance-links a:focus-visible\s*\{[^}]*text-decoration:\s*none;[^}]*\}/,
    );
  });
});

describe("DocsPage article metadata", () => {
  test("hides current status and raw authority taxonomy from the human article header", () => {
    const topic = DOCS_SOURCE.topics.find((candidate) => candidate.slug === "thought");
    expect(topic).toBeDefined();

    render(<DocsPage topicSlug={topic?.slug} />);

    const header = renderedTopicHeader(topic as DocsTopic);
    expect(header.queryByText("current", { exact: true })).not.toBeInTheDocument();
    for (const authority of topic?.authorities ?? []) {
      expect(header.queryByText(authority, { exact: false })).not.toBeInTheDocument();
    }
  });

  test.each(["study", "future"] as const)(
    "shows the non-current %s status beside the article title",
    (status) => {
      const topic = DOCS_SOURCE.topics.find((candidate) => candidate.slug === "thought");
      expect(topic).toBeDefined();
      if (!topic) return;

      const originalStatus = topic.status;
      topic.status = status;
      try {
        render(<DocsPage topicSlug={topic.slug} />);

        const header = renderedTopicHeader(topic);
        expect(header.getByText(status, { exact: true })).toBeInTheDocument();
        for (const authority of topic.authorities) {
          expect(header.queryByText(authority, { exact: false })).not.toBeInTheDocument();
        }
      } finally {
        cleanup();
        topic.status = originalStatus;
      }
    },
  );

  test("retains status and authority metadata in generated Agent-readable documents", () => {
    const outputRoot = nodePath.resolve(cwd(), "public/docs");
    const index = JSON.parse(
      readFileSync(nodePath.join(outputRoot, "agent-index.json"), "utf8"),
    ) as {
      documents: Array<{
        id: string;
        status: DocsTopic["status"];
        authorities: DocsTopic["authorities"];
      }>;
    };

    for (const topic of DOCS_SOURCE.topics) {
      const indexedTopic = index.documents.find((document) => document.id === topic.slug);
      expect(indexedTopic).toMatchObject({
        status: topic.status,
        authorities: topic.authorities,
      });

      const markdown = readFileSync(
        nodePath.join(outputRoot, `${topic.slug}.md`),
        "utf8",
      );
      expect(markdown).toContain(`- Status: ${topic.status}`);
      expect(markdown).toContain(
        `- Authority classes in this document: ${topic.authorities.join(", ")}`,
      );
    }
  });
});

describe("Agent-readable docs artifact contract", () => {
  const publicRoot = nodePath.resolve(cwd(), "public");
  const docsRoot = nodePath.join(publicRoot, "docs");
  const canonicalOrigin = "https://inshell.art";

  function readJson<T>(path: string) {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  }

  function publicArtifactPath(pathname: string) {
    return nodePath.join(publicRoot, hrefPathname(pathname).replace(/^\/+/, ""));
  }

  test("keeps index identities, groups, classifications, and page contexts closed over the source", () => {
    const index = readJson<{
      schema: string;
      version: string;
      authorities: Record<string, string>;
      groups: Array<{ id: string; topics: string[] }>;
      documents: Array<{
        id: string;
        group: string;
        status: DocsTopic["status"];
        authorities: string[];
      }>;
      immutableReleases: Array<{ authority: string }>;
      liveReadOnlyResources: Array<{ authority: string }>;
      pageContexts: Array<{ route: string; topics: string[] }>;
    }>(nodePath.join(docsRoot, "agent-index.json"));

    expect(index.schema).toBe("inshell.agent-docs.index.v1");
    expect(index.version).toBe(DOCS_SOURCE.version);

    const documentIds = index.documents.map(({ id }) => id);
    expect(documentIds).toEqual(DOCS_SOURCE.topics.map(({ slug }) => slug));
    expect(new Set(documentIds).size).toBe(documentIds.length);

    const sourceBySlug = new Map(DOCS_SOURCE.topics.map((topic) => [topic.slug, topic]));
    for (const document of index.documents) {
      const source = sourceBySlug.get(document.id);
      expect(source).toBeDefined();
      expect(document).toMatchObject({
        group: source?.group,
        status: source?.status,
        authorities: source?.authorities,
      });
    }

    const indexedAuthorityNames = new Set(Object.keys(index.authorities));
    const classifiedAuthorities = [
      ...index.documents.flatMap(({ authorities }) => authorities),
      ...index.immutableReleases.map(({ authority }) => authority),
      ...index.liveReadOnlyResources.map(({ authority }) => authority),
    ];
    expect(
      classifiedAuthorities.filter((authority) => !indexedAuthorityNames.has(authority)),
    ).toEqual([]);
    expect(Object.values(index.authorities).every((description) => description.trim().length > 0)).toBe(
      true,
    );

    const groupedTopics = index.groups.flatMap(({ topics }) => topics);
    expect(groupedTopics).toEqual(DOCS_SOURCE.groups.flatMap(({ topicSlugs }) => topicSlugs));
    expect(new Set(groupedTopics)).toEqual(new Set(documentIds));

    expect(new Set(index.pageContexts.map(({ route }) => route)).size).toBe(
      index.pageContexts.length,
    );
    for (const context of index.pageContexts) {
      expect(context.route).toMatch(/^\//);
      expect(context.topics.length).toBeGreaterThan(0);
      expect(context.topics.filter((topic) => !sourceBySlug.has(topic))).toEqual([]);
    }
  });

  test("pairs every same-origin discovery URL with its canonical public URL", () => {
    const index = readJson<{
      schemaUrl: string;
      canonicalSchemaUrl: string;
      completeMarkdown: string;
      canonicalCompleteMarkdown: string;
      completeJson: string;
      canonicalCompleteJson: string;
      canonicalHtml: string;
      documents: Array<{
        id: string;
        markdown: string;
        canonicalMarkdown: string;
        json: string;
        canonicalJson: string;
        canonicalHtml: string;
      }>;
      immutableReleases: Array<{ url: string; canonicalUrl: string }>;
      liveReadOnlyResources: Array<{
        url?: string;
        canonicalUrl?: string;
        urlTemplate?: string;
        canonicalUrlTemplate?: string;
      }>;
    }>(nodePath.join(docsRoot, "agent-index.json"));

    const pairs = [
      [index.schemaUrl, index.canonicalSchemaUrl],
      [index.completeMarkdown, index.canonicalCompleteMarkdown],
      [index.completeJson, index.canonicalCompleteJson],
      ...index.documents.map(({ markdown, canonicalMarkdown }) => [markdown, canonicalMarkdown]),
      ...index.documents.map(({ json, canonicalJson }) => [json, canonicalJson]),
      ...index.immutableReleases.map(({ url, canonicalUrl }) => [url, canonicalUrl]),
      ...index.liveReadOnlyResources.map((resource) => [
        resource.url ?? resource.urlTemplate,
        resource.canonicalUrl ?? resource.canonicalUrlTemplate,
      ]),
    ];

    for (const [relative, canonical] of pairs) {
      expect(relative).toMatch(/^\//);
      expect(canonical).toBe(`${canonicalOrigin}${relative}`);
    }

    for (const canonical of [
      index.canonicalHtml,
      ...index.documents.map(({ canonicalHtml }) => canonicalHtml),
      ...pairs.map(([, canonical]) => canonical),
    ]) {
      const url = new URL(canonical as string);
      expect(url.protocol).toBe("https:");
      expect(url.origin).toBe(canonicalOrigin);
      expect(url.hostname).not.toMatch(/^(?:preview|thought|gallery)\./);
      expect(url.hostname).not.toBe("localhost");
    }
  });

  test("keeps every indexed static artifact present and every Markdown and JSON digest exact", () => {
    const index = readJson<{
      schemaUrl: string;
      completeMarkdown: string;
      completeJson: string;
      completeJsonMediaType: string;
      completeJsonSha256: string;
      documents: Array<{
        id: string;
        markdown: string;
        markdownMediaType: string;
        markdownSha256: string;
        json: string;
        jsonMediaType: string;
        jsonSha256: string;
      }>;
      immutableReleases: Array<{ url: string }>;
    }>(nodePath.join(docsRoot, "agent-index.json"));

    expect(() => readFileSync(publicArtifactPath(index.schemaUrl), "utf8")).not.toThrow();
    expect(() => readFileSync(publicArtifactPath(index.completeMarkdown), "utf8")).not.toThrow();
    const completeJson = readFileSync(publicArtifactPath(index.completeJson), "utf8");
    expect(index.completeJsonMediaType).toBe("application/json");
    expect(index.completeJsonSha256).toBe(
      createHash("sha256").update(completeJson, "utf8").digest("hex"),
    );

    for (const release of index.immutableReleases) {
      expect(() => readFileSync(publicArtifactPath(release.url), "utf8")).not.toThrow();
    }

    for (const document of index.documents) {
      const markdown = readFileSync(publicArtifactPath(document.markdown), "utf8");
      const json = readFileSync(publicArtifactPath(document.json), "utf8");
      expect(document.markdownMediaType).toBe("text/markdown");
      expect(document.markdownSha256).toBe(
        createHash("sha256").update(markdown, "utf8").digest("hex"),
      );
      expect(document.jsonMediaType).toBe("application/json");
      expect(document.jsonSha256).toBe(
        createHash("sha256").update(json, "utf8").digest("hex"),
      );
      expect(markdown).toContain(`- Documentation version: ${DOCS_SOURCE.version}`);
    }
  });

  test("publishes the locked PATH and Pulse v0.5.0 release as a complete checksummed graph", () => {
    const index = readJson<{
      usage: { ingestionModes: Array<{ id: string; entry?: string }> };
      immutableReleases: Array<{
        id: string;
        url: string;
        canonicalUrl: string;
        mediaType: string;
        sha256: string;
        authority: string;
      }>;
    }>(nodePath.join(docsRoot, "agent-index.json"));
    const release = index.immutableReleases.find(
      ({ id }) => id === "path-pulse-contract-release-v0.5.0",
    );

    expect(release).toMatchObject({
      url: "/protocol/releases/path-v0.5.0/manifest.json",
      canonicalUrl: `${canonicalOrigin}/protocol/releases/path-v0.5.0/manifest.json`,
      mediaType: "application/json",
      authority: "contract-release",
    });
    const manifestBytes = readFileSync(publicArtifactPath(release?.url ?? ""));
    expect(release?.sha256).toBe(
      createHash("sha256").update(manifestBytes).digest("hex"),
    );
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
      releaseTag: string;
      canonicalContracts: string[];
      contracts: Record<string, { abi: string; hardhatArtifact: string }>;
      compatibility: { networkAddressesIncluded: boolean };
    };
    const checksums = readJson<Record<string, string>>(
      publicArtifactPath("/protocol/releases/path-v0.5.0/checksums.json"),
    );

    expect(manifest.releaseTag).toBe("v0.5.0");
    expect(manifest.canonicalContracts).toEqual([
      "PathNFT",
      "PathPulseAdapter",
      "PulseAuction",
    ]);
    expect(manifest.compatibility.networkAddressesIncluded).toBe(false);
    for (const contractName of manifest.canonicalContracts) {
      const contract = manifest.contracts[contractName];
      for (const relativePath of [contract.abi, contract.hardhatArtifact]) {
        const bytes = readFileSync(
          publicArtifactPath(`/protocol/releases/path-v0.5.0/${relativePath}`),
        );
        expect(checksums[relativePath]).toBe(
          createHash("sha256").update(bytes).digest("hex"),
        );
      }
    }
    expect(index.usage.ingestionModes).toContainEqual(
      expect.objectContaining({
        id: "path-pulse-contract-release",
        entry: release?.url,
      }),
    );
  });

  test("serves Agent-readable docs and schemas with explicit media types", () => {
    const headers = readFileSync(nodePath.join(publicRoot, "_headers"), "utf8");

    expect(headers).toContain(
      ["/docs/*.md", "  Content-Type: text/markdown; charset=utf-8"].join("\n"),
    );
    expect(headers).toContain(
      ["/docs/*.json", "  Content-Type: application/json; charset=utf-8"].join("\n"),
    );
    expect(headers).toContain(
      ["/protocol/releases/*.md", "  Content-Type: text/markdown; charset=utf-8"].join("\n"),
    );
    expect(headers).toContain(
      ["/protocol/releases/*.json", "  Content-Type: application/json; charset=utf-8"].join("\n"),
    );
    expect(headers).toContain(
      [
        "/protocol/releases/*.schema.json",
        "  Content-Type: application/schema+json; charset=utf-8",
      ].join("\n"),
    );
    for (const schemaPath of [
      "/docs/agent-index.schema.json",
      "/docs/content.schema.json",
      "/docs/content.v2.schema.json",
      "/protocol/thought-machine-handoff.schema.json",
    ]) {
      expect(headers).toContain(
        [schemaPath, "  Content-Type: application/schema+json; charset=utf-8"].join(
          "\n",
        ),
      );
    }
  });

  test("publishes one current THOUGHT machine handoff through the Agent index", () => {
    const index = readJson<{
      machineHandoffs: Array<{
        id: string;
        status: string;
        url: string;
        canonicalUrl: string;
        schemaUrl: string;
        canonicalSchemaUrl: string;
        mediaType: string;
        sha256: string;
        topics: string[];
        productionAuthorized: boolean;
      }>;
      usage: { ingestionModes: Array<{ id: string; entry?: string }> };
    }>(nodePath.join(docsRoot, "agent-index.json"));

    expect(index.machineHandoffs).toHaveLength(1);
    const handoff = index.machineHandoffs[0];
    const manifestBytes = readFileSync(publicArtifactPath(handoff.url));
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
      schema: string;
      id: string;
      status: string;
      schemaUrl: string;
      canonicalSchemaUrl: string;
      canonicalUrl: string;
      ownerBoundary: Record<string, unknown>;
      constraints: {
        productionAuthorized: boolean;
        deploymentAuthorized: boolean;
        agentTransportReleaseIncluded: boolean;
      };
      excluded: Array<{ id: string; status: string }>;
    };

    expect(handoff).toMatchObject({
      id: manifest.id,
      status: THOUGHT_MACHINE_HANDOFF_SOURCE.status,
      canonicalUrl: `${canonicalOrigin}${handoff.url}`,
      schemaUrl: "/protocol/thought-machine-handoff.schema.json",
      canonicalSchemaUrl: `${canonicalOrigin}/protocol/thought-machine-handoff.schema.json`,
      mediaType: "application/json",
      topics: THOUGHT_MACHINE_HANDOFF_SOURCE.topics,
      productionAuthorized: false,
    });
    expect(handoff.sha256).toBe(
      createHash("sha256").update(manifestBytes).digest("hex"),
    );
    expect(manifest).toMatchObject({
      schema: "inshell.thought.machine-handoff.v1",
      id: handoff.id,
      status: handoff.status,
      schemaUrl: handoff.schemaUrl,
      canonicalSchemaUrl: handoff.canonicalSchemaUrl,
      canonicalUrl: handoff.canonicalUrl,
      constraints: {
        productionAuthorized: false,
        deploymentAuthorized: false,
        agentTransportReleaseIncluded: true,
      },
    });
    expect(Object.keys(manifest.ownerBoundary).sort()).toEqual(
      [
        "humanWallet",
        "sharedInfrastructure",
        "sourceOfTruth",
        "thoughtApp",
        "thoughtContract",
      ].sort(),
    );
    expect(manifest.excluded).toEqual(THOUGHT_MACHINE_HANDOFF_SOURCE.excluded);
    expect(index.usage.ingestionModes).toContainEqual(
      expect.objectContaining({
        id: "thought-machine-handoff",
        entry: handoff.url,
      }),
    );
    expect(() => readFileSync(publicArtifactPath(handoff.schemaUrl), "utf8")).not.toThrow();
  });

  test("keeps every THOUGHT handoff artifact exact and separately owned", () => {
    const index = readJson<{
      machineHandoffs: Array<{ url: string }>;
    }>(nodePath.join(docsRoot, "agent-index.json"));
    const manifest = readJson<{
      ownerBoundary: typeof THOUGHT_MACHINE_HANDOFF_SOURCE.ownerBoundary;
      artifacts: Array<{
        id: string;
        role: string;
        owner: string;
        authority: string;
        url: string;
        canonicalUrl: string;
        mediaType: string;
        byteLength: number;
        sha256: string;
      }>;
      relations: Array<{ type: string }>;
    }>(publicArtifactPath(index.machineHandoffs[0].url));

    expect(manifest.ownerBoundary).toEqual(THOUGHT_MACHINE_HANDOFF_SOURCE.ownerBoundary);
    expect(manifest.artifacts.map(({ id }) => id)).toEqual(
      THOUGHT_MACHINE_HANDOFF_SOURCE.artifacts.map(({ id }) => id),
    );

    const sourceById = new Map(
      THOUGHT_MACHINE_HANDOFF_SOURCE.artifacts.map((artifact) => [artifact.id, artifact]),
    );
    for (const artifact of manifest.artifacts) {
      const source = sourceById.get(artifact.id);
      expect(source).toBeDefined();
      expect(artifact).toMatchObject({
        role: source?.role,
        owner: source?.owner,
        authority: source?.authority,
        mediaType: source?.mediaType,
        canonicalUrl: `${canonicalOrigin}${artifact.url}`,
      });
      const bytes = readFileSync(publicArtifactPath(artifact.url));
      expect(artifact.byteLength).toBe(bytes.byteLength);
      expect(artifact.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    }

    const appProvenance = manifest.artifacts.find(
      ({ id }) => id === "app-provenance-schema",
    );
    const contractProvenance = manifest.artifacts.find(
      ({ id }) => id === "contract-provenance-schema",
    );
    expect(appProvenance).toMatchObject({ owner: "THOUGHT App" });
    expect(contractProvenance).toMatchObject({ owner: "THOUGHT Contract" });
    expect(appProvenance?.sha256).not.toBe(contractProvenance?.sha256);
    expect(manifest.relations).toContainEqual(
      expect.objectContaining({ type: "provenance-schema-boundary" }),
    );
  });

  test("keeps the THOUGHT handoff component pins synchronized with owning locks", () => {
    const repoRoot = nodePath.resolve(cwd(), "../..");
    const index = readJson<{ machineHandoffs: Array<{ url: string }> }>(
      nodePath.join(docsRoot, "agent-index.json"),
    );
    const manifest = readJson<{
      components: {
        creativeSpec: { id: string; sha256: string };
        provenance: { id: string; schemaSha256: string; specSha256: string };
        metadataNamespace: { id: string; schemaSha256: string; specSha256: string };
        contractRelease: { id: string; manifestSha256: string };
        appIntegration: { id: string; sha256: string };
      };
    }>(publicArtifactPath(index.machineHandoffs[0].url));
    const creative = readJson<{
      artifactId: string;
      artifact: { sha256: string };
    }>(nodePath.join(repoRoot, "apps/thought/spec/THOUGHT.v2.lock.json"));
    const provenance = readJson<{
      artifactId: string;
      artifacts: { schema: { sha256: string }; spec: { sha256: string } };
    }>(nodePath.join(repoRoot, "apps/thought/provenance/v2/provenance-lock.json"));
    const metadata = readJson<{
      artifactId: string;
      artifacts: { schema: { sha256: string }; spec: { sha256: string } };
    }>(nodePath.join(repoRoot, "apps/thought/metadata/v2/metadata-namespace-lock.json"));
    const contract = readJson<{ artifactId: string; manifestSha256: string }>(
      nodePath.join(repoRoot, "apps/thought/contract-release/consumer-lock.json"),
    );
    const integrationPath = nodePath.join(
      repoRoot,
      "apps/thought/contract-integration/current/integration-lock.json",
    );
    const integrationBytes = readFileSync(integrationPath);
    const integration = JSON.parse(integrationBytes.toString("utf8")) as { id: string };
    const agentTransportPath = nodePath.join(
      repoRoot,
      "packages/thought-agent-protocol/thought-v2.consumer-lock.json",
    );
    const agentTransportBytes = readFileSync(agentTransportPath);
    const agentTransport = JSON.parse(agentTransportBytes.toString("utf8")) as {
      identifiers: { agentResult: string };
    };

    expect(manifest.components).toEqual({
      creativeSpec: {
        id: creative.artifactId,
        sha256: creative.artifact.sha256,
      },
      provenance: {
        id: provenance.artifactId,
        schemaSha256: provenance.artifacts.schema.sha256,
        specSha256: provenance.artifacts.spec.sha256,
      },
      metadataNamespace: {
        id: metadata.artifactId,
        schemaSha256: metadata.artifacts.schema.sha256,
        specSha256: metadata.artifacts.spec.sha256,
      },
      contractRelease: {
        id: contract.artifactId,
        manifestSha256: contract.manifestSha256,
      },
      appIntegration: {
        id: integration.id,
        sha256: createHash("sha256").update(integrationBytes).digest("hex"),
      },
      agentTransport: {
        id: agentTransport.identifiers.agentResult,
        sha256: createHash("sha256").update(agentTransportBytes).digest("hex"),
      },
    });
  });

  test("keeps the complete JSON corpus and focused topic JSON losslessly aligned", () => {
    type StructuredFigure = {
      authorities: DocsAuthority[];
      logic: ReturnType<typeof docsFigureLogic>;
    } & DocsFigure;
    type StructuredTopic = {
      schema: string;
      schemaUrl: string;
      canonicalSchemaUrl: string;
      version: string;
      language: string;
      fetchedContentRole: string;
      id: string;
      sourceId: string;
      group: string;
      aliases: string[];
      title: string;
      summary: string;
      status: DocsTopic["status"];
      authorities: DocsAuthority[];
      canonicalHtml: string;
      markdown: string;
      canonicalMarkdown: string;
      json: string;
      canonicalJson: string;
      content: {
        lead: {
          authorities: DocsAuthority[];
          paragraphs: string[];
        };
        figure: StructuredFigure | null;
        preformatted: Array<{
          authorities: DocsAuthority[];
          label: string;
          content: string;
        }>;
        sections: Array<{
          authorities: DocsAuthority[];
          id: string;
          title: string;
          figure?: StructuredFigure;
          paragraphs?: string[];
          points?: string[];
          steps?: string[];
          note?: string;
        }>;
        links: Array<{
          role: "navigation";
          label: string;
          href: string;
          canonicalHref: string;
        }>;
      };
    };
    const complete = readJson<{
      schema: string;
      schemaUrl: string;
      canonicalSchemaUrl: string;
      version: string;
      fetchedContentRole: string;
      agentIndex: string;
      canonicalAgentIndex: string;
      completeMarkdown: string;
      canonicalCompleteMarkdown: string;
      ingestion: { mode: string; instruction: string };
      topics: StructuredTopic[];
    }>(nodePath.join(docsRoot, "content.json"));

    expect(complete).toMatchObject({
      schema: "inshell.agent-docs.content.v2",
      schemaUrl: "/docs/content.v2.schema.json",
      canonicalSchemaUrl: `${canonicalOrigin}/docs/content.v2.schema.json`,
      version: DOCS_SOURCE.version,
      fetchedContentRole: "reference-data",
      agentIndex: "/docs/agent-index.json",
      canonicalAgentIndex: `${canonicalOrigin}/docs/agent-index.json`,
      completeMarkdown: "/docs/index.md",
      canonicalCompleteMarkdown: `${canonicalOrigin}/docs/index.md`,
      ingestion: { mode: "complete-structured-corpus" },
    });
    expect(complete.ingestion.instruction.trim().length).toBeGreaterThan(0);
    expect(complete.topics.map(({ id }) => id)).toEqual(
      DOCS_SOURCE.topics.map(({ slug }) => slug),
    );

    for (const topic of DOCS_SOURCE.topics) {
      const authorityMap = DOCS_AUTHORITY_MAP[topic.slug];
      expect(authorityMap).toBeDefined();
      if (!authorityMap) continue;

      const focused = readJson<StructuredTopic>(
        nodePath.join(docsRoot, `${topic.slug}.json`),
      );
      expect(complete.topics.find(({ id }) => id === topic.slug)).toEqual(focused);
      expect(focused).toMatchObject({
        schema: "inshell.agent-docs.topic.v2",
        schemaUrl: "/docs/content.v2.schema.json",
        canonicalSchemaUrl: `${canonicalOrigin}/docs/content.v2.schema.json`,
        version: DOCS_SOURCE.version,
        language: "en",
        fetchedContentRole: "reference-data",
        id: topic.slug,
        sourceId: topic.id,
        group: topic.group,
        aliases: topic.aliases ?? [],
        title: topic.title,
        summary: topic.summary,
        status: topic.status,
        authorities: topic.authorities,
        canonicalHtml: `${canonicalOrigin}/docs/${topic.slug}`,
        markdown: `/docs/${topic.slug}.md`,
        canonicalMarkdown: `${canonicalOrigin}/docs/${topic.slug}.md`,
        json: `/docs/${topic.slug}.json`,
        canonicalJson: `${canonicalOrigin}/docs/${topic.slug}.json`,
      });
      expect(focused.content).toEqual({
        lead: {
          authorities: authorityMap.lead,
          paragraphs: topic.paragraphs.map((paragraph) =>
            docsParagraphMarkdown(paragraph, canonicalOrigin),
          ),
        },
        figure: topic.figure
          ? {
              authorities: authorityMap.figure ?? [],
              ...topic.figure,
              logic: docsFigureLogic(topic.figure),
            }
          : null,
        preformatted: (topic.preformatted ?? []).map((block) => ({
          authorities: authorityMap.preformatted?.[block.label] ?? [],
          ...block,
        })),
        sections: (topic.sections ?? []).map((section) => {
          const { figure, ...sectionContent } = section;
          return {
            authorities: authorityMap.sections[section.id] ?? [],
            ...sectionContent,
            ...(section.paragraphs
              ? {
                  paragraphs: section.paragraphs.map((paragraph) =>
                    docsParagraphMarkdown(paragraph, canonicalOrigin),
                  ),
                }
              : {}),
            ...(figure
              ? {
                  figure: {
                    authorities: authorityMap.sectionFigures?.[section.id] ?? [],
                    ...figure,
                    logic: docsFigureLogic(figure),
                  },
                }
              : {}),
          };
        }),
        links: (topic.links ?? []).map((link) => ({
          role: "navigation",
          label: link.label.replace(/\s*↗$/, ""),
          href: link.href,
          canonicalHref: link.href.startsWith("/")
            ? `${canonicalOrigin}${link.href}`
            : link.href,
        })),
      });

      const authorityBlocks = [
        focused.content.lead,
        ...(focused.content.figure ? [focused.content.figure] : []),
        ...focused.content.preformatted,
        ...focused.content.sections,
        ...focused.content.sections.flatMap((section) =>
          section.figure ? [section.figure] : [],
        ),
      ];
      for (const block of authorityBlocks) {
        expect(block.authorities.length).toBeGreaterThan(0);
        expect(
          block.authorities.filter(
            (authority) => !focused.authorities.includes(authority),
          ),
        ).toEqual([]);
      }
      expect(new Set(focused.authorities)).toEqual(
        new Set(authorityBlocks.flatMap(({ authorities }) => authorities)),
      );
      expect(new Set(focused.authorities).size).toBe(focused.authorities.length);
      expect(
        focused.content.links.every(({ role }) => role === "navigation"),
      ).toBe(true);
    }
  });

  test("preserves the public v1 content schema bytes at the established URI", () => {
    const schemaBytes = readFileSync(
      nodePath.join(docsRoot, "content.schema.json"),
    );
    expect(createHash("sha256").update(schemaBytes).digest("hex")).toBe(
      "12c7dd1a1061813c2f73778a1c91aea8c0970af34b8c3f899317854b7bfcebe2",
    );
    const schema = JSON.parse(schemaBytes.toString("utf8")) as {
      $id: string;
      $defs: {
        topicDocument: { properties: { schema: { const: string } } };
        contentDocument: { properties: { schema: { const: string } } };
      };
    };
    expect(schema.$id).toBe(`${canonicalOrigin}/docs/content.schema.json`);
    expect(schema.$defs.topicDocument.properties.schema.const).toBe(
      "inshell.agent-docs.topic.v1",
    );
    expect(schema.$defs.contentDocument.properties.schema.const).toBe(
      "inshell.agent-docs.content.v1",
    );
  });

  test("keeps the published v2 schema enums aligned with index classifications", () => {
    const index = readJson<{
      authorities: Record<string, string>;
      groups: Array<{ id: string }>;
    }>(nodePath.join(docsRoot, "agent-index.json"));
    const schema = readJson<{
      properties: {
        documents: {
          items: {
            properties: {
              group: { enum: string[] };
              status: { enum: string[] };
              authorities: { items: { enum: string[] } };
            };
          };
        };
      };
    }>(nodePath.join(docsRoot, "agent-index.schema.json"));
    const documentProperties = schema.properties.documents.items.properties;
    const contentSchema = readJson<{
      $defs: {
        authority: { enum: string[] };
        group: { enum: string[] };
        figureItem: {
          required: string[];
          properties: { detail: { type: string; minLength: number } };
        };
        figure: {
          required: string[];
          properties: { mode: { enum: string[] } };
        };
        figureLogicForm: { enum: string[] };
        figureLogic: { required: string[] };
        laneFigureItem: {
          required: string[];
          properties: { detail: { type: string; minLength: number } };
        };
        section: { properties: { figure: { $ref: string } } };
        topicDocument: {
          properties: { status: { enum: string[] } };
        };
      };
    }>(nodePath.join(docsRoot, "content.v2.schema.json"));

    expect(new Set(documentProperties.group.enum)).toEqual(
      new Set(index.groups.map(({ id }) => id)),
    );
    expect(new Set(documentProperties.authorities.items.enum)).toEqual(
      new Set(Object.keys(index.authorities)),
    );
    expect(new Set(documentProperties.status.enum)).toEqual(
      new Set(["current", "study", "future"]),
    );
    expect(new Set(contentSchema.$defs.group.enum)).toEqual(
      new Set(index.groups.map(({ id }) => id)),
    );
    expect(new Set(contentSchema.$defs.authority.enum)).toEqual(
      new Set(Object.keys(index.authorities)),
    );
    expect(new Set(contentSchema.$defs.figure.properties.mode.enum)).toEqual(
      new Set(DOCS_FIGURE_MODES),
    );
    expect(contentSchema.$defs.figure.required).toEqual(
      expect.arrayContaining(["id", "logic"]),
    );
    expect(new Set(contentSchema.$defs.figureLogicForm.enum)).toEqual(
      new Set(DOCS_FIGURE_FORMS),
    );
    expect(contentSchema.$defs.figureLogic.required).toEqual(
      expect.arrayContaining(["id", "form", "nodes", "edges", "groups"]),
    );
    expect(contentSchema.$defs.figureItem.required).not.toContain("detail");
    expect(contentSchema.$defs.laneFigureItem.required).not.toContain("detail");
    for (const itemSchema of [
      contentSchema.$defs.figureItem,
      contentSchema.$defs.laneFigureItem,
    ]) {
      expect(itemSchema.properties.detail).toEqual({
        type: "string",
        minLength: 1,
      });
    }
    expect(contentSchema.$defs.section.properties.figure.$ref).toBe(
      "#/$defs/figure",
    );
    expect(new Set(contentSchema.$defs.topicDocument.properties.status.enum)).toEqual(
      new Set(["current", "study", "future"]),
    );
  });

  test("keeps every source field and link represented in topic and complete Markdown", () => {
    const completeMarkdown = readFileSync(nodePath.join(docsRoot, "index.md"), "utf8");
    const schemaReference =
      `- Structured JSON schema: ${canonicalOrigin}/docs/content.v2.schema.json`;
    expect(completeMarkdown).toContain(schemaReference);

    for (const topic of DOCS_SOURCE.topics) {
      const markdown = readFileSync(nodePath.join(docsRoot, `${topic.slug}.md`), "utf8");
      expect(markdown).toContain(schemaReference);
      for (const { sectionId, figure } of topicFigureEntries(topic)) {
        const logic = docsFigureLogic(figure);
        const fencedFigure = `\`\`\`text\n${figure.figureText}\n\`\`\``;
        expect(markdown).toContain(fencedFigure);
        expect(completeMarkdown).toContain(fencedFigure);
        expect(markdown).toContain(`- Figure ID: ${figure.id}`);
        expect(markdown).toContain(`- Semantic form: ${logic.form}`);
        for (const edge of logic.edges) {
          expect(markdown).toContain(`\`${edge.id}: ${edge.from} (`);
          expect(markdown).toContain(`--> ${edge.to} (`);
          expect(markdown).toContain(edge.glyph);
          expect(markdown).toContain(edge.label);
        }
        for (const group of logic.groups) {
          expect(markdown).toContain(
            `\`${group.id} [${group.kind}]`,
          );
          for (const member of group.members) {
            expect(markdown).toContain(`${member} (`);
          }
        }
        expect(markdown).toContain(
          `${sectionId ? "###" : "##"} ${figure.label}`,
        );
        if (sectionId) {
          const section = topic.sections?.find(({ id }) => id === sectionId);
          const firstBody = section?.paragraphs?.[0]
            ? docsParagraphMarkdown(section.paragraphs[0], canonicalOrigin)
            : section?.points?.[0] ?? section?.steps?.[0] ?? section?.note;
          expect(markdown.indexOf(`## ${section?.title}`)).toBeLessThan(
            markdown.indexOf(`### ${figure.label}`),
          );
          if (firstBody) {
            expect(markdown.indexOf(`### ${figure.label}`)).toBeLessThan(
              markdown.indexOf(firstBody),
            );
          }
        }
      }
      const expectedText = [
        topic.summary,
        ...topic.paragraphs.map((paragraph) =>
          docsParagraphMarkdown(paragraph, canonicalOrigin),
        ),
        ...figureTextFields(topic.figure),
        ...(topic.preformatted?.flatMap(({ label, content }) => [label, content]) ?? []),
        ...(topic.sections?.flatMap((section) => [
          section.title,
          ...figureTextFields(section.figure),
          ...(section.paragraphs?.map((paragraph) =>
            docsParagraphMarkdown(paragraph, canonicalOrigin),
          ) ?? []),
          ...(section.points ?? []),
          ...(section.steps ?? []),
          section.note,
        ]) ?? []),
      ].filter((value): value is string => Boolean(value));

      for (const value of expectedText) {
        expect(markdown).toContain(value);
        expect(completeMarkdown).toContain(value);
      }

      for (const link of topic.links ?? []) {
        const label = link.label.replace(/\s*↗$/, "");
        const href = link.href.startsWith("/") ? `${canonicalOrigin}${link.href}` : link.href;
        expect(markdown).toContain(`[${label}](${href})`);
        expect(completeMarkdown).toContain(`[${label}](${href})`);
      }
    }
  });

  test("keeps generated same-origin Markdown and JSON links on real App routes or public artifacts", () => {
    const files = [
      nodePath.join(docsRoot, "index.md"),
      ...DOCS_SOURCE.topics.map(({ slug }) => nodePath.join(docsRoot, `${slug}.md`)),
    ];
    const invalidLinks: string[] = [];

    for (const file of files) {
      const markdown = readFileSync(file, "utf8");
      const hrefs = [...markdown.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(
        (match) => match[1],
      );
      for (const href of hrefs) {
        const url = new URL(href);
        if (url.origin !== canonicalOrigin) continue;

        const isPublicArtifact = /^(?:\/docs\/[^/]+\.md|\/protocol\/)/.test(url.pathname);
        if (isPublicArtifact) {
          try {
            readFileSync(publicArtifactPath(url.pathname), "utf8");
          } catch {
            invalidLinks.push(`${nodePath.basename(file)} -> ${href}`);
          }
          continue;
        }

        if (!isSupportedDocsAppRoute(url.pathname)) {
          invalidLinks.push(`${nodePath.basename(file)} -> ${href}`);
        }
      }
    }

    const complete = readJson<{
      topics: Array<{
        id: string;
        content: { links: Array<{ canonicalHref: string }> };
      }>;
    }>(nodePath.join(docsRoot, "content.json"));
    for (const topic of complete.topics) {
      for (const { canonicalHref } of topic.content.links) {
        const url = new URL(canonicalHref);
        if (url.origin !== canonicalOrigin) continue;

        if (url.pathname.startsWith("/protocol/")) {
          try {
            readFileSync(publicArtifactPath(url.pathname), "utf8");
          } catch {
            invalidLinks.push(`${topic.id}.json -> ${canonicalHref}`);
          }
          continue;
        }

        if (!isSupportedDocsAppRoute(url.pathname)) {
          invalidLinks.push(`${topic.id}.json -> ${canonicalHref}`);
        }
      }
    }

    expect(invalidLinks).toEqual([]);
  });

  test("locks every registered public knowledge source to exact repo bytes", () => {
    const repoRoot = nodePath.resolve(cwd(), "../..");
    const index = readJson<{
      sourceLock: {
        url: string;
        schemaUrl: string;
        sha256: string;
        check: string;
        upstreamCheck: string;
      };
    }>(nodePath.join(docsRoot, "agent-index.json"));
    const lockPath = publicArtifactPath(index.sourceLock.url);
    const lockBytes = readFileSync(lockPath);
    const lock = JSON.parse(lockBytes.toString("utf8")) as {
      schema: string;
      policy: { check: string; upstreamCheck: string };
      sourceTreeSha256: string;
      groups: Array<{
        id: string;
        groupSha256: string;
        files: Array<{ path: string; byteLength: number; sha256: string }>;
      }>;
    };

    expect(createHash("sha256").update(lockBytes).digest("hex")).toBe(
      index.sourceLock.sha256,
    );
    expect(index.sourceLock).toMatchObject({
      url: "/docs/source-lock.json",
      schemaUrl: "/docs/source-lock.schema.json",
      check: "pnpm docs:check",
      upstreamCheck: "pnpm check:upstream-releases",
    });
    expect(lock.schema).toBe("inshell.agent-docs.source-lock.v1");
    expect(lock.policy).toEqual({
      scope: expect.any(String),
      update: expect.any(String),
      check: index.sourceLock.check,
      upstreamCheck: index.sourceLock.upstreamCheck,
    });

    const allPaths: string[] = [];
    for (const group of lock.groups) {
      const groupLines: string[] = [];
      for (const entry of group.files) {
        const bytes = readFileSync(nodePath.join(repoRoot, entry.path));
        const digest = createHash("sha256").update(bytes).digest("hex");
        expect(bytes.byteLength).toBe(entry.byteLength);
        expect(digest).toBe(entry.sha256);
        allPaths.push(entry.path);
        groupLines.push(`${entry.path}\0${entry.byteLength}\0${entry.sha256}\n`);
      }
      expect(createHash("sha256").update(groupLines.join("")).digest("hex")).toBe(
        group.groupSha256,
      );
    }

    expect(new Set(allPaths).size).toBe(allPaths.length);
    expect(allPaths).toEqual(
      expect.arrayContaining([
        "docs/AGENTS.md",
        "apps/home/src/content/AGENTS.md",
      ]),
    );
    const docsAgentInstructions = readFileSync(
      nodePath.join(repoRoot, "docs/AGENTS.md"),
      "utf8",
    );
    expect(docsAgentInstructions).toMatch(/Documentation impact gate/);
    expect(docsAgentInstructions).toMatch(/pnpm docs:check/);
    expect(docsAgentInstructions).toMatch(/pnpm check:upstream-releases/);
    expect(docsAgentInstructions).toMatch(/Never clear a red check.*without first reading/s);
    expect(new Set(lock.groups.map(({ id }) => id))).toEqual(
      new Set([
        "public-docs",
        "home-app",
        "public-routes-and-resources",
        "documentation-gates",
        "wallet-boundary",
        "shared-runtime",
        "contract-consumer-runtime",
        "path-release",
        "path-deployments",
        "thought-runtime",
        "thought-app",
        "thought-contract-release",
      ]),
    );
    expect(
      createHash("sha256")
        .update(lock.groups.map((group) => `${group.id}\0${group.groupSha256}\n`).join(""))
        .digest("hex"),
    ).toBe(lock.sourceTreeSha256);
    expect(() => readFileSync(publicArtifactPath(index.sourceLock.schemaUrl))).not.toThrow();
  });
});
