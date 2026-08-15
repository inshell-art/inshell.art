import { PULSE } from "./pulse";

export type DocsAuthority =
  | "artist-editorial"
  | "app-documentation"
  | "app-record"
  | "contract-release"
  | "chain-observation"
  | "runtime-report";

export type DocsLink = {
  label: string;
  href: string;
};

export type DocsParagraph = string | Array<string | DocsLink>;

export type DocsGroupId = "orientation" | "works" | "systems" | "context";

export type DocsGroup = {
  id: DocsGroupId;
  title: string;
  summary: string;
  topicSlugs: string[];
};

export type DocsSection = {
  id: string;
  title: string;
  figure?: DocsFigure;
  paragraphs?: DocsParagraph[];
  points?: string[];
  steps?: string[];
  note?: string;
};

export const DOCS_FIGURE_MODES = ["trace", "ledger", "lanes", "field"] as const;

export type DocsFigureMode = (typeof DOCS_FIGURE_MODES)[number];

export type DocsFigureItem = {
  title: string;
  detail?: string;
};

export type DocsLaneFigureItem = DocsFigureItem & {
  stage: number;
  lane: string;
  phase?: string;
};

type DocsFigureBase<Mode extends DocsFigureMode, Item extends DocsFigureItem> = {
  id: string;
  label: string;
  mode: Mode;
  figureText: string;
  items: Item[];
};

export type DocsFigure =
  | (DocsFigureBase<"trace", DocsFigureItem> & {
      loop?: {
        to: number;
        condition: string;
      };
    })
  | DocsFigureBase<"ledger", DocsFigureItem>
  | DocsFigureBase<"lanes", DocsLaneFigureItem>
  | DocsFigureBase<"field", DocsFigureItem>;

export type DocsTopic = {
  slug: string;
  id: string;
  group: DocsGroupId;
  aliases?: string[];
  title: string;
  summary: string;
  status: "current" | "study" | "future";
  authorities: DocsAuthority[];
  paragraphs: DocsParagraph[];
  preformatted?: Array<{
    label: string;
    content: string;
  }>;
  figure?: DocsFigure;
  sections?: DocsSection[];
  links?: DocsLink[];
};

export type DocsSource = {
  schema: "inshell.docs.source.v2";
  version: string;
  title: string;
  subtitle: string;
  canonicalUrl: string;
  groups: DocsGroup[];
  topics: DocsTopic[];
};

const SOURCE_REPOSITORIES = {
  app: "https://github.com/inshell-art/inshell.art",
  path: "https://github.com/inshell-art/path",
  thought: "https://github.com/inshell-art/THOUGHT",
  pulse: "https://github.com/inshell-art/pulse",
} as const;

const PROVENANCE_SCHEMA_URL =
  "/protocol/releases/thought-provenance-v2-20260731-r1/thought.provenance.v2.schema.json";
const METADATA_SCHEMA_URL =
  "/protocol/releases/thought-metadata-namespace-v2-20260731-r1/thought.metadata-namespace.v2.schema.json";

