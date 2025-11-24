# PATH · Pulse Field — Design Brief

## 0. Context

This page is the live interface for **Pulse**, a Decentralized Automatic Auction (DAA), ferrying the first wave of **$PATH** NFTs.

It is not just a trading tool. It is:

- a **mathematical canvas** (one constant k, one formula f(x) = k / (x − a) + b),
- a **crowd instrument** (each bid sets the next beat),
- and a **philosophical surface** tying into **Inshell**, **Collective Generative Art**, and **the Comparative Drive**.

This brief defines the core message, tone, and key copy for the PATH Pulse page so designers and devs can build consistently around it.

## 1. Primary Message

> **This page is the live field where the PATH community’s belief crystallizes into PRICE over TIME — you can watch it, and you can write into it with your bids.**

Everything on the page (visual hierarchy, animations, microcopy) should reinforce this idea:

- **PRICE is BELIEF UNFOLDING in TIME** (Pulse thesis),
- each bid is a **beat**, not just a transaction,
- waiting vs acting is **authorship**, not passivity.

## 2. Supporting Pillars

Use these as design + copy anchors:

1. **Price = time‑coded belief**

   - The curve and stats should read like **belief over time**, not just a financial chart.
   - Copy should lean on words like _curve, ask, descent, beat, pulse, step_, instead of generic _update, entry, row_.

2. **The crowd sets the tempo**

   - No preset schedule: every bid spawns a new micro‑Dutch descent.
   - UI should make it clear that **participants control tempo** (rush vs lull).

3. **Radical transparency is part of the artwork**

   - One constant (k) and live parameters (a, b) are visible, not hidden.
   - Events and bids are readable as a **chronicle**, not a black box.

4. **Beyond commerce: a mirror for the Comparative Drive**
   - The page is also a **mirror of desire**, slowing down comparison instead of exploiting it.
   - Microcopy can occasionally hint at _watching your own urgency_, _reading your own impatience_, etc., without being preachy.

## 3. Conceptual References (for writers/designers)

These are source texts to stay aligned with:

- **Pulse: a Decentralized Automatic Auction**
  - Key phrases:
    - “PRICE is BELIEF UNFOLDING in TIME.”
    - “Mathematical canvas: one constant, one formula.”
    - “No cap: supply emerges from demand.”
    - “Crowd rhythm: each bid sets the next beat.”
    - “Radical transparency: trust rendered visible.”
- **What Is Inshell? / Collective Generative Art**
  - Inshell as a **transformative journey** away from superficial consumerism towards authentic creativity.
  - Collective Generative Art as **community + code + chain**.
- **The Comparative Drive**
  - Human behavior driven by comparison, amplified by information transmission and AI.
  - Pulse/Path/Inshell propose a slower, more legible way to see this drive at work.

Writers and designers should reuse phrases and structure from these texts where natural, but keep UI copy concise.

## 4. Tone & Voice

- **Art + math + crypto‑native**, in that order.
- Short, clean lines — no marketing fluff, no hype.
- Technical accuracy matters (on‑chain, curve, parameters), but always grounded in **human meaning**: belief, time, crowd rhythm.
- Use **“artifact”** spelling (not “artefact”) in new copy.

## 5. Page Structure & Key Copy

### 5.1 Hero Block

**Purpose:** Name this surface and state what it does in human + protocol terms.

- **Eyebrow (small, above title)**  
  `PULSE · price is belief unfolding in time`

- **Title (main)**  
  `PATH · pulse field`

- **Subtitle (one line, optional wrap)**  
  `Live Decentralized Automatic Auction for PATH passes — each bid a beat on the belief curve.`

This replaces any generic wording like “Live auction monitor”.

### 5.2 Core Stats / Curve Panel

**Purpose:** Show the current state of the belief curve.

Suggested labels:

- **Ask now**

  - _Caption:_ `Live on-chain ask · current point on the pulse curve.`

- **Last beat** (was “latest bid”)

  - _Caption:_ `Most recent step cleared · last heartbeat of collective belief.`
  - Content: address, amount, timestamp.

- **Opened**

  - _Caption:_ `When this curve began.`

- **Curve seed** (was “genesis price”)
  - _Caption:_ `k, floor, and offset seeding this PATH pulse.`
  - Content: floor price, k, maybe a and b in a compact form.

Curve / chart label:

- **Label for the graph area:** `Mathematical canvas`
  - _Small caption:_ `Hyperbola f(x) = k / (x − a) + b · updated with each beat.`

### 5.3 Live Bids List

**Purpose:** The chronological memory of belief.

Section heading:

- `Crowd rhythm`

Subheading / description:

- `Streaming from contract events · each bid sets the next beat.`
- Optionally: `Showing {visible} of {total} on-chain moments.`

Each row can be conceptualized as a **beat**:

- Address
- Amount
- Timestamp
- Simple status (e.g. “cleared”, “refunded” if relevant)

### 5.4 Interaction / Call to Action (if present on this page)

If the user can bid from here:

- Button label:

  - `Set the next beat` (primary choice)
  - or `Place bid · write the next step`

- Helper text:
  - `Bidding raises the ask by the time you let pass — TIME becomes premium.`

The intent: joining is framed as **authorship** of the curve, not just buying.

### 5.5 THOUGHT / WILL / AWA Band (Bottom Section)

**Purpose:** Hint at the wider Inshell / PATH arc, and position this auction as the first chapter.

Visual behavior (from spec):

- Each word appears light by default.
- On hover / mouse move: the word brightens and a brief schedule line fades in.

Copy suggestions:

- **THOUGHT**

  - Hover line: `THOUGHT · inward fields in code · arriving 2026`

- **WILL**

  - Hover line: `WILL · force and thresholds · arriving 2027`

- **AWA!**
  - Hover line: `AWA! · afterglow in motion · arriving 2028`

Years are placeholders; adjust as needed.  
The pattern to keep: **short poetic label + “arriving YEAR”**.

### 5.6 Footer / Infrastructure Links

**Purpose:** Ground the page within the Inshell ecosystem.

One short line above the links:

- `Infrastructure for the PATH world:`

Links (names are the main text; roles can be in title/tooltip attributes):

- `hone` — `hone · studio & minter`
- `pulse` — `pulse · auction engine`
- `GLYPH` — `GLYPH · on-chain glyph registry`

These can sit alongside external links (Twitter, GitHub, facets) if present.

## 6. Non‑Goals / What to Avoid

- Do **not** frame the page as a generic “dashboard” or “monitor”.
- Avoid trader slang and hype; this is closer to a **lab instrument + artwork** than an exchange.
- Don’t hide parameters (k, a, b) in settings; visibility of the math is part of the concept.

## 7. Summary for Devs / Codex

Implement the PATH auction page as a **live Pulse field**:

- **Data:** read on‑chain Pulse events and parameters (k, a, b, current ask, last bid, opening time).
- **Presentation:**
  - Hero with eyebrow, title, and subtitle from §5.1.
  - Stats + curve area labeled as in §5.2.
  - Stream of bids under “Crowd rhythm” (§5.3).
  - Optional bid CTA using the authorship language (§5.4).
  - THOUGHT / WILL / AWA hover band (§5.5).
  - Footer infra links (§5.6).

Use this brief together with the reference articles:

- “Pulse: a Decentralized Automatic Auction”
- “What Is Inshell?”
- “Collective Generative Art”
- “The Comparative Drive”

to keep future iterations (animations, state-specific copy, error states) aligned with the core message:

> **PATH price here is belief, unfolding in time, written visibly by the crowd.**

<!-- Paste your design brief content below this line. -->
