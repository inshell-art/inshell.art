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
  "/gallery",
  "/path",
  "/pulse",
  "/thought",
  "/verify",
  "/will",
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
    figure.label,
    figure.mode,
    figure.figureText,
    ...figure.items.flatMap(({ title, detail }) => [title, detail]),
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
    expect(movements.figure?.figureText).toContain(
      "PATH: INDIVIDUAL → CROWD → CORE",
    );
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
      label: "WILL: known and forming",
      mode: "field",
    });
    expect(awa?.figure).toMatchObject({
      label: "AWA: known and forming",
      mode: "field",
    });
    expect(will?.figure?.figureText).toMatch(
      /DIRECTION:[\s\S]*FORM: STILL IN DEVELOPMENT[\s\S]*BOUNDARY:/,
    );
    expect(awa?.figure?.figureText).toMatch(
      /DIRECTION:[\s\S]*AGENT ART INVARIANT:[\s\S]*FORM: STILL FORMING[\s\S]*BOUNDARY:/,
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
    expect(will.sections?.find(({ id }) => id === "docs-will-status")).toMatchObject({
      title: "Current study",
      paragraphs: [
        "WILL is planned for 2027. The WILL surface exposes its slogan and current visual study; it is a preview, not a creation or mint surface and not evidence of deployment.",
      ],
    });
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
    expect(movements.links).toContainEqual({ label: "preview WILL ↗", href: "/will" });
    expect(will.links).toContainEqual({ label: "preview WILL ↗", href: "/will" });

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

    expect(consumption?.figure).toMatchObject({
      label: "How one movement unit is consumed",
      mode: "trace",
    });
    expect(consumption?.figure?.items.map(({ title }) => title)).toEqual([
      "Read",
      "Authorize",
      "Submit",
      "Verify + consume",
      "Commit + refresh",
    ]);
    expect(DOCS_AUTHORITY_MAP.path.sectionFigures?.["docs-path-consumption"])
      .toEqual(["contract-release"]);
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

  test("does not revive the obsolete works alias or separate product subdomains", () => {
    const staleLinks = docsLinks()
      .filter(({ href }) => {
        const pathname = href.startsWith("/") ? hrefPathname(href) : null;
        if (pathname === "/works") return true;

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

  test("publishes the canonical gallery and WILL page contexts", () => {
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
    expect(index.pageContexts.find(({ route }) => route === "/will")?.topics).toEqual([
      "will",
      "movements",
    ]);
    expect(index.pageContexts.find(({ route }) => route === "/")?.topics).toEqual(
      expect.arrayContaining(["thought", "artwork-metadata-chain"]),
    );
    expect(
      index.liveReadOnlyResources.find(({ url }) => url === "/api/thought-gallery"),
    ).toMatchObject({ title: "THOUGHT gallery deployment state" });

    const sitemap = readFileSync(nodePath.join(outputRoot, "sitemap.xml"), "utf8");
    expect(sitemap).toContain("https://inshell.art/gallery");
    expect(sitemap).toContain("https://inshell.art/will");
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
    "movements:docs-movements-agent-art": "ledger",
    "thought:docs-thought-work": "field",
    "thought:docs-thought-agent-handoff": "lanes",
    "thought:docs-thought-provenance": "field",
    "will:lead": "field",
    "awa:lead": "field",
    "path:docs-path-capacity": "ledger",
    "path:docs-path-consumption": "trace",
    "pulse:docs-pulse-serial": "trace",
    "pulse:docs-pulse-live-price": "trace",
    "contracts:docs-contracts-responsibilities": "lanes",
    "artwork-metadata-chain:lead": "ledger",
    "mono-76:lead": "trace",
    "verification:docs-verification-levels": "ledger",
    "verification:docs-verification-checklist": "trace",
    "wallet-local-data:lead": "ledger",
    "source-release-boundaries:lead": "ledger",
    "design-principles:lead": "field",
    "design-principles:docs-design-selection": "lanes",
    "design-principles:docs-design-canonical": "field",
  } as const;

  const expectedFieldShapes = {
    "The inward direction": "box-tail",
    "How practice relates to truth": "boxed-chain",
    "The invariant and the open field": "segmented-box",
    "The ordered-pair boundary": "ordered-pair-box",
    "Creation Attestation bindings": "attestation-flow-fork-ceiling",
    "WILL: known and forming": "will-box",
    "AWA: known and forming": "awa-arc-box",
    "Current Inshell principles across systems": "stacked-principle-boxes",
    "Many surfaces, one identified record": "canonical-source-flow",
  } as const;

  function normalizedFigureText(value: string) {
    return value.replace(/│/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }

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

  test("keeps every relationship and figure record in literal character text", () => {
    for (const { figure } of allFigureEntries()) {

      expect(figure.figureText).not.toMatch(/\t| +$/m);
      expect(Math.max(...figure.figureText.split("\n").map((line) => line.length)))
        .toBeLessThanOrEqual(64);

      const normalized = normalizedFigureText(figure.figureText);
      for (const item of figure.items) {
        expect(normalized).toContain(normalizedFigureText(item.title));
        expect(normalized).toContain(normalizedFigureText(item.detail));
        if (figure.mode === "lanes" && "lane" in item) {
          expect(normalized).toContain(normalizedFigureText(item.lane));
          expect(figure.figureText).toContain(`[${String(item.stage).padStart(2, "0")}]`);
          if (item.phase) {
            expect(normalized).toContain(normalizedFigureText(item.phase));
          }
        }
      }

      if (figure.mode === "trace") {
        expect(figure.figureText).toContain("↓");
        if (figure.loop) {
          expect(figure.figureText).toContain("↺");
          expect(normalized).toContain(normalizedFigureText(figure.loop.condition));
        }
      } else if (figure.mode === "ledger") {
        expect(figure.figureText).toContain("│");
        expect(figure.figureText).toContain("┼");
      } else if (figure.mode === "lanes") {
        expect(figure.figureText).toContain("→");
        expect(figure.figureText).toContain("│");
      } else {
        expect(figure.figureText).toMatch(/[┌┐└┘├]/);
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
    const pathConsumptionFigure = topics
      .get("path")
      ?.sections?.find(({ id }) => id === "docs-path-consumption")?.figure;

    expect(inshellFigure).toMatch(
      /SHELL[\s\S]*REAL AND OFTEN NECESSARY[\s\S]*NOT THE WHOLE BEING[\s\S]*INSPECT WHAT FORMS THE SELF/,
    );
    expect(inshellPracticeFigure?.figureText).toMatch(
      /TRUTH: INSPECT SELF[\s\S]*APPROACHES WITHOUT CLAIMING[\s\S]*PRACTICE:[\s\S]*DOES NOT PROVE OR GUARANTEE FREEDOM/,
    );
    expect(agentArtFigure).toMatch(
      /INVARIANT[\s\S]*An Agent participates in the art activity[\s\S]*OPEN QUESTIONS/,
    );
    expect(agentArtFigure).not.toMatch(/NO PRESCRIBED RELATION/);
    expect(pathCapacityFigure?.figureText).toMatch(
      /DEPLOYMENT[\s\S]*Quota \+ authorized minter per movement[\s\S]*ONE PATH[\s\S]*Remaining = quota - this PATH's minted count/,
    );
    expect(pathConsumptionFigure?.figureText).toMatch(
      /^ONE SUCCESSFUL MOVEMENT MINT CONSUMES 1 UNIT/,
    );
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
        expect(figure).toHaveAttribute("data-figure-mode", sourceFigure.mode);
        expect(
          figure.querySelector(
            ".docs-figure__source, .docs-figure__text, details, pre, svg, canvas, img",
          ),
        ).toBeNull();
        expect(figure.textContent).not.toContain(sourceFigure.figureText);

        const visual = figure.querySelector(".docs-figure__visual");
        expect(visual).not.toBeNull();
        expect(
          visual?.querySelectorAll(".docs-figure__term").length,
        ).toBeGreaterThanOrEqual(sourceFigure.items.length);
        expect(
          visual?.querySelectorAll(".docs-figure__annotation").length,
        ).toBeGreaterThanOrEqual(sourceFigure.items.length);
        for (const item of sourceFigure.items) {
          expect(visual).toHaveTextContent(item.title);
          expect(visual).toHaveTextContent(item.detail);
        }

        if (sourceFigure.mode === "trace") {
          expect(
            visual?.querySelector("ol.docs-figure__shape-trace-list"),
          ).not.toBeNull();
          const connectors = [
            ...(visual?.querySelectorAll(
              ".docs-figure__shape-trace-connector > .docs-figure__shape-character",
            ) ?? []),
          ];
          expect(connectors.length).toBeGreaterThanOrEqual(
            sourceFigure.items.length - 1,
          );
          for (const connector of connectors) {
            expect(connector.textContent).toBe("│\n↓");
          }
          if (sourceFigure.loop) expect(visual).toHaveTextContent("↺");
        } else if (sourceFigure.mode === "ledger") {
          expect(
            visual?.querySelector(".docs-figure__shape-ledger[role='table']"),
          ).not.toBeNull();
          const rails = [
            ...(visual?.querySelectorAll(
              ".docs-figure__shape-ledger-rail",
            ) ?? []),
          ];
          expect(rails).toHaveLength(sourceFigure.items.length + 1);
          for (const rail of rails) {
            expect(rail.textContent?.split("\n")).toHaveLength(64);
          }
          expect(
            visual?.querySelectorAll(".docs-figure__shape-ledger-rule"),
          ).toHaveLength(sourceFigure.items.length);
          expect(visual).toHaveTextContent("┼");
        } else if (sourceFigure.mode === "lanes") {
          expect(
            visual?.querySelector(".docs-figure__lanes .docs-figure__lane-events"),
          ).not.toBeNull();
          expect(visual).toHaveTextContent("→");
          expect(visual).toHaveTextContent("│");
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

  test("keeps every lane event on its governing stage track", () => {
    function laneEventGridColumn(figure: HTMLElement, title: string) {
      const term = [...figure.querySelectorAll<HTMLElement>(".docs-figure__term")]
        .find((candidate) => candidate.textContent === title);
      return term?.closest<HTMLElement>(".docs-figure__lane-event")?.style.gridColumn;
    }

    render(<DocsPage topicSlug="thought" />);
    const thought = screen.getByRole("figure", {
      name: "From intention to minted THOUGHT",
    });
    const thoughtLanes = thought.querySelector<HTMLElement>(".docs-figure__lanes");
    expect(
      thoughtLanes?.style.getPropertyValue("--docs-figure-lane-stage-count"),
    ).toBe("6");
    expect(laneEventGridColumn(thought, "Prompt")).toBe("1 / span 3");
    expect(laneEventGridColumn(thought, "Review + choose")).toBe("4 / span 3");
    expect(laneEventGridColumn(thought, "Response")).toBe("2 / span 5");
    expect(laneEventGridColumn(thought, "Validate + assemble")).toBe("3 / span 4");
    expect(laneEventGridColumn(thought, "Authorize + submit")).toBe("5 / span 2");
    expect(laneEventGridColumn(thought, "Validate + record")).toBe("5 / span 2");
    expect(
      within(thought).getByRole("img", { name: "continues at stage 4" }),
    ).toHaveTextContent("···");
    expect(
      thought.querySelector(".docs-figure__lane-separator")?.textContent?.split("\n"),
    ).toHaveLength(64);
    cleanup();

    render(<DocsPage topicSlug="contracts" />);
    const contracts = screen.getByRole("figure", {
      name: "Contract handoffs across issuance and minting",
    });
    expect(contracts.querySelector(".docs-figure__lane-axis")).toBeNull();
    const contractGroups = [
      ...contracts.querySelectorAll<HTMLElement>(".docs-figure__lane-group"),
    ];
    expect(contractGroups).toHaveLength(2);
    for (const group of contractGroups) {
      expect(
        group.style.getPropertyValue("--docs-figure-lane-stage-count"),
      ).toBe("3");
    }
    for (const [title, column] of [
      ["Settle", 1],
      ["Issue", 2],
      ["Record PATH", 3],
      ["Validate work", 1],
      ["Consume permission", 2],
      ["Mint + record", 3],
    ] as const) {
      expect(laneEventGridColumn(contracts, title)).toBe(`${column} / span 1`);
    }
    cleanup();

    render(<DocsPage topicSlug="design-principles" />);
    const preservation = screen.getByRole("figure", {
      name: "Two preservation boundaries",
    });
    expect(
      preservation.querySelectorAll(".docs-figure__lane-group"),
    ).toHaveLength(2);
    for (const [title, column] of [
      ["Agent return", 1],
      ["Human review", 2],
      ["Successful mint", 3],
      ["Public corpus", 4],
      ["Visible ask", 1],
      ["Confirmed bid", 2],
      ["Settlement", 3],
      ["Sale record", 4],
    ] as const) {
      expect(laneEventGridColumn(preservation, title)).toBe(`${column} / span 1`);
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

  test("preserves representative box, chain, segment, fork, arc, and source-flow relations", () => {
    render(<DocsPage topicSlug="inshell" />);
    const inward = screen
      .getByRole("figure", { name: "The inward direction" })
      .querySelector("[data-figure-shape='box-tail']");
    const practice = screen
      .getByRole("figure", { name: "How practice relates to truth" })
      .querySelector("[data-figure-shape='boxed-chain']");

    expect(inward).toHaveTextContent(/┌─+\s*SHELL[─\s]*┐/i);
    expect(inward).toHaveTextContent(/└[─\s]*┬[─\s]*┘/);
    expect(
      inward?.querySelector(".docs-figure__field-relation"),
    ).toHaveTextContent(/│\s*│\s*│\s*IN/i);
    expect(inward?.querySelector(".docs-figure__field-tail"))
      .toHaveTextContent(/IN\s*│\s*↓/i);
    expect(
      inward?.querySelector(".docs-figure__field-relation-label"),
    ).toHaveClass("docs-figure__term");
    const practiceConnectors = [
      ...(practice?.querySelectorAll(".docs-figure__field-connector") ?? []),
    ];
    expect(practiceConnectors).toHaveLength(2);
    for (const connector of practiceConnectors) {
      expect(connector.querySelectorAll(".docs-figure__glyph")).toHaveLength(1);
      expect(connector.querySelector(".docs-figure__glyph")?.textContent).toBe(
        "↑\n│",
      );
    }
    expect(practice).toHaveTextContent(/TRUTH[\s\S]*↑[\s\S]*RELATION[\s\S]*↑[\s\S]*PRACTICE/i);
    cleanup();

    render(<DocsPage topicSlug="agent-art" />);
    const segmented = screen
      .getByRole("figure", { name: "The invariant and the open field" })
      .querySelector("[data-figure-shape='segmented-box']");
    const segmentedDividers = segmented?.querySelectorAll(
      ".docs-figure__field-divider",
    );
    expect(segmentedDividers).toHaveLength(1);
    const [dividerStart, dividerLabel, dividerRail, dividerEnd] = [
      ...(segmentedDividers?.[0]?.children ?? []),
    ];
    expect(dividerStart).toHaveClass("docs-figure__frame-character");
    expect(dividerLabel).toHaveClass("docs-figure__eyebrow");
    expect(dividerRail).toHaveClass("docs-figure__frame-rule");
    expect(dividerEnd).toHaveClass("docs-figure__frame-character");
    expect(segmented).toHaveTextContent("├─");
    expect(segmented).toHaveTextContent("┤");
    expect(
      screen.queryByRole("figure", { name: "One practice within Agent Art" }),
    ).not.toBeInTheDocument();
    cleanup();

    render(<DocsPage topicSlug="thought" />);
    const attestation = screen
      .getByRole("figure", { name: "Creation Attestation bindings" })
      .querySelector("[data-figure-shape='attestation-flow-fork-ceiling']");

    expect(attestation?.querySelectorAll(".docs-figure__field-fork-branch"))
      .toHaveLength(2);
    expect(
      attestation?.querySelector(".docs-figure__field-fork-stem")?.textContent,
    ).toContain("│");
    expect(
      attestation?.querySelector(".docs-figure__field-fork-continuation")
        ?.textContent,
    ).toContain("│");
    expect(attestation).toHaveTextContent(/CONTRACT VALIDATION[\s\S]*├─[\s\S]*APP ATTESTED/i);
    expect(attestation).toHaveTextContent(/└─[\s\S]*UNATTESTED/i);
    expect(
      attestation?.querySelector(".docs-figure__field-ceiling"),
    ).toHaveTextContent(/CLAIM CEILING/i);
    cleanup();

    render(<DocsPage topicSlug="awa" />);
    const awa = screen
      .getByRole("figure", { name: "AWA: known and forming" })
      .querySelector("[data-figure-shape='awa-arc-box']");
    expect(awa).toHaveTextContent(
      /THOUGHT[\s\S]*INDIVIDUAL[\s\S]*→[\s\S]*WILL[\s\S]*CROWD[\s\S]*→[\s\S]*AWA[\s\S]*TOWARD THE CORE/i,
    );
    cleanup();

    render(<DocsPage topicSlug="design-principles" />);
    const principles = screen
      .getByRole("figure", { name: "Current Inshell principles across systems" })
      .querySelector("[data-figure-shape='stacked-principle-boxes']");
    const sourceFlow = screen
      .getByRole("figure", { name: "Many surfaces, one identified record" })
      .querySelector("[data-figure-shape='canonical-source-flow']");

    expect(principles?.querySelectorAll(".docs-figure__character-frame"))
      .toHaveLength(5);
    expect(sourceFlow).toHaveTextContent(
      /IDENTIFIED ONCHAIN WORK[\s\S]*ORIGIN[\s\S]*│[\s\S]*↓[\s\S]*READING SURFACES/i,
    );
    expect(
      sourceFlow?.querySelector(".docs-figure__field-connector")?.textContent,
    ).toBe("│\n↓");
  });

  test("uses literal DOM logic and exactly three figure typography tiers", () => {
    const css = readFileSync(nodePath.resolve(cwd(), "src/main.css"), "utf8");
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
      ".docs-figure__lane-heading",
      ".docs-figure__shape-ledger-header",
      ".docs-figure__lane-event-label",
    ]) {
      expectSelectorTier(selector, "--docs-figure-title-font-size");
    }
    expectSelectorTier(".docs-figure__term", "--docs-figure-term-font-size");
    for (const selector of [
      ".docs-figure__annotation",
      ".docs-figure__marker",
      ".docs-figure__eyebrow",
    ]) {
      expectSelectorTier(selector, "--docs-figure-annotation-font-size");
    }
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
        agentTransport: { id: string; sha256: string };
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
        figure: ({ authorities: DocsAuthority[] } & DocsFigure) | null;
        preformatted: Array<{
          authorities: DocsAuthority[];
          label: string;
          content: string;
        }>;
        sections: Array<{
          authorities: DocsAuthority[];
          id: string;
          title: string;
          figure?: { authorities: DocsAuthority[] } & DocsFigure;
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
      schema: "inshell.agent-docs.content.v1",
      schemaUrl: "/docs/content.schema.json",
      canonicalSchemaUrl: `${canonicalOrigin}/docs/content.schema.json`,
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
        schema: "inshell.agent-docs.topic.v1",
        schemaUrl: "/docs/content.schema.json",
        canonicalSchemaUrl: `${canonicalOrigin}/docs/content.schema.json`,
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

  test("keeps the published schema enums aligned with index classifications", () => {
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
        figure: { properties: { mode: { enum: string[] } } };
        section: { properties: { figure: { $ref: string } } };
        topicDocument: {
          properties: { status: { enum: string[] } };
        };
      };
    }>(nodePath.join(docsRoot, "content.schema.json"));

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
    expect(contentSchema.$defs.section.properties.figure.$ref).toBe(
      "#/$defs/figure",
    );
    expect(new Set(contentSchema.$defs.topicDocument.properties.status.enum)).toEqual(
      new Set(["current", "study", "future"]),
    );
  });

  test("keeps every source field and link represented in topic and complete Markdown", () => {
    const completeMarkdown = readFileSync(nodePath.join(docsRoot, "index.md"), "utf8");

    for (const topic of DOCS_SOURCE.topics) {
      const markdown = readFileSync(nodePath.join(docsRoot, `${topic.slug}.md`), "utf8");
      for (const { sectionId, figure } of topicFigureEntries(topic)) {
        const fencedFigure = `\`\`\`text\n${figure.figureText}\n\`\`\``;
        expect(markdown).toContain(fencedFigure);
        expect(completeMarkdown).toContain(fencedFigure);
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