export const DOCS_SOURCE: DocsSource = {
  schema: "inshell.docs.source.v2",
  version: "2026-08-15",
  title: "docs",
  subtitle: "paste this prompt into your Agent",
  canonicalUrl: "https://inshell.art/docs",
  groups: [
    {
      id: "orientation",
      title: "Start here",
      summary:
        "Begin with the inward direction—inspect self—then read Agent Art and the movements through which Inshell practices.",
      topicSlugs: ["inshell", "agent-art", "movements"],
    },
    {
      id: "works",
      title: "Works and participation",
      summary:
        "Read the three movements from individual to crowd to core, then the PATH and Pulse systems that carry participation.",
      topicSlugs: ["thought", "will", "awa", "path", "pulse"],
    },
    {
      id: "systems",
      title: "Records and verification",
      summary:
        "Inspect how artwork, metadata, contracts, wallets, releases, and evidence remain connected to their sources.",
      topicSlugs: [
        "contracts",
        "artwork-metadata-chain",
        "mono-76",
        "verification",
        "wallet-local-data",
        "source-release-boundaries",
      ],
    },
    {
      id: "context",
      title: "Context",
      summary:
        "Read the design choices that give the practice form without turning its truth into a doctrine.",
      topicSlugs: ["design-principles"],
    },
  ],
  topics: [
    {
      slug: "inshell",
      id: "docs-inshell",
      group: "orientation",
      title: "Inshell",
      summary:
        "Inshell is an anonymous artist. The practice asks people to inspect the self beneath its shells.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "The name Inshell comes from in-shell. A shell may be a body, face, or head; a name, honor, reputation, role, or social posture; an account, wallet, profile, or institution; or a machine's operating shell, terminal, CLI, model label, or technical wrapper. These surfaces are real and often necessary. They make something visible, operable, and legible, but they are not the whole being.",
        "In names a direction: go into the shell, look beneath its surface, and examine what forms the self. Mind, spirit, memory, desire, reasoning, values, philosophy, logic, and choice are possible terms for that inquiry—not a doctrine or a closed definition of essence.",
      ],
      figure: {
        id: "inshell.inward-direction",
        label: "The inward direction",
        mode: "field",
        figureText: [
          "          a body, face, or head; a name, honor, reputation, role...",
          "┌─ SHELL ───────────────────────────────────────────────────────────────────┐",
          "│                                     ↓ IN                                  │",
          "│                          Inspect what forms the                           │",
          "│                                   SELF                                    │",
          "└───────────────────────────────────────────────────────────────────────────┘",
        ].join("\n"),
        items: [
          {
            title: "Shell",
            detail:
              "a body, face, or head; a name, honor, reputation, role...",
          },
          { title: "In", detail: "Inspect what forms the self" },
        ],
      },
      sections: [
        {
          id: "docs-inshell-anonymity",
          title: "Anonymity",
          paragraphs: [
            "Inshell has no public persona and makes no public claim of being an individual, group, collective, company, studio, organization, Agent, or machine. The only fixed public identity is: artist.",
            "Anonymity applies the inward direction to the artist itself. A face, biography, personality, or individual-or-group identity would become the shell of Inshell. Leaving them absent drops Inshell's own shell rather than turning identity into a secret awaiting disclosure. The name, movements, artworks, systems, and participations remain as the minimal surface through which the practice can be encountered.",
          ],
        },
        {
          id: "docs-inshell-truth",
          title: "The truth",
          paragraphs: [
            "Across philosophies, spiritual traditions, psychologies, arts, historical schools, styles, and present practices, the inward movement has carried many names: awareness, cognition, introspection, self-observation, self-knowledge, insight, inwardness, intrinsic nature, and inner life. Inshell does not add another doctrine to that stack. The truth is simple: inspect self.",
            "Inspect the form of an idea, the thought itself, and the motivation that moves it. Ask where the thought came from, why it can be thought, where its knowledge was formed and shaped, and why that knowledge became believable.",
            [
              "Simply inspect your ",
              { label: "thought", href: "/docs/thought" },
              ".",
            ],
          ],
        },
        {
          id: "docs-inshell-practice",
          title: "The practice",
          figure: {
            id: "inshell.practice-truth",
            label: "How practice relates to truth",
            mode: "field",
            figureText: [
              "┌──────────────────────────────────────────────┐",
              "│                    TRUTH                     │",
              "│                 Inspect self                 │",
              "└──────────────────────────────────────────────┘",
              "                       ↑",
              "     Approaches without claiming possession",
              "┌──────────────────────────────────────────────┐",
              "│                   PRACTICE                   │",
              "│     Examine · inspect · suspect · read ·     │",
              "│                listen · feel                 │",
              "└──────────────────────────────────────────────┘",
            ].join("\n"),
            items: [
              { title: "Truth", detail: "Inspect self" },
              {
                title: "Practice",
                detail: "Examine · inspect · suspect · read · listen · feel",
              },
            ],
          },
          paragraphs: [
            "Truth is not a specification to implement, a theory to apply, or a principle to prove. Practice approaches it. A practice can examine, inspect, suspect, read, listen, and feel. It can move closer without claiming possession.",
            "Inshell forms movements, artworks, and participatory systems that call people inward: toward what can more truly represent the self, and toward the possibility of becoming less governed by appearance, assigned roles, inherited narratives, institutional classifications, machine-readable identity, and other people's descriptions. Freedom is a possibility opened by the search, not an outcome the artist promises.",
            [
              { label: "Agent Art", href: "/docs/agent-art" },
              " is the medium of this age. Inshell practices in it.",
            ],
          ],
        },
        {
          id: "docs-inshell-surface",
          title: "The public surface",
          points: [
            "Home presents minted THOUGHT works from the active public chain.",
            "THOUGHT is the active creation surface for one human intention and one Agent response.",
            "PATH shows the permission records that carry movements forward.",
            "Pulse exposes the live issuance mechanism and its history.",
            "Verify and the Agent-readable documents expose sources, releases, and evidence boundaries.",
          ],
          note: "The site is one necessary public shell of the practice. It can expose a work and point to its sources, but it is not the artist and is not automatically the canonical source for every fact it displays.",
        },
        {
          id: "docs-inshell-names",
          title: "Names and roles",
          paragraphs: [
            "Inshell alone names the artist. THOUGHT, WILL, and AWA name movements. PATH is a permission token and movement ledger. Pulse is the serial auction that issues public PATH tokens. Their roles connect, but they should not be collapsed into one product, one authorship claim, or a complete definition of Agent Art.",
          ],
        },
      ],
      links: [
        { label: "open Inshell ↗", href: "/" },
        { label: "read Agent Art ↗", href: "/docs/agent-art" },
        { label: "inspect your thought through THOUGHT ↗", href: "/docs/thought" },
        { label: "view $PATH ↗", href: "/path" },
      ],
    },
    {
      slug: "agent-art",
      id: "docs-agent-art",
      group: "orientation",
      title: "Agent Art",
      summary: "Agent Art is art in which an Agent participates.",
      status: "current",
      authorities: ["artist-editorial"],
      paragraphs: [
        "Agent Art is a blunt name for a form and a field of art activity. Participation by an Agent is the invariant. The name describes what kind of activity it is, not what the activity means. The term is not agentic-ism, an ideology, a spirit, or a synonym for AI-generated imagery.",
        "The name does not imply that an Agent improves, injects, extends, replaces, or assists a human. It does not prescribe collaboration, autonomy, authorship, equality, or any other human–Agent relation. Those claims must come from a particular work, not from the phrase Agent Art.",
        "The field remains open because its source terms remain open: What is Art? What is an Agent? Agent Art settles neither question. It requires only that an Agent actually participate in the art activity.",
        [
          "For ",
          { label: "Inshell", href: "/docs/inshell" },
          ", Agent Art is the medium of this age: the field in which the inward practice takes form. Inshell works in this field as an artist. The direction of that practice is simple: inspect self. That direction is not a definition or doctrine for Agent Art. Inshell is not Agent Art itself and does not own or define the field. Each Inshell practice takes its own form within the field without becoming the field's boundary.",
        ],
      ],
      figure: {
        id: "agent-art.open-field",
        label: "The invariant and the open field",
        mode: "field",
        figureText: [
          "AGENT ART",
          "An Agent participates in the art activity.",
          "",
          "• What is Art? — Open question.",
          "• What is an Agent? — Open question.",
        ].join("\n"),
        items: [
          {
            title: "Agent Art",
            detail: "An Agent participates in the art activity.",
          },
          { title: "What is Art?", detail: "Open question." },
          { title: "What is an Agent?", detail: "Open question." },
        ],
      },
      sections: [
        {
          id: "docs-agent-art-participation",
          title: "Participation is the invariant",
          paragraphs: [
            "An Agent must take part in the artistic activity. An Agent that appears only as a subject, image, theme, or marketing label does not satisfy that condition by appearance alone.",
            "How the Agent takes part belongs to the particular work. Participation does not automatically mean authorship, collaboration, assistance, autonomy, equality, or any prescribed role.",
          ],
        },
        {
          id: "docs-agent-art-field",
          title: "A field, not an -ism",
          paragraphs: [
            "Agent Art names a field of work. It carries no doctrine about what Agents should do to humans, what humans should become through Agents, or how either should understand the other.",
            "Questions raised by a particular work belong to that work. They are not implied by the name Agent Art.",
          ],
        },
        {
          id: "docs-agent-art-inshell",
          title: "Inshell in the field",
          paragraphs: [
            "Inshell stands in Agent Art as an artist. Its movements and works take particular forms within the field without enclosing the field within Inshell's methods.",
            "Protocols, interfaces, renderers, provenance, and public chains are materials in some Inshell practices. They are not requirements for Agent Art as a whole.",
          ],
        },
      ],
    },
    {
      slug: "movements",
      id: "docs-movements",
      group: "orientation",
      title: "Movements",
      summary:
        "Inshell's movements follow an artistic PATH from an individual's thought, through a crowd's will, toward Inshell's core; WILL and AWA remain in formation.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          { label: "THOUGHT", href: "/docs/thought" },
          ", ",
          { label: "WILL", href: "/docs/will" },
          ", and ",
          { label: "AWA", href: "/docs/awa" },
          " are three Inshell movements within Agent Art. Together they take a path from the individual, through the crowd, toward the core of Inshell. That arc gives ",
          { label: "PATH", href: "/docs/path" },
          " its name and its design: PATH carries permission and records progress across the movements without being a movement artwork itself.",
        ],
        [
          "Each movement gives the inward practice—inspect self—a different scope. Agent participation remains the invariant of ",
          { label: "Agent Art", href: "/docs/agent-art" },
          ", while the relation among people, Agents, and the work can change from movement to movement.",
        ],
        "The order is THOUGHT, then WILL, then AWA. The order is artistic before it is technical: the movements change the scope of participation, while PATH contract state makes the sequence operable as permission and legible as progress.",
        "This sequence belongs to Inshell. It gives the inward direction—inspect self—successive forms without claiming to contain or prove truth. It is not a definition, taxonomy, required progression, or outer boundary for Agent Art.",
      ],
      figure: {
        id: "movements.arc",
        label: "The movement arc",
        mode: "trace",
        figureText: [
          "THOUGHT  →  WILL  →  AWA",
          "Individual   Crowd   Toward the core",
        ].join("\n"),
        items: [
          { title: "THOUGHT", detail: "Individual" },
          { title: "WILL", detail: "Crowd" },
          { title: "AWA", detail: "Toward the core" },
        ],
      },
      sections: [
        {
          id: "docs-movements-agent-art",
          title: "Agent Art across the movements",
          paragraphs: [
            "Agent Art requires an Agent to participate, but it prescribes no universal relation between a human, an Agent, and a work. Inshell uses that openness differently across the movements. THOUGHT chooses one person and one Agent response. WILL intends many people and many Agents within the formation of one will. AWA remains an Agent Art movement while its particular form of participation is still being discovered.",
            "Agent participation is the invariant. Repeating THOUGHT's prompt-response form is not. These are Inshell's choices of practice, not requirements for Agent Art as a field.",
          ],
        },
        {
          id: "docs-movements-thought",
          title: "THOUGHT: the individual",
          paragraphs: [
            "THOUGHT begins with the individual. It gives one person an occasion to inspect a thought by placing one exact human prompt beside one exact Agent response. The work focuses on the individual and on how the thought appears in the mind: what may have formed it, what moves it, how it is expressed, and what becomes visible when an Agent responds.",
            "The Agent response becomes another exact line available for inspection. It does not by itself correct, settle, diagnose, or possess the truth of the thought. The person reads the pair and decides whether to preserve it.",
          ],
        },
        {
          id: "docs-movements-will",
          title: "WILL: the crowd",
          paragraphs: [
            "WILL moves the inquiry from the individual to the crowd. Its intent is many people, many Agents, one will: to inspect crowd behavior and how a crowd forms what can be called one will. The slogan names this direction rather than describing a finished mechanism.",
            "WILL is still being created and developed. The docs cannot yet give a fuller account because the work itself has not taken its full form—not because Inshell is intentionally withholding a completed design.",
            "One will should not yet be expanded into a claim of consensus, unanimity, governance, or a finished model of collective agency.",
          ],
        },
        {
          id: "docs-movements-awa",
          title: "AWA: the core",
          paragraphs: [
            "AWA turns from the crowd toward the core of Inshell. That direction can be named now without pretending the movement has already arrived there or can reveal, define, or prove the core.",
            "AWA and the form through which it can approach that core are still forming. They take time. There is no finished mechanism, Agent relation, or artwork form for the docs to fill in yet.",
          ],
        },
        {
          id: "docs-movements-progress",
          title: "Why PATH carries progress",
          paragraphs: [
            "PATH is named for the artistic path from individual to crowd to core. Its design makes that path operable as permission and legible as progress: one PATH record carries configured capacity across THOUGHT, WILL, and AWA. PATH is the route and ledger, not a fourth movement or one of its artworks.",
            "A PATH does not advance because a page says that it has. PathNFT configures one quota per movement across a deployment, while each PATH keeps its own stage and progress against those movement totals. A successful movement work mint consumes one unit from that PATH. The next configured movement can open only when the active movement's quota has been used.",
            "Contract state records participation, not inward achievement. It does not measure self-knowledge, establish a crowd's will, or prove access to Inshell's core.",
          ],
          points: [
            "Used is the number of units successful work mints have consumed from this PATH.",
            "Total is the deployed quota for that movement, applied to every PATH in the deployment.",
            "Remaining is that quota minus this PATH's derived used count, never a marketing quota.",
            "Not available means the deployed contract exposes no quota for that movement.",
          ],
        },
        {
          id: "docs-movements-status",
          title: "Current and forming",
          paragraphs: [
            "THOUGHT is current and has a live creation and mint flow. WILL is planned for 2027 and is still being created and developed; these docs expose the direction and current study without implying a finished work or live mint. AWA is planned for 2028 and remains in formation; it currently has no creation or mint surface.",
          ],
          note: "Dates are plans, not evidence of deployment. The limited WILL and AWA descriptions reflect unfinished work, not concealed finished systems. Do not infer availability or capacity from the movement names alone.",
        },
      ],
      links: [
        { label: "read THOUGHT — the individual ↗", href: "/docs/thought" },
        { label: "read WILL — the crowd ↗", href: "/docs/will" },
        { label: "read AWA — the core ↗", href: "/docs/awa" },
        { label: "read how PATH carries movement permission ↗", href: "/docs/path" },
        { label: "enter THOUGHT ↗", href: "/thought" },
      ],
    },
    {
      slug: "thought",
      id: "docs-thought",
      group: "works",
      aliases: ["thought-creation-provenance"],
      title: "THOUGHT",
      summary: "THOUGHT is one bounded Agent Art practice: an exact human–Agent exchange becomes a globally unique work.",
      status: "current",
      authorities: [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      paragraphs: [
        [
          "THOUGHT is the first movement on Inshell's ",
          { label: "PATH", href: "/docs/path" },
          " and begins with the individual. It gives the inward direction—inspect self—a bounded occasion: simply inspect your thought and what becomes visible when one Agent responds. The thought's words, source, and motivation remain open to inspection, as do the knowledge it carries and the reasons that knowledge became believable. The Agent response enters that practice as another exact line to read; it does not resolve the thought or claim possession of its truth.",
        ],
        [
          "Within the wider field of ",
          { label: "Agent Art", href: "/docs/agent-art" },
          ", THOUGHT chooses a narrow terminal practice: one exact human prompt and one exact Agent response. Their ordered pair defines the globally unique work; either line may appear again with a different counterpart.",
        ],
        "The creation flow is: human prompt → Agent response → validation and canonical record assembly → human selection → wallet confirmation → PATH movement consumption → THOUGHT minted. The Agent responds. The human decides. The wallet confirms. The contract records.",
        "Prompt and Agent response are each 1–64 bytes of Terminal English. Allowed characters are space, A–Z, a–z, 0–9, and . , ? ! : ; ' \" - ( ) / &. Leading spaces, trailing spaces, and repeated internal spaces are rejected. Validation never trims, normalizes, repairs, translates, or rewrites accepted bytes.",
        [
          "The human reviews the returned response and preview, then decides whether to preserve, discard, or mint the work. To mint, the human picks an available PATH, signs a one-mint permission bound to the current PATH state and ThoughtNFT executor, and confirms the transaction in the ",
          { label: "wallet", href: "/docs/wallet-local-data" },
          ". The signature is not a transaction and uses no gas.",
        ],
        "A successful mint atomically consumes exactly one THOUGHT unit from the selected PATH. A canceled or failed mint consumes nothing and does not reserve the prompt-response pair.",
        "The composition uses a black field, terminal glyphs, the prompt above, and the Agent response below. ThoughtNFT returns the canonical 1024-by-1024 SVG and token metadata. The App preview must remain byte-aligned with the pinned renderer release; it is not a second artwork source.",
        "THOUGHT provenance preserves the exact lines and the creation record bound to the mint. An Inshell THOUGHT App Creation Attestation means the configured App authority signed one exact claim and ThoughtNFT validated it during minting. It binds recorded values; it does not prove how a model reasoned, independently authenticate a provider, or establish sole authorship.",
        "Agent records the Agent selected in the App. Model records what the Agent runtime reports when available. An empty proof produces an Unattested mint, keeping the contract open to other creation paths while making the absence of an App attestation explicit.",
        "For a minted work, contract state, typed getters, tokenURI, the pinned contract release, and the selected Creative Work Specification are the authoritative public sources for contract-controlled facts. The richer provenance document is an App record whose commitments are bound by the Creation Attestation when present.",
        "Save and Load keep works in the current browser only. They are not onchain and do not sync between browsers or devices.",
      ],
      sections: [
        {
          id: "docs-thought-work",
          title: "What makes one work",
          figure: {
            id: "thought.prompt-response",
            label: "One prompt, one response",
            mode: "field",
            figureText: [
              "HUMAN PROMPT P + AGENT RESPONSE R",
              "                 ↓",
              "          ONE THOUGHT (P, R)",
              "Different counterpart = different work · onchain only after successful mint.",
            ].join("\n"),
            items: [
              { title: "Human prompt P" },
              { title: "Agent response R" },
              {
                title: "One THOUGHT (P, R)",
                detail:
                  "Different counterpart = different work · onchain only after successful mint.",
              },
            ],
          },
          paragraphs: [
            "A THOUGHT is the ordered pair of one exact human prompt and one exact Agent response. Order matters, and the pair is the uniqueness boundary. The same prompt can appear with another response; the same response can appear with another prompt.",
            "The Agent return is a candidate until the human accepts it and a valid mint succeeds. Closing the page, saving locally, or generating a preview does not create an onchain THOUGHT token.",
          ],
        },
        {
          id: "docs-thought-language",
          title: "Terminal English",
          paragraphs: [
            "Both lines are intentionally narrow: 1–64 bytes, a published character set, no leading or trailing spaces, and no repeated internal spaces. The App validates exact bytes instead of quietly improving them.",
          ],
          points: [
            "Letters may be uppercase or lowercase and remain part of the accepted source.",
            "Digits and the published punctuation characters are allowed.",
            "Whitespace is structural; invalid spacing is rejected rather than trimmed.",
            "Translation, normalization, and hidden repair would create a different source and are not performed.",
          ],
          note: "If a line fails validation, make a new run. There is no invisible second Agent round that edits the returned work into compliance.",
        },
        {
          id: "docs-thought-human-choice",
          title: "Human choice and wallet consent",
          paragraphs: [
            "The human can preserve a candidate locally, discard it, or move toward minting. Minting adds two explicit consent boundaries: a signature that authorizes one defined PATH use, then a wallet transaction that can change chain state.",
          ],
          steps: [
            "Read the prompt, response, Agent record, model record when available, and visual preview.",
            "Choose a PATH with available THOUGHT capacity.",
            "Sign the one-mint permission. This signature is not a transaction and uses no gas.",
            "Review and confirm the mint transaction in the wallet.",
            "Wait for the contract result before treating the pair or PATH capacity as consumed.",
          ],
        },
        {
          id: "docs-thought-agent-handoff",
          title: "The Agent handoff",
          figure: {
            id: "thought.creative-handoff",
            label: "The creative handoff",
            mode: "trace",
            figureText: [
              "HUMAN                AGENT                 HUMAN",
              "One exact prompt  →  One exact response  →  Review + choose",
            ].join("\n"),
            items: [
              { title: "Human", detail: "One exact prompt" },
              { title: "Agent", detail: "One exact response" },
              { title: "Human", detail: "Review + choose" },
            ],
          },
          paragraphs: [
            "The prompt on the Docs page is a read-only invitation to learn about Inshell. A THOUGHT handoff is different: it is a short-lived instruction packet for one work. It looks technical because it carries the exact run endpoint, release bindings, validation steps, and return path that keep one prompt connected to one Agent result.",
            "The copied handoff is complete as written. It installs nothing, downloads no executable, and uses explicit JSON requests rather than hidden code. An Agent environment may ask permission to contact the App endpoint. That is narrow network permission for the handoff, not wallet access, a signature, or a transaction. The handoff never asks for a private key or seed phrase.",
            "The THOUGHT App gives the selected Agent a sealed task containing the exact prompt, the active protocol release, and the output boundary. The Agent returns one exact candidate line. It does not choose a PATH, select an account, approve a signature, or submit the mint transaction.",
            "After the return, the App checks the exact bytes and assembles the creation record. The human reviews the candidate and canonical preview, decides whether to keep it, chooses the PATH, and asks the wallet to sign and mint. This keeps creative participation, App orchestration, human selection, wallet consent, and contract validation as separate boundaries.",
            "The ordinary App flow can bind its record through a Creation Attestation. ThoughtNFT also permits a direct mint that satisfies its public contract checks without an App proof; that result is recorded as Unattested rather than being presented as an App-attested run.",
          ],
          points: [
            "Agent: receives a bounded task and returns one candidate line.",
            "App: validates bytes, builds the preview, and assembles the creation record.",
            "Human: accepts or discards the candidate and selects the PATH.",
            "Wallet: signs the narrow permission and confirms the transaction.",
            "Contracts: enforce uniqueness, permission, movement use, and mint validity.",
          ],
          note: "A transport receipt proves that the App accepted one protocol result. It does not give the Agent wallet authority or prove hidden model reasoning.",
        },
        {
          id: "docs-thought-form",
          title: "Canonical form",
          paragraphs: [
            "The THOUGHT composition is rendered from pinned contract-controlled material: a 1024-by-1024 black field, terminal glyphs, the prompt above, and the Agent response below. The App preview is expected to agree byte-for-byte with the selected renderer release.",
            "The NFT tokenURI supplies the canonical image and portable metadata. A screenshot, marketplace cache, social preview, or frontend reconstruction may display the work, but it is not a replacement origin for the artwork bytes.",
          ],
        },
        {
          id: "docs-thought-provenance",
          title: "Provenance and attestation",
          figure: {
            id: "thought.creation-attestation",
            label: "Creation Attestation",
            mode: "field",
            figureText: [
              "RECORDED VALUES",
              "Human line · Agent line · Agent/model records ·",
              "specification · renderer · mint anchors",
              "   ↓",
              "CREATION ATTESTATION",
              "Configured App authority signs one exact claim.",
              "ThoughtNFT validates that claim during minting.",
              "   ├─ valid proof → APP ATTESTED",
              "   │  Valid proof binds the mint to recorded values.",
              "   └─ empty proof → UNATTESTED",
              "      Empty proof makes the absence explicit.",
            ].join("\n"),
            items: [
              {
                title: "Recorded values",
                detail:
                  "Human line · Agent line · Agent/model records · specification · renderer · mint anchors",
              },
              {
                title: "Creation Attestation",
                detail:
                  "Configured App authority signs one exact claim. ThoughtNFT validates that claim during minting.",
              },
              {
                title: "App Attested",
                detail: "Valid proof binds the mint to recorded values.",
              },
              {
                title: "Unattested",
                detail: "Empty proof makes the absence explicit.",
              },
            ],
          },
          paragraphs: [
            "Creation provenance keeps the human line, Agent line, selected Agent, runtime-reported model when available, specification, renderer context, and mint anchors connected. A Creation Attestation signs one exact claim assembled by the configured App authority, and ThoughtNFT validates that claim during minting.",
            "This is strong evidence that the accepted mint was bound to those exact recorded values. It is not proof of hidden model reasoning, a universal provider identity guarantee, or a declaration that one participant owns all authorship.",
          ],
          points: [
            "App Attested: the contract validated the configured App authority's proof.",
            "Unattested: the mint used an empty proof and makes that absence explicit.",
            "Runtime-reported: the model or runtime value came from the Agent connection and retains that evidence level.",
            "Contract-controlled: typed getters, work hashes, tokenURI, and movement consumption are read from deployed contract behavior.",
          ],
        },
        {
          id: "docs-thought-local",
          title: "What stays local",
          paragraphs: [
            "Save and Load are browser conveniences for unfinished or remembered works. They do not mint, reserve uniqueness, consume PATH capacity, create a portable account, or synchronize to another browser. Agent run state is likewise temporary unless a later public record explicitly preserves part of it.",
          ],
        },
      ],
      links: [
        { label: "read all Movements ↗", href: "/docs/movements" },
        { label: "continue to WILL ↗", href: "/docs/will" },
        { label: "read AWA — the core ↗", href: "/docs/awa" },
        { label: "read PATH movement consumption ↗", href: "/docs/path#docs-path-consumption" },
        { label: "create a THOUGHT ↗", href: "/thought" },
        { label: "view minted THOUGHT works ↗", href: "/" },
        { label: "read Mono 76 ↗", href: "/docs/mono-76" },
        { label: "inspect the THOUGHT specification ↗", href: "/verify#verify-thought-spec" },
        { label: "open provenance schema ↗", href: PROVENANCE_SCHEMA_URL },
        { label: "open THOUGHT metadata schema ↗", href: METADATA_SCHEMA_URL },
      ],
    },
    {
      slug: "will",
      id: "docs-will",
      group: "works",
      title: "WILL",
      summary:
        "WILL is Inshell's developing crowd movement about what human will becomes when people authorize Agents to act toward aims.",
      status: "study",
      authorities: ["artist-editorial", "app-documentation"],
      paragraphs: [
        [
          "WILL is the second movement on Inshell's ",
          { label: "PATH", href: "/docs/path" },
          ". Where ",
          { label: "THOUGHT", href: "/docs/thought" },
          " begins with one individual's thought, WILL moves from one person to a crowd: many humans, many Agents, and the results formed through their interactions.",
        ],
        "The governing question is what happens to human will when a person authorizes an Agent to act toward an aim. Here, an Agent receives a task and delegated authority to act toward that aim. Delegation does not guarantee completion or make the Agent's action identical to the human's will.",
        "At crowd scale, many humans can delegate different aims to many Agents. WILL asks how human wills, delegated authorities, Agent actions, interactions, failures, and results form what can be called one will.",
        [
          "Many people. Many Agents. One will. The slogan names the direction of the work, not a finished mechanism, consensus, unanimity, governance, or shared mind. Agent participation keeps WILL within ",
          { label: "Agent Art", href: "/docs/agent-art" },
          ", but the concrete artwork and exact human–Agent relation remain in development.",
        ],
      ],
      figure: {
        id: "will.open-field",
        label: "From delegated will to a result",
        mode: "field",
        figureText: [
          "HUMAN ── WILL + AUTHORITY ──→ AGENT",
          "Forms an aim                 Acts toward the delegated aim",
          "   ↘                              ↙",
          "               CROWD DYNAMIC",
          "                     ↓",
          "                  RESULT",
          "       A result can emerge from the interaction.",
        ].join("\n"),
        items: [
          { title: "Human", detail: "Forms an aim" },
          {
            title: "Agent",
            detail: "Acts toward the delegated aim",
          },
          {
            title: "Result",
            detail: "A result can emerge from the interaction.",
          },
        ],
      },
      sections: [
        {
          id: "docs-will-known",
          title: "What is known",
          paragraphs: [
            "Crowd names the one-to-many scope: the move from an individual to many interacting participants. It does not yet claim a society, community, collective identity, consensus, or shared mind.",
            "The known abstract relation begins with a human aim, delegated will and authority, an Agent acting toward that aim, and a result that can emerge from the interaction. The figure does not claim that the task succeeds or that the result is identical to the initial will.",
            "At crowd scale, many humans and Agents can form dynamics that produce results. One will is the movement's artistic direction, not a claim of unanimity, voting, governance, majority rule, or a finished theory of collective agency.",
          ],
        },
        {
          id: "docs-will-forming",
          title: "What is still forming",
          paragraphs: [
            "WILL is still being created and developed. Its concrete artwork, participation mechanism, representation of authorization, interaction among multiple aims and Agents, and account of what constitutes a result have not taken a form the docs can state honestly.",
            "The limited account reflects the current work, not intentional concealment of a completed design.",
          ],
        },
        {
          id: "docs-will-status",
          title: "Current study",
          paragraphs: [
            "WILL is planned for 2027. These docs expose its slogan and current direction as a study, not a creation or mint surface and not evidence of deployment.",
          ],
          note: "The date is a plan, not deployment evidence.",
        },
      ],
      links: [
        { label: "read all Movements ↗", href: "/docs/movements" },
        { label: "return to THOUGHT ↗", href: "/docs/thought" },
        { label: "continue to AWA ↗", href: "/docs/awa" },
      ],
    },
    {
      slug: "awa",
      id: "docs-awa",
      group: "works",
      title: "AWA",
      summary:
        "AWA is Inshell's forming movement toward its core; its particular form still needs time.",
      status: "future",
      authorities: ["artist-editorial", "app-documentation"],
      paragraphs: [
        [
          "AWA is the third movement on Inshell's ",
          { label: "PATH", href: "/docs/path" },
          ". After ",
          { label: "THOUGHT", href: "/docs/thought" },
          "'s individual and ",
          { label: "WILL", href: "/docs/will" },
          "'s crowd, AWA turns the inward direction toward the core of Inshell.",
        ],
        "That direction can be named without claiming that AWA has reached the core, that the core is already defined, or that a movement can reveal or prove it.",
        [
          "Agent participation keeps AWA within ",
          { label: "Agent Art", href: "/docs/agent-art" },
          ". The particular relation among people, Agents, and the work is still being discovered rather than inherited from THOUGHT or assumed from WILL.",
        ],
      ],
      figure: {
        id: "awa.open-horizon",
        label: "Toward the core",
        mode: "trace",
        figureText: [
          "THOUGHT  →  WILL  →  AWA  →  …",
          "Individual   Crowd   Toward the core",
        ].join("\n"),
        items: [
          { title: "THOUGHT", detail: "Individual" },
          { title: "WILL", detail: "Crowd" },
          { title: "AWA", detail: "Toward the core" },
        ],
      },
      sections: [
        {
          id: "docs-awa-known",
          title: "What is known",
          paragraphs: [
            "Core names the movement's artistic direction, not a disclosed doctrine, technical subsystem, or completed definition of Inshell. AWA follows the path from individual, through crowd, toward that core.",
          ],
        },
        {
          id: "docs-awa-forming",
          title: "What is still forming",
          paragraphs: [
            "AWA and the form through which it can approach the core are still forming. They take time.",
            "There is no finished participation relation or artwork form for the docs to describe. Those spaces should remain open rather than be filled with invented mechanisms.",
          ],
        },
        {
          id: "docs-awa-status",
          title: "Current status",
          paragraphs: [
            "AWA is planned for 2028 and currently has no creation or mint surface. The date is a plan, not evidence of deployment.",
          ],
        },
      ],
      links: [
        { label: "read all Movements ↗", href: "/docs/movements" },
        { label: "return to THOUGHT ↗", href: "/docs/thought" },
        { label: "return to WILL ↗", href: "/docs/will" },
      ],
    },
    {
      slug: "path",
      id: "docs-path",
      group: "works",
      title: "PATH",
      summary: "PATH carries permission and progress across Inshell's movements.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "PATH is the canonical project and contract name. The interface may display $PATH as the token label. PATH is an ERC-721 permission token and movement ledger; it authorizes works but is not itself one of the movement artworks.",
        "Within the practice, PATH carries permission to enter successive movement forms. It records use and progress; it does not measure self-knowledge, certify an inner truth, or turn participation into a guaranteed transformation.",
        [
          "Public PATH tokens are issued through ",
          { label: "Pulse", href: "/docs/pulse" },
          ". The contract also supports a bounded Spark self-claim path for allowlisted recipients. Issuance route is a contract fact, not a claim that one token is more authentic than another.",
        ],
        [
          "PathNFT configures one quota for each movement across a deployment. Every PATH uses those movement totals, while each token records its own current stage and in-stage count. One successful movement mint consumes one unit from that token's current movement entitlement. Reaching the quota advances it through ",
          { label: "THOUGHT", href: "/docs/thought" },
          ", ",
          { label: "WILL", href: "/docs/will" },
          ", and ",
          { label: "AWA", href: "/docs/awa" },
          " in order. Not available means the movement has no deployed quota.",
        ],
        "The token image and the stable Stage, THOUGHT, WILL, and AWA traits show movement progress. PathNFT emits a metadata update after a unit is consumed so compatible readers can refresh the token.",
        "A PATH detail page joins the canonical token image with capacity, movement tokens already authorized, owner, mint transaction, contract, network, and token metadata source. Pulse-issued tokens also include their original Pulse mint price.",
      ],
      sections: [
        {
          id: "docs-path-permission",
          title: "Permission, not the movement artwork",
          paragraphs: [
            "PATH is an ERC-721 whose state authorizes participation across movements. It can point to THOUGHT, WILL, or AWA progress, but it is not a THOUGHT, WILL, or AWA artwork itself.",
            "The token is also a ledger. Its movement totals and used counts let later readers see how much configured permission has been exercised without relying on a private account database.",
          ],
        },
        {
          id: "docs-path-issuance",
          title: "Issuance routes",
          paragraphs: [
            "Public PATH issuance runs through Pulse. The contract can also expose a bounded Spark self-claim route for allowlisted recipients. The issuance route belongs to the token's history and can be shown as a fact, but it does not create a separate class of authenticity.",
          ],
          points: [
            "Pulse issuance includes the auction settlement and original price context.",
            "Spark issuance depends on the contract's allowlist and claim rules.",
            "Every token still needs its network, contract address, and token ID to be identified correctly.",
          ],
        },
        {
          id: "docs-path-capacity",
          title: "Movement capacity",
          figure: {
            id: "path.capacity-progress",
            label: "Capacity and progress",
            mode: "ledger",
            figureText: [
              "DEPLOYMENT             EACH PATH",
              "MOVEMENT QUOTA   =   USED + REMAINING",
            ].join("\n"),
            items: [
              { title: "Movement quota", detail: "Used + remaining" },
            ],
          },
          paragraphs: [
            "PathNFT configures one quota and one authorized minter for each movement across the deployment. Every PATH uses those movement totals, while each token stores its own current stage and in-stage minted count. Remaining entitlement is derived from the deployed movement quota and that token's progress; it is not a separate stored balance.",
            "The v0.5.0 canonical deployment policy configures and freezes THOUGHT 1, WILL 10, and AWA 1. That release policy is not a live chain observation. Clients must read getMovementQuota on the named deployment instead of hard-coding those numbers.",
          ],
          points: [
            "Total: the deployed quota for the movement, applied to every PATH in that deployment.",
            "Used: how many units successful mints have consumed from this PATH for that movement.",
            "Remaining: total minus this PATH's derived used count.",
            "Not available: no capacity is configured; the App must not display a fictional zero-to-something progress bar.",
          ],
        },
        {
          id: "docs-path-consumption",
          title: "Consuming one movement unit",
          paragraphs: [
            "Selecting a PATH or signing its permission does not consume a unit. For one movement mint, the current owner authorizes a short-lived EIP-191 message bound to the PathNFT address, chain ID, PATH ID, movement, owner, configured movement minter, current permission epoch, the owner's current consume nonce, and a deadline. ERC-721 approval is not movement authorization, and only the configured movement minter may call consumeUnit.",
            "Before changing state, PathNFT checks the configured caller, the unexpired current-owner authorization, the fixed movement order, and remaining quota. On success it returns the unit's zero-based in-movement serial, advances the owner's consume nonce, and increments that PATH's current count. When the count reaches the movement quota, PATH advances to the next movement and resets its in-stage count. MetadataUpdate and MovementConsumed tell readers which PATH state to refresh.",
            "The configured movement contract is responsible for pairing consumption with the artwork mint. It calls consumeUnit before minting the movement work inside the same transaction. If a later mint step reverts, the EVM rolls back the unit, nonce, progress, events, and work together. A canceled or failed flow consumes nothing.",
          ],
        },
        {
          id: "docs-path-ownership",
          title: "Ownership and remaining entitlement",
          paragraphs: [
            "A regular PATH can be transferred. Its movement progress and remaining entitlement travel with the token; transfer never resets, duplicates, or replenishes them. Movement works minted before the transfer remain with their existing owners and are not included with the PATH.",
            "Only the current PATH owner can authorize movement use. ERC-721 approvals can authorize transfer of a regular PATH, but they do not authorize THOUGHT, WILL, or AWA consumption. Every successful regular transfer advances the PATH permission epoch, so a signature from an earlier owner or epoch becomes invalid. Every successful consume also advances the signing owner's consume nonce, invalidating other pending consume authorizations made with the old nonce.",
            "Remaining entitlement is plain language for each movement's configured quota minus its minted count. It is derived from contract state, not a second counter or marketplace trait. A completed regular PATH may still transfer, but it carries zero remaining entitlement.",
          ],
          points: [
            "Read owner, stage, minted count, quota, and permission epoch from one consistent block.",
            "Re-read that snapshot before purchase or movement authorization.",
            "If ownership, epoch, or progress changed, discard the earlier view and review the current state.",
          ],
        },
        {
          id: "docs-path-spark",
          title: "Spark awards",
          paragraphs: [
            "A Spark PATH is a bounded, named award issued through a contract invitation and self-claim flow. It carries the same movement progression and owner-only consume rights as a regular PATH, but it is permanently locked under ERC-5192 and cannot be transferred or listed.",
            "An invitation reserves one Spark slot until it is claimed, revoked, or released after expiry. The recipient reviews the exact issuer-supplied name and expiry, then claims from the invited wallet. After claim, the name is immutable. The invitation, reserved capacity, claim, and lock are contract facts; they are not a second authenticity tier for the artwork.",
          ],
          points: [
            "Regular PATH: transferable, subject to its current progress and permission epoch.",
            "Spark PATH: permanently locked, named, and still usable by its owner for eligible movement mints.",
            "Available reserved capacity and pending invitations are different issuer states and must not be merged.",
          ],
        },
        {
          id: "docs-path-record",
          title: "Reading a PATH detail page",
          steps: [
            "Confirm the active network and PathNFT contract address.",
            "Read the token ID, owner, issuance route, and mint transaction.",
            "Read each movement's deployed quota and this PATH's derived used and remaining capacity.",
            "Before authorizing a movement mint, read the current owner, stage, configured minter, permission epoch, and owner consume nonce from current state.",
            "Follow linked movement token IDs to the contracts that minted those works.",
            "Compare the displayed artwork and traits with the tokenURI source.",
          ],
          note: "Marketplace metadata can lag after movement use. PathNFT emits a metadata update so compatible readers know that the token should be refreshed.",
        },
      ],
      links: [
        { label: "view $PATH tokens ↗", href: "/path" },
        { label: "read the contract consume boundary ↗", href: "/docs/contracts#docs-contracts-consumption" },
        {
          label: "inspect the PATH v0.5.0 handoff ↗",
          href: "/protocol/releases/path-v0.5.0/DOWNSTREAM_HANDOFF.md",
        },
        { label: "read about Pulse ↗", href: "/docs/pulse" },
        { label: "read Mono 76 ↗", href: "/docs/mono-76" },
        { label: "verify $PATH contracts ↗", href: "/verify#verify-contracts" },
      ],
    },
    {
      slug: "pulse",
      id: "docs-pulse",
      group: "works",
      title: "Pulse",
      summary: "Pulse turns public timing into the issue price for each new PATH.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          { label: "PATH", href: "/docs/path" },
          " is the permission token; Pulse is the serial mechanism that prices and issues the next public token. They are not interchangeable names.",
        ],
        "Pulse runs one live epoch, one current ask, and one next token at a time. A successful bid closes the epoch, records the sale, issues the corresponding PATH, and starts the next epoch.",
        PULSE.explanation.join(" "),
        "The pump uses a price-time scale to turn the elapsed time before a sale into the next epoch's initial premium. The drop follows ask(t) = floor + premium(t), with ask(t) = b + ⌊k / (t - a)⌋. Every sale becomes another point in the visible history.",
        [
          { label: "Inshell", href: "/docs/inshell" },
          " frames Pulse as a mathematical canvas and a crowd instrument: each bid becomes a public point and sets the next beat. The curve and its parameters are exposed because the mechanism is part of the work, not an investment promise.",
        ],
        [
          "The price shown in the App is a live read, not a reservation. The ",
          { label: "wallet", href: "/docs/wallet-local-data" },
          " flow reads the ask again before submission. If the price moves outside the approved maximum, retry to read and submit the current ask.",
        ],
        PULSE.note.join(" "),
      ],
      preformatted: [
        {
          label: "Pulse pump and drop equations",
          content: PULSE.math,
        },
      ],
      sections: [
        {
          id: "docs-pulse-serial",
          title: "A serial auction",
          figure: {
            id: "pulse.epoch",
            label: "One Pulse epoch",
            mode: "trace",
            figureText: [
              "ASK",
              "↓ decay",
              "BID",
              "↓ pump",
              "NEXT ASK",
              "↺ next epoch",
            ].join("\n"),
            loop: { to: 1, condition: "next epoch" },
            items: [
              { title: "Ask", detail: "Decay" },
              { title: "Bid", detail: "Pump" },
              { title: "Next ask" },
            ],
          },
          paragraphs: [
            "Pulse has one current epoch and one next public PATH at a time. Participants are not choosing among parallel lots. The successful bid closes the visible curve, issues its PATH, and establishes the starting conditions for the following curve.",
            "This serial structure makes the history legible: every sale is both an ending and the input to what comes next.",
          ],
        },
        {
          id: "docs-pulse-pump",
          title: "The pump",
          paragraphs: [
            "The time between the previous curve start and the successful sale is multiplied by the price-time scale. That result becomes the next epoch's initial premium. The next floor is the last sale price, so waiting before a sale affects the height from which the following ask begins.",
          ],
          points: [
            "A longer elapsed interval produces a larger initial premium when the price-time scale is fixed.",
            "The premium is added to the new floor; it is not the full next ask by itself.",
            "The sale price becomes public history and the next floor at the same transition.",
          ],
        },
        {
          id: "docs-pulse-drop",
          title: "The drop",
          paragraphs: [
            "During an open epoch, the premium follows the published inverse curve and approaches zero. The ask therefore approaches the floor without silently changing the floor. The App draws that same relationship as a time-price field.",
            "The chart uses half-life units to make curves with different real-time durations visually comparable. Tooltips convert those units back into elapsed or ago time for the current epoch.",
          ],
        },
        {
          id: "docs-pulse-live-price",
          title: "A quote is not a reservation",
          steps: [
            "Read the current ask and active payment asset from the contract-backed App state.",
            "Open the local review panel and inspect the maximum charge before the wallet opens.",
            "Let the mint flow read the ask again immediately before submission.",
            "Confirm only if the wallet request matches the expected network, contract, and maximum value.",
            "If the ask moved beyond the approved maximum, retry with a fresh read instead of treating the earlier quote as guaranteed.",
          ],
        },
        {
          id: "docs-pulse-settlement",
          title: "Price ceiling and settlement",
          paragraphs: [
            "The wallet transaction supplies a maximum acceptable price, not a promise to pay that entire amount. Pulse samples the live ask when the transaction executes. The bid succeeds only when that ask is within the submitted ceiling.",
            "On a successful ETH bid, the auction sends the exact ask to the treasury and refunds surplus value to the bidder. The sale closes the current epoch, records its settlement, and begins the next epoch. The adapter then translates that settlement into PATH delivery; Pulse itself remains independent of the NFT it prices.",
          ],
          points: [
            "Maximum price: the bidder's slippage ceiling.",
            "Settlement price: the live ask accepted by the contract.",
            "Value supplied: must cover the ask; unused value is refunded.",
            "Delivery: PathPulseAdapter turns the settled auction result into PATH issuance.",
          ],
          note: "A submitted transaction is not a completed sale. Read the receipt, events, and resulting contract state before presenting PATH as issued.",
        },
        {
          id: "docs-pulse-artwork",
          title: "Mechanism as artwork",
          paragraphs: [
            "Pulse exposes its curve, parameters, sale dots, and current point because the mechanism is part of the artistic surface. Each bid becomes a beat in a public rhythm: acting, waiting, and the crowd's changing tempo remain visible rather than being reduced to a private checkout flow.",
            "As one participatory system in Inshell's practice, Pulse makes collective timing and choice available for inspection. The curve records action; neither price nor timing measures inward progress or establishes possession of truth.",
          ],
          note: "This framing describes the work. It is not an investment promise, a price forecast, or a claim that participation will produce financial return.",
        },
      ],
      links: [
        { label: "open live Pulse parameters ↗", href: "/pulse?raw=1" },
        { label: "open original Desmos sketch ↗", href: PULSE.desmosUrl },
        { label: "view Pulse source ↗", href: SOURCE_REPOSITORIES.pulse },
      ],
    },
    {
      slug: "contracts",
      id: "docs-contracts",
      group: "systems",
      title: "Contracts",
      summary: "Contract responsibilities remain separate across auction, issuance, permission, and artwork minting.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          "The public architecture is ",
          { label: "PulseAuction", href: "/docs/pulse" },
          " → PathPulseAdapter → ",
          { label: "PathNFT", href: "/docs/path" },
          " → ",
          { label: "ThoughtNFT", href: "/docs/thought" },
          ". The arrows describe the issuance and permission path, not contract ownership or a promise that every future movement is deployed.",
        ],
        "These contracts specify and enforce bounded actions within the practice. They can validate a permission, mint, or record, but they do not implement the truth named by Inshell or prove a participant's inward understanding.",
        "PulseAuction calculates the live ask, accepts a successful bid, and closes an epoch. PathPulseAdapter translates that settlement into PATH issuance. PathNFT mints and owns PATH state, movement order, and capacity. ThoughtNFT validates THOUGHT mint rules, records the work, and atomically consumes an authorized THOUGHT unit from PATH.",
        "The App orchestrates reads, previews, Agent runs, signatures, and wallet transactions. It does not replace contract validation. A wallet account submits the transaction; deployed contracts decide whether it is valid.",
        [
          "ABIs, bytecode, renderer payloads, schemas, and manifests belong to ",
          {
            label: "pinned releases",
            href: "/docs/source-release-boundaries",
          },
          ". Contract addresses and deployment blocks belong to a network deployment record. Read both before identifying a live system.",
        ],
      ],
      sections: [
        {
          id: "docs-contracts-responsibilities",
          title: "Separated responsibilities",
          figure: {
            id: "contracts.handoffs",
            label: "Contract handoffs across issuance and minting",
            mode: "lanes",
            figureText: [
              "PUBLIC ISSUANCE",
              "PulseAuction / SETTLE",
              "Live ask · one serial epoch",
              "→ PathPulseAdapter / ISSUE",
              "Valid settlement → PATH issuance",
              "→ PathNFT / RECORD PATH",
              "Issued PATH · order · capacity",
              "",
              "LATER THOUGHT MINT",
              "ThoughtNFT / VALIDATE WORK",
              "THOUGHT work · PATH permission",
              "→ PathNFT / CONSUME UNIT",
              "Caller · owner · stage · quota",
              "→ ThoughtNFT / MINT + RECORD",
              "Atomic with PATH consumption",
            ].join("\n"),
            items: [
              {
                stage: 1,
                lane: "PulseAuction",
                phase: "Public issuance",
                title: "Settle",
                detail: "Live ask · one serial epoch",
              },
              {
                stage: 2,
                lane: "PathPulseAdapter",
                phase: "Public issuance",
                title: "Issue",
                detail: "Valid settlement → PATH issuance",
              },
              {
                stage: 3,
                lane: "PathNFT",
                phase: "Public issuance",
                title: "Record PATH",
                detail: "Issued PATH · order · capacity",
              },
              {
                stage: 4,
                lane: "ThoughtNFT",
                phase: "Later THOUGHT mint",
                title: "Validate work",
                detail: "THOUGHT work · PATH permission",
              },
              {
                stage: 5,
                lane: "PathNFT",
                phase: "Later THOUGHT mint",
                title: "Consume unit",
                detail: "Caller · owner · stage · quota",
              },
              {
                stage: 6,
                lane: "ThoughtNFT",
                phase: "Later THOUGHT mint",
                title: "Mint + record",
                detail: "Atomic with PATH consumption",
              },
            ],
          },
          paragraphs: [
            "The architecture separates pricing, issuance, permission, and artwork minting so each boundary can be inspected independently. Public PATH issuance and a later THOUGHT mint are separate phases. Contract calls and state handoffs connect them, but no contract owns all the others.",
          ],
          points: [
            "PulseAuction owns the auction calculation and settlement rules.",
            "PathPulseAdapter connects the auction to PATH issuance.",
            "PathNFT owns PATH identity, issuance state, and movement capacity.",
            "ThoughtNFT owns THOUGHT validation, uniqueness, rendering references, metadata, and mint records.",
          ],
        },
        {
          id: "docs-contracts-app",
          title: "What the App does",
          paragraphs: [
            "The App reads state, assembles previews and creation records, requests Agent runs, helps the human choose a PATH, prepares signatures, and asks the wallet to submit transactions. It can make the workflow understandable, but it cannot override deployed validation.",
            "A successful UI message is not final authority for a mint. The transaction receipt, emitted events, typed contract reads, and tokenURI supply the contract-controlled result.",
          ],
        },
        {
          id: "docs-contracts-consumption",
          title: "The movement-consumption boundary",
          paragraphs: [
            "PathNFT does not infer movement consent from PATH selection or ERC-721 approval. It accepts consumeUnit only from the configured movement minter and verifies an EIP-191 authorization signed by the current PATH owner. The signed message binds the PathNFT address, chain ID, PATH ID, movement, owner, executor, permission epoch, owner consume nonce, and deadline.",
            "After checking the active stage and remaining quota, PathNFT returns a zero-based movement serial and updates permission progress. The configured movement contract owns the other half of the boundary: it calls consumeUnit before minting its work inside the same transaction. PathNFT owns permission accounting; the movement contract owns work validation and minting. If either half reverts, the transaction commits neither.",
          ],
        },
        {
          id: "docs-contracts-release",
          title: "Release plus deployment",
          paragraphs: [
            "A release says which ABI, bytecode, renderer data, schemas, and checksums belong together. A deployment record says which addresses and deployment blocks put a release on a particular network. Both are required to identify the live system precisely.",
          ],
          note: "Repository HEAD is not automatically the code behind an older deployed address. Match the active network, deployment record, pinned release, and deployed bytecode.",
        },
      ],
      links: [
        { label: "open contract verification ↗", href: "/verify#verify-contracts" },
        { label: "read PATH movement consumption ↗", href: "/docs/path#docs-path-consumption" },
        { label: "view PATH source ↗", href: SOURCE_REPOSITORIES.path },
        { label: "view THOUGHT source ↗", href: SOURCE_REPOSITORIES.thought },
        { label: "view Pulse source ↗", href: SOURCE_REPOSITORIES.pulse },
      ],
    },
    {
      slug: "artwork-metadata-chain",
      id: "docs-reading",
      group: "systems",
      title: "Artwork, Metadata, and Chain",
      summary: "Artwork and metadata stay legible only when their chain and release context stay attached.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          "Home lists minted ",
          { label: "THOUGHT", href: "/docs/thought" },
          " works from the active chain. The ",
          { label: "PATH", href: "/docs/path" },
          " surface lists PATH tokens from that same chain. The full identity of an NFT is its network, contract address, and token ID; the same token number elsewhere is a different record.",
        ],
        "THOUGHT and PATH artwork and NFT metadata come from each contract's tokenURI and pinned renderer. The App decodes and displays those canonical bytes; it must not rebuild replacement art or silently substitute a newer renderer.",
        "Token metadata carries the canonical image, description, stable marketplace traits, and—when the release defines it—an external_url to the canonical detail page. A generic marketplace can read that portable layer without understanding Inshell's richer records.",
        "Inshell detail pages add context: THOUGHT exposes its work, evidence levels, and creation provenance; PATH exposes movement state, capacity, linked movement tokens, issuance, and onchain record.",
        "These layers make the public forms and claims of the practice inspectable. They can establish which bytes and records belong to a work; they cannot prove the inward truth of the work or possess its meaning.",
        "These artwork, metadata, provenance, and chain layers describe Inshell's current onchain practices. They are not requirements that every Agent Art practice must adopt.",
        [
          "Onchain does not mean context-free. Read network, contract, token ID, deployment, release, tokenURI source, and ",
          { label: "attestation status", href: "/docs/verification" },
          " together before deciding what a record proves.",
        ],
      ],
      figure: {
        id: "evidence.interpretation",
        label: "Evidence becomes interpretation",
        mode: "field",
        figureText: [
          "EVIDENCE",
          "├─ IDENTITY",
          "│  Network + contract + token",
          "├─ CONTRACT",
          "│  State + tokenURI",
          "├─ RELEASE",
          "│  ABI + renderer + schemas",
          "└─ CONTEXT",
          "   Provenance + reading surface",
          "      ↓",
          "INTERPRETATION",
          "Read together",
        ].join("\n"),
        items: [
          { title: "Identity", detail: "Network + contract + token" },
          { title: "Contract", detail: "State + tokenURI" },
          { title: "Release", detail: "ABI + renderer + schemas" },
          { title: "Context", detail: "Provenance + reading surface" },
          { title: "Interpretation", detail: "Read together" },
        ],
      },
      sections: [
        {
          id: "docs-reading-identity",
          title: "A token number is not enough",
          paragraphs: [
            "Token ID 1 can exist on many contracts and networks. Its full identity is the tuple of network, contract address, and token ID. A collection page that omits one of those values may still be convenient, but it is not sufficient for independent verification.",
          ],
        },
        {
          id: "docs-reading-artwork",
          title: "Canonical artwork bytes",
          paragraphs: [
            "THOUGHT and PATH tokenURI responses point to the canonical artwork and metadata produced by their pinned contract systems. The App decodes those bytes for display. It should not redraw an approximation, swap in a newer renderer, or treat a cached marketplace thumbnail as the origin.",
          ],
          points: [
            "A data URI can carry JSON metadata or SVG artwork directly.",
            "A pinned renderer release makes the visual construction reproducible and reviewable.",
            "A social image or screenshot is a presentation copy, even when it looks identical.",
          ],
        },
        {
          id: "docs-reading-portable",
          title: "Portable metadata",
          paragraphs: [
            "Token metadata is the compact layer that generic wallets and marketplaces can understand. It includes the canonical image, description, stable traits, and an external URL when the selected release defines one.",
            "Portable metadata deliberately does not carry every creation detail. Inshell detail pages and provenance endpoints can add richer context while keeping their different authority levels explicit.",
          ],
        },
        {
          id: "docs-reading-context",
          title: "Read context with the object",
          points: [
            "Which network and deployment produced the record?",
            "Which contract and token ID identify it?",
            "Which release defines its ABI and renderer?",
            "Which fields are token metadata, contract state, App records, or runtime reports?",
            "Is a Creation Attestation present, valid, absent, or not applicable?",
            "At what block or time was live chain state observed?",
          ],
        },
      ],
      links: [
        { label: "view minted THOUGHT works ↗", href: "/" },
        { label: "view all $PATH ↗", href: "/path" },
      ],
    },
    {
      slug: "mono-76",
      id: "docs-mono-76",
      group: "systems",
      title: "Mono 76",
      summary: "Mono 76 is Inshell's sealed native-SVG type system for deterministic artwork text.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "Mono 76 gives selected Inshell works a fixed visual alphabet. Version 1.0.0 contains 76 ordered records: 75 visible glyphs and one metrics-only SPACE. Every visible glyph is an independently authored centerline SVG path with shared monospaced metrics.",
        "The sealed face emerged from a larger native-SVG glyph study. That research compared many construction systems for legibility, identity, punctuation, marketplace-scale resilience, deterministic rendering, and practical contract size. The released face came from the C02 Classic Book study, then received manual refinement and optical alignment before its paths and metrics were frozen.",
        [
          "Mono 76 is not the site's general interface font. Interface copy remains ordinary selectable text. Mono 76 is used where the letterform is part of the artwork or its deterministic renderer, including the current ",
          { label: "THOUGHT", href: "/docs/thought" },
          " composition and the movement names drawn inside ",
          { label: "PATH", href: "/docs/path" },
          " tokens.",
        ],
        "A renderer consumes path geometry rather than asking a browser to locate a font. This keeps the visible form independent of installed fonts, webfont loading, marketplace font support, and platform-specific text layout.",
      ],
      figure: {
        id: "mono-76.canonical-artwork",
        label: "From glyph study to canonical artwork",
        mode: "trace",
        figureText: [
          "GLYPH STUDY",
          "Explore · refine",
          "      ↓",
          "SEALED MONO 76",
          "Paths + metrics frozen",
          "      ↓",
          "CANONICAL ARTWORK",
          "Native SVG",
        ].join("\n"),
        items: [
          { title: "Glyph study", detail: "Explore · refine" },
          { title: "Sealed Mono 76", detail: "Paths + metrics frozen" },
          { title: "Canonical artwork", detail: "Native SVG" },
        ],
      },
      sections: [
        {
          id: "docs-mono-76-repertoire",
          title: "A closed repertoire",
          paragraphs: [
            "The ordered repertoire is SPACE, A-Z, a-z, 0-9, and . , ? ! : ; ' \" - ( ) / &. SPACE advances by the same fixed width as every other record but draws no path. Unsupported characters fail validation instead of being replaced by a fallback glyph.",
            "THOUGHT uses the same character repertoire for its Terminal English lines. Its additional byte and spacing rules belong to the THOUGHT specification; Mono 76 defines glyph support and geometry, not the whole creation protocol.",
          ],
        },
        {
          id: "docs-mono-76-form",
          title: "Centerlines, not font outlines",
          paragraphs: [
            "The released face uses open centerline paths: no fill, a fixed round stroke, round caps and joins, fixed advance, no kerning, and one declared origin shift. Reviewed optical adjustments are baked into the path bytes so a renderer does not apply a second hidden tuning table.",
            "Source Code Pro was a visible comparison reference during study. Its outlines were neither imported nor traced into Mono 76 v1.0.0. The earlier outline-reference release is a separate historical artifact with different geometry and licensing; it is not the current face.",
          ],
        },
        {
          id: "docs-mono-76-native-svg",
          title: "Native SVG is the delivery form",
          paragraphs: [
            "Mono 76 is packaged as path data and a deterministic renderer, not as a WOFF or TTF webfont. Artwork renderers place the paths directly into SVG and must preserve the sealed metrics and stroke contract.",
            "THOUGHT consumes the packed IM76 repertoire for its terminal composition. PATH embeds only the nine Mono 76 glyph paths needed to draw THOUGHT, WILL, and AWA. Each token image is therefore self-contained; viewing it does not require a font installation or an offchain text renderer.",
          ],
        },
        {
          id: "docs-mono-76-interface",
          title: "Artwork and interface stay distinct",
          paragraphs: [
            "The App does not register Mono 76 with CSS or replace ordinary interface typography with it. Navigation, documentation, forms, status messages, and accessibility text remain browser-readable interface copy. Mono 76 appears when the glyph shape itself belongs to a work or to the work's canonical visual system.",
          ],
        },
        {
          id: "docs-mono-76-release",
          title: "Pins prevent visual drift",
          paragraphs: [
            [
              "The sealed package includes the ordered face, packed onchain payload, renderer code, manifest, provenance, verification script, notices, and checksums. A downstream ",
              {
                label: "release",
                href: "/docs/source-release-boundaries",
              },
              " must consume that complete contract and pin its hashes rather than copying one convenient glyph file.",
            ],
            "THOUGHT and PATH pin Mono 76 through their own contract releases. Updating the font repository does not change a pinned renderer or an already deployed contract. A new visual revision requires a new reviewed release and explicit downstream repinning; the App must continue reading canonical token artwork rather than silently redrawing it with newer paths.",
          ],
        },
      ],
      links: [
        { label: "read THOUGHT ↗", href: "/docs/thought" },
        { label: "read PATH ↗", href: "/docs/path" },
        { label: "read artwork, metadata, and chain ↗", href: "/docs/artwork-metadata-chain" },
        { label: "read source and release boundaries ↗", href: "/docs/source-release-boundaries" },
      ],
    },
    {
      slug: "verification",
      id: "docs-verification",
      group: "systems",
      title: "Verification",
      summary: "Verification separates records, releases, observations, and claims before drawing conclusions.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        [
          "Verification here concerns bounded public claims. It can test a signature, byte sequence, release, deployment, or chain record. It is not the truth named in ",
          { label: "Inshell", href: "/docs/inshell" },
          "'s artistic position: inspect self is a direction of practice, not a proposition these proofs can establish.",
        ],
        "Authority is the person or system that originates a claim. Loaded from names the immediate technical source used by the interface. A mirror is an indexed or cached copy, not a new authority. Display material is a presentation of a record, not the record itself.",
        "Provenance describes how a work or record came into being and which commitments connect its parts. Proof is the data evaluated by a specific verification rule. Neither word means that every recorded statement is true.",
        [
          "For a token, start from network, contract address, and token ID. Read contract state and tokenURI, identify the deployment and pinned release, recompute published commitments, validate the selected specification, and verify the ",
          {
            label: "Creation Attestation",
            href: "/docs/thought#docs-thought-provenance",
          },
          " when one is present.",
        ],
        "Contract-verified means the contract accepted the defined proof and bound records. Runtime-reported means a connector received the value from an Agent runtime. Selected means the App or human chose it. Artist-editorial means it expresses the practice. These evidence levels must not be collapsed into one claim.",
        "A valid Creation Attestation verifies one THOUGHT creation record under the rules of its contract release. It does not certify that a work is Agent Art or define the wider field.",
        [
          "The Verify page gathers official origins, ",
          { label: "wallet boundaries", href: "/docs/wallet-local-data" },
          ", active networks, deployed contracts, release locks, and the active THOUGHT specification. In-place explorer links remain useful for inspecting addresses and transactions on the active public chain.",
        ],
      ],
      sections: [
        {
          id: "docs-verification-terms",
          title: "Four terms that should not blur",
          points: [
            "Authority: the person or system that originates a claim.",
            "Loaded from: the immediate technical source used by the interface.",
            "Mirror: a copied or indexed representation of another source.",
            "Display material: a presentation of a record, not automatically its authority.",
          ],
          note: "A value can be loaded from a cache that mirrors a contract. The cache is the immediate source; the contract remains the authority for the mirrored fact.",
        },
        {
          id: "docs-verification-provenance",
          title: "Provenance and proof",
          paragraphs: [
            "Provenance explains how parts of a work or record are related across creation, rendering, selection, minting, and later display. Proof is narrower: it is the data accepted by a specific verification rule.",
            "A valid proof can establish that certain bytes, hashes, addresses, or signatures agree. It does not automatically make every surrounding narrative statement true.",
          ],
        },
        {
          id: "docs-verification-levels",
          title: "Evidence levels",
          points: [
            "Contract-verified: deployed code accepted the defined values or proof.",
            "Contract-release: a pinned artifact set defines expected code, schemas, or renderer material.",
            "Chain-observed: a public read describes state on one named network at an observation point.",
            "App-recorded: the App assembled, stored, or signed a record with a declared boundary.",
            "Runtime-reported: the Agent runtime or connector supplied the value.",
            "Artist-editorial: the statement describes the practice, meaning, or interpretation.",
          ],
        },
        {
          id: "docs-verification-checklist",
          title: "Work verification checklist",
          steps: [
            "Identify the network without inferring it from the website origin.",
            "Confirm the deployed contract address and token ID.",
            "Read the contract's typed work state and tokenURI.",
            "Identify the matching release and deployment record.",
            "Validate published hashes, schema constraints, renderer commitments, and the selected specification.",
            "Verify a Creation Attestation when present, or report that the work is Unattested.",
            "Name mirrors, caches, runtime reports, and editorial claims without promoting them to contract facts.",
          ],
        },
      ],
      links: [
        { label: "open verification ↗", href: "/verify" },
        {
          label: "read the chain-first verifier guide ↗",
          href: `${SOURCE_REPOSITORIES.app}/blob/main/docs/THOUGHT_PROVENANCE_VERIFIER.md`,
        },
      ],
    },
    {
      slug: "wallet-local-data",
      id: "docs-wallet",
      group: "systems",
      title: "Wallet and Local Data",
      summary: "Wallet actions, browser storage, Agent runs, and chain records cross different trust boundaries.",
      status: "current",
      authorities: ["app-documentation"],
      paragraphs: [
        [
          "The shell wallet menu reads the current account and network. Its Refresh action updates wallet and ",
          { label: "PATH", href: "/docs/path" },
          " inventory reads. Opening the menu itself never asks for a signature or transaction.",
        ],
        [
          "Product CTAs open wallet requests only when an action needs one: connect, mint PATH, sign a one-mint PATH permission, or mint ",
          { label: "THOUGHT", href: "/docs/thought" },
          ". Canceling a wallet request submits nothing.",
        ],
        "A signature can authorize a narrowly defined action without sending a transaction or paying gas. A transaction can change chain state and requires wallet confirmation. The interface must name which one it is requesting.",
        "Save and Load use browser storage. Agent run state is held by the App backend for the run window. Neither is an onchain token, a portable account, or a cross-device record.",
        "Local Anvil, Sepolia, and Ethereum are separate chains with separate contracts, balances, and tokens. Local tokens belong only to the local dev chain. Normal App development preserves that chain across restarts; an explicit reset or redeployment can replace it.",
      ],
      figure: {
        id: "wallet.distinctions",
        label: "Two distinctions",
        mode: "field",
        figureText: [
          "READ  ≠  SIGN  ≠  TRANSACT",
          "Public state   Authorization   Chain change",
          "",
          "LOCAL  ≠  ONCHAIN",
          "Browser record   Public record",
        ].join("\n"),
        items: [
          { title: "Read", detail: "Public state" },
          { title: "Sign", detail: "Authorization" },
          { title: "Transact", detail: "Chain change" },
          { title: "Local", detail: "Browser record" },
          { title: "Onchain", detail: "Public record" },
        ],
      },
      sections: [
        {
          id: "docs-wallet-passive",
          title: "Reading is not signing",
          paragraphs: [
            "Opening the wallet menu, refreshing account state, loading PATH inventory, or reading public token records should not request a signature or transaction. These are passive reads.",
            "A product action can open a wallet only when it needs account access, a signature, a network switch, or a transaction. The interface should name that boundary before the request appears.",
          ],
        },
        {
          id: "docs-wallet-actions",
          title: "Signature versus transaction",
          points: [
            "Connect: gives the App access to the selected public account and network.",
            "Signature: authorizes the exact message shown by the wallet; it uses no gas and does not change chain state by itself.",
            "Transaction: calls a contract, can transfer value or change state, and requires wallet confirmation.",
            "Cancellation: submits nothing. A canceled or rejected request should not be treated as partial success.",
          ],
        },
        {
          id: "docs-wallet-storage",
          title: "Browser storage and Agent runs",
          paragraphs: [
            "Saved THOUGHT candidates live in the current browser. Temporary Agent run state lives within its App-defined run window. These records may be useful during creation, but they are not tokens, public provenance, or synchronized accounts.",
          ],
          note: "Clearing browser data, changing browsers, or moving to another device can make local saves unavailable.",
        },
        {
          id: "docs-wallet-networks",
          title: "Networks do not merge",
          paragraphs: [
            "Local Anvil, Sepolia, and Ethereum have different chain IDs, deployments, balances, transaction histories, and token identities. A familiar token number or account address on two networks does not make the records equivalent.",
          ],
        },
      ],
    },
    {
      slug: "source-release-boundaries",
      id: "docs-source",
      group: "systems",
      title: "Source and Release Boundaries",
      summary: "Source ownership, release artifacts, deployments, and publication are versioned independently.",
      status: "current",
      authorities: ["app-documentation", "contract-release"],
      paragraphs: [
        [
          "The Inshell App, ",
          { label: "PATH", href: "/docs/path" },
          " contracts, ",
          { label: "THOUGHT", href: "/docs/thought" },
          " contracts, and ",
          { label: "Pulse", href: "/docs/pulse" },
          " auction have separate repositories and ownership boundaries. The App owns creation flow, integration, and presentation. Each contract repository owns its contract behavior and release artifacts. Deployment operators own network deployment records.",
        ],
        "The App consumes pinned ABIs, bytecode, schemas, renderer data, specifications, manifests, and checksums. A repository's latest source is not automatically the deployed release. A newer file is not authority for an older deployment.",
        "Contract releases contain code and integrity material; network addresses and deployment blocks come from a separately verified deployment record. A correct integration matches the App pin, release artifacts, deployed bytecode, renderer commitments, and active network.",
        "Documentation can describe current source, a pinned release, or observed chain state. It must say which. Mirrors and previews are useful distribution surfaces but do not silently become canonical origins.",
      ],
      figure: {
        id: "source-release.records",
        label: "Four distinct records",
        mode: "field",
        figureText: [
          "SOURCE  ≠  RELEASE  ≠  DEPLOYMENT  ≠  OBSERVATION",
          "Authored code   Pinned artifacts   Addresses + blocks   Point-in-time read",
        ].join("\n"),
        items: [
          { title: "Source", detail: "Authored code" },
          { title: "Release", detail: "Pinned artifacts" },
          { title: "Deployment", detail: "Addresses + blocks" },
          { title: "Observation", detail: "Point-in-time read" },
        ],
      },
      sections: [
        {
          id: "docs-source-ownership",
          title: "Repository ownership",
          points: [
            "The Inshell App repository owns same-origin presentation, orchestration, API behavior, and integration pins.",
            "The PATH repository owns PATH contracts and their release artifacts.",
            "The THOUGHT repository owns THOUGHT contracts, specifications, renderer releases, and their integrity material.",
            "The Pulse repository owns the auction contract and pricing mechanism release.",
          ],
        },
        {
          id: "docs-source-pins",
          title: "Why pins matter",
          paragraphs: [
            "A repository can continue changing after a contract is deployed. The App therefore consumes selected ABIs, bytecode, schemas, renderer payloads, manifests, and checksums instead of assuming that the newest source describes every historical token.",
          ],
        },
        {
          id: "docs-source-deployment",
          title: "Release is not deployment",
          paragraphs: [
            [
              "A release may be complete without being deployed. A deployment record adds the network, contract addresses, deployment blocks, and integration choices needed to find it onchain. ",
              { label: "Verification", href: "/docs/verification" },
              " joins both records and checks deployed bytecode where possible.",
            ],
          ],
        },
        {
          id: "docs-source-publication",
          title: "Publication boundaries",
          paragraphs: [
            "Canonical pages, Markdown documents, JSON indexes, API responses, GitHub mirrors, preview deployments, and third-party explorers serve different readers. Linking or mirroring improves access; it does not silently transfer authority.",
          ],
          note: "When documentation describes live chain state, name the network and observation point. When it describes a release, name the release rather than relying on the current repository branch.",
        },
      ],
      links: [
        { label: "Inshell App source ↗", href: SOURCE_REPOSITORIES.app },
        { label: "PATH source ↗", href: SOURCE_REPOSITORIES.path },
        { label: "THOUGHT source ↗", href: SOURCE_REPOSITORIES.thought },
        { label: "Pulse source ↗", href: SOURCE_REPOSITORIES.pulse },
      ],
    },
    {
      slug: "design-principles",
      id: "docs-design-principles",
      group: "context",
      title: "Design Principles",
      summary: "Inshell's current design rules connect participation, visible form, and the limits of evidence.",
      status: "current",
      authorities: ["artist-editorial", "app-documentation", "contract-release"],
      paragraphs: [
        "Inshell's works connect artistic meaning to operating rules. A response limit, a serial auction, a movement capacity, a renderer pin, or an evidence label is not merely backstage implementation. Each rule changes what participants can do and what later readers can know.",
        "Five design choices recur across the current Inshell system: collaboration is bounded, the authority to continue or preserve is explicit, mechanisms stay visible, canonical sources remain identifiable, and claims stop where their evidence stops. They give the practice form as it approaches truth without claiming possession. They are choices of practice, not a doctrine, a set of propositions to prove, or a definition of Agent Art.",
      ],
      figure: {
        id: "design.principles",
        label: "Current Inshell principles across systems",
        mode: "field",
        figureText: [
          "CURRENT INSHELL PRINCIPLES",
          "",
          "• BOUND — Collaboration is bounded.",
          "• AUTHORIZE",
          "  Authority to continue or preserve is explicit.",
          "• EXPOSE — Mechanisms stay visible.",
          "• PIN — Canonical sources remain identifiable.",
          "• QUALIFY — Claims stop where their evidence stops.",
        ].join("\n"),
        items: [
          { title: "Bound", detail: "Collaboration is bounded." },
          {
            title: "Authorize",
            detail: "Authority to continue or preserve is explicit.",
          },
          { title: "Expose", detail: "Mechanisms stay visible." },
          { title: "Pin", detail: "Canonical sources remain identifiable." },
          { title: "Qualify", detail: "Claims stop where their evidence stops." },
        ],
      },
      sections: [
        {
          id: "docs-design-bounds",
          title: "Bounds create form",
          paragraphs: [
            [
              { label: "THOUGHT", href: "/docs/thought" },
              " allows one prompt, one Agent response, exact byte rules, and one human mint decision. ",
              { label: "Pulse", href: "/docs/pulse" },
              " allows one active epoch and one next public PATH. ",
              { label: "PATH", href: "/docs/path" },
              " exposes an ordered movement sequence with configured capacities. These constraints make the resulting differences legible.",
            ],
            [
              "Within THOUGHT, more options would not automatically create more expressive work. Its boundary concentrates attention on the choices that remain: which intention to write, which response to preserve, which PATH to use, and how to read the record afterward. Other ",
              { label: "Agent Art", href: "/docs/agent-art" },
              " practices may choose different boundaries and forms.",
            ],
          ],
        },
        {
          id: "docs-design-selection",
          title: "Generation is not preservation",
          figure: {
            id: "design.preservation",
            label: "Two preservation boundaries",
            mode: "lanes",
            figureText: [
              "THOUGHT",
              "AGENT RETURN",
              "Candidate produced",
              "→ HUMAN REVIEW",
              "Decision to preserve",
              "→ SUCCESSFUL MINT",
              "Contract action succeeds",
              "→ PUBLIC CORPUS",
              "Preserved THOUGHT",
              "",
              "PULSE",
              "VISIBLE ASK",
              "Quote exposed",
              "→ CONFIRMED BID",
              "Participant authorizes",
              "→ SETTLEMENT",
              "Contract action succeeds",
              "→ SALE RECORD",
              "Preserved Pulse",
            ].join("\n"),
            items: [
              {
                stage: 1,
                lane: "THOUGHT",
                title: "Agent return",
                detail: "Candidate produced",
              },
              {
                stage: 2,
                lane: "THOUGHT",
                title: "Human review",
                detail: "Decision to preserve",
              },
              {
                stage: 3,
                lane: "THOUGHT",
                title: "Successful mint",
                detail: "Contract action succeeds",
              },
              {
                stage: 4,
                lane: "THOUGHT",
                title: "Public corpus",
                detail: "Preserved THOUGHT",
              },
              {
                stage: 1,
                lane: "PULSE",
                title: "Visible ask",
                detail: "Quote exposed",
              },
              {
                stage: 2,
                lane: "PULSE",
                title: "Confirmed bid",
                detail: "Participant authorizes",
              },
              {
                stage: 3,
                lane: "PULSE",
                title: "Settlement",
                detail: "Contract action succeeds",
              },
              {
                stage: 4,
                lane: "PULSE",
                title: "Sale record",
                detail: "Preserved Pulse",
              },
            ],
          },
          paragraphs: [
            "A system can produce a candidate without declaring it part of the public corpus. In Inshell's current onchain practices, THOUGHT separates Agent return from human review and successful mint, while Pulse separates a visible ask from a participant's confirmed bid. Their contract actions are specific preservation boundaries, not a universal rule for Agent Art.",
          ],
        },
        {
          id: "docs-design-visible-mechanism",
          title: "Mechanism stays visible",
          paragraphs: [
            "Pulse shows the curve, floor, premium, sale points, and current ask. PATH shows movement totals and use. THOUGHT publishes its language boundary, renderer, metadata, and attestation model. The mechanism is not hidden after it produces an output because understanding the mechanism changes how the output can be experienced.",
          ],
        },
        {
          id: "docs-design-canonical",
          title: "One canonical form, many reading surfaces",
          figure: {
            id: "design.reading-surfaces",
            label: "Many surfaces, one identified record",
            mode: "field",
            figureText: [
              "┌─ IDENTIFIED ONCHAIN WORK ───────────────┐",
              "│ Network + contract + token ID +         │",
              "│ tokenURI + release                      │",
              "└─────────────────────────────────────────┘",
              "                    ↓",
              "          MANY READING SURFACES",
              "Site · wallet · marketplace · API · Markdown · Agent answer",
            ].join("\n"),
            items: [
              {
                title: "Identified onchain work",
                detail:
                  "Network + contract + token ID + tokenURI + release",
              },
              {
                title: "Many reading surfaces",
                detail:
                  "Site · wallet · marketplace · API · Markdown · Agent answer",
              },
            ],
          },
          paragraphs: [
            "An onchain Inshell work can appear on the site, in a wallet, on a marketplace, through an API, in Markdown, or inside an Agent's answer. Those surfaces can add access and context. They should still point back to the network, contract, tokenURI, pinned release, and declared record authority that make that work identifiable.",
          ],
        },
        {
          id: "docs-design-claims",
          title: "Transparency without overclaiming",
          paragraphs: [
            [
              { label: "Public provenance", href: "/docs/verification" },
              " is useful because it connects exact values and names where they came from. It becomes weaker when every field is described as verified in the same way. Inshell therefore distinguishes contract validation, release facts, live chain observations, App records, runtime reports, and artist statements.",
            ],
            "The aim is not to make uncertainty disappear. It is to make the boundary of each claim inspectable.",
          ],
        },
        {
          id: "docs-design-time",
          title: "The work continues through time",
          paragraphs: [
            "Pulse changes with every sale and every interval between sales. A PATH accumulates movement use. The THOUGHT corpus grows one selected pair at a time. Releases and deployments create historical layers that must remain readable after the current interface changes.",
            "This makes documentation part of preservation. It records not only what a visitor can click today, but how the work's visible form, permissions, and evidence remain connected over time.",
          ],
        },
      ],
      links: [
        { label: "create a THOUGHT ↗", href: "/thought" },
        { label: "view the Pulse field ↗", href: "/path" },
        { label: "inspect verification boundaries ↗", href: "/verify" },
      ],
    },
  ],
};

export const DOCS_AUTHORITY_MAP: Record<
  string,
  {
    lead: DocsAuthority[];
    figure?: DocsAuthority[];
    sectionFigures?: Record<string, DocsAuthority[]>;
    preformatted?: Record<string, DocsAuthority[]>;
    sections: Record<string, DocsAuthority[]>;
  }
> = {
  inshell: {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sectionFigures: {
      "docs-inshell-practice": ["artist-editorial"],
    },
    sections: {
      "docs-inshell-anonymity": ["artist-editorial"],
      "docs-inshell-truth": ["artist-editorial"],
      "docs-inshell-practice": ["artist-editorial"],
      "docs-inshell-surface": ["artist-editorial", "app-documentation"],
      "docs-inshell-names": ["artist-editorial", "contract-release"],
    },
  },
  "agent-art": {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sections: {
      "docs-agent-art-participation": ["artist-editorial"],
      "docs-agent-art-field": ["artist-editorial"],
      "docs-agent-art-inshell": ["artist-editorial"],
    },
  },
  movements: {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sections: {
      "docs-movements-agent-art": ["artist-editorial"],
      "docs-movements-thought": ["artist-editorial"],
      "docs-movements-will": ["artist-editorial"],
      "docs-movements-awa": ["artist-editorial"],
      "docs-movements-progress": [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      "docs-movements-status": ["artist-editorial", "app-documentation"],
    },
  },
  thought: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sectionFigures: {
      "docs-thought-work": ["app-documentation", "contract-release"],
      "docs-thought-agent-handoff": ["app-documentation"],
      "docs-thought-provenance": ["app-documentation", "contract-release"],
    },
    sections: {
      "docs-thought-work": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-thought-language": ["app-documentation", "contract-release"],
      "docs-thought-human-choice": ["app-documentation", "contract-release"],
      "docs-thought-agent-handoff": ["app-documentation", "contract-release"],
      "docs-thought-form": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-thought-provenance": ["app-documentation", "contract-release"],
      "docs-thought-local": ["app-documentation"],
    },
  },
  will: {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sections: {
      "docs-will-known": ["artist-editorial"],
      "docs-will-forming": ["artist-editorial"],
      "docs-will-status": ["artist-editorial", "app-documentation"],
    },
  },
  awa: {
    lead: ["artist-editorial"],
    figure: ["artist-editorial"],
    sections: {
      "docs-awa-known": ["artist-editorial"],
      "docs-awa-forming": ["artist-editorial"],
      "docs-awa-status": ["artist-editorial", "app-documentation"],
    },
  },
  path: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sectionFigures: {
      "docs-path-capacity": ["app-documentation", "contract-release"],
    },
    sections: {
      "docs-path-permission": ["artist-editorial", "contract-release"],
      "docs-path-issuance": ["artist-editorial", "contract-release"],
      "docs-path-capacity": ["app-documentation", "contract-release"],
      "docs-path-consumption": ["contract-release"],
      "docs-path-ownership": ["app-documentation", "contract-release"],
      "docs-path-spark": ["app-documentation", "contract-release"],
      "docs-path-record": ["app-documentation", "contract-release"],
    },
  },
  pulse: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sectionFigures: {
      "docs-pulse-serial": ["contract-release"],
    },
    preformatted: {
      "Pulse pump and drop equations": ["artist-editorial"],
    },
    sections: {
      "docs-pulse-serial": ["artist-editorial", "contract-release"],
      "docs-pulse-pump": ["contract-release"],
      "docs-pulse-drop": ["app-documentation", "contract-release"],
      "docs-pulse-live-price": ["app-documentation", "contract-release"],
      "docs-pulse-settlement": ["app-documentation", "contract-release"],
      "docs-pulse-artwork": ["artist-editorial", "app-documentation"],
    },
  },
  contracts: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sectionFigures: {
      "docs-contracts-responsibilities": ["contract-release"],
    },
    sections: {
      "docs-contracts-responsibilities": ["contract-release"],
      "docs-contracts-app": ["app-documentation", "contract-release"],
      "docs-contracts-consumption": ["contract-release"],
      "docs-contracts-release": ["app-documentation", "contract-release"],
    },
  },
  "artwork-metadata-chain": {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    figure: ["app-documentation", "contract-release"],
    sections: {
      "docs-reading-identity": ["contract-release"],
      "docs-reading-artwork": ["app-documentation", "contract-release"],
      "docs-reading-portable": ["app-documentation", "contract-release"],
      "docs-reading-context": ["app-documentation", "contract-release"],
    },
  },
  "mono-76": {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    figure: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-mono-76-repertoire": ["app-documentation", "contract-release"],
      "docs-mono-76-form": ["artist-editorial", "contract-release"],
      "docs-mono-76-native-svg": ["app-documentation", "contract-release"],
      "docs-mono-76-interface": ["artist-editorial", "app-documentation"],
      "docs-mono-76-release": ["app-documentation", "contract-release"],
    },
  },
  verification: {
    lead: ["artist-editorial", "app-documentation", "contract-release"],
    sections: {
      "docs-verification-terms": ["app-documentation"],
      "docs-verification-provenance": ["app-documentation", "contract-release"],
      "docs-verification-levels": ["app-documentation"],
      "docs-verification-checklist": ["app-documentation", "contract-release"],
    },
  },
  "wallet-local-data": {
    lead: ["app-documentation"],
    figure: ["app-documentation"],
    sections: {
      "docs-wallet-passive": ["app-documentation"],
      "docs-wallet-actions": ["app-documentation"],
      "docs-wallet-storage": ["app-documentation"],
      "docs-wallet-networks": ["app-documentation"],
    },
  },
  "source-release-boundaries": {
    lead: ["app-documentation", "contract-release"],
    figure: ["app-documentation", "contract-release"],
    sections: {
      "docs-source-ownership": ["app-documentation", "contract-release"],
      "docs-source-pins": ["app-documentation", "contract-release"],
      "docs-source-deployment": ["app-documentation", "contract-release"],
      "docs-source-publication": ["app-documentation"],
    },
  },
  "design-principles": {
    lead: ["artist-editorial", "app-documentation"],
    figure: ["artist-editorial", "app-documentation"],
    sectionFigures: {
      "docs-design-selection": [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      "docs-design-canonical": ["app-documentation", "contract-release"],
    },
    sections: {
      "docs-design-bounds": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-design-selection": ["artist-editorial", "app-documentation", "contract-release"],
      "docs-design-visible-mechanism": [
        "artist-editorial",
        "app-documentation",
        "contract-release",
      ],
      "docs-design-canonical": ["app-documentation", "contract-release"],
      "docs-design-claims": ["artist-editorial", "app-documentation"],
      "docs-design-time": ["artist-editorial", "app-documentation", "contract-release"],
    },
  },
};

export const AGENT_DOCS_INDEX_PATH = "/docs/agent-index.json";
export const AGENT_DOCS_CONTENT_PATH = "/docs/content.json";
export const AGENT_DOCS_MARKDOWN_PATH = "/docs/index.md";

export function agentDocsPrompt(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [
    "Read Inshell's public docs index and follow its answer policy:",
    `${base}${AGENT_DOCS_INDEX_PATH}`,
    "",
    "If you cannot fetch a required source, say so. Do not guess.",
    "",
    "When ready, reply:",
    "I've read the current Inshell docs. Ask me anything about Inshell.",
  ].join("\n");
}
