# THOUGHT V2 FE Bubble Shape Handoff

Date: 2026-07-02
Source branch: `codex/thought-v2-bubble-shape`

Purpose: hand off the current THOUGHT V2 local render behavior to FE so the production frontend can adopt the current square agent frame / prompt block artifact look.

Palette note: this artifact branch currently uses the inverted/reversed palette trial.

Current local page:

```text
npm run dev:v2
http://127.0.0.1:5177/thought-v2-lab.html
```

Published artifact bridge:

```text
artifacts/thought-v2/latest.json
artifacts/thought-v2/experimental.json
artifacts/thought-v2/releases/<artifact_id>/manifest.json
```

Downstream repos should fetch a channel JSON, then the referenced manifest, then verify every fetched file against its manifest sha256 before use. Production consumers should pin an immutable `artifact_id` and hashes, not a moving channel.

Current source files:

```text
thought-v2-lab.html
src/thought-v2-lab.ts
src/thought-v2-fixtures.ts
src/thought-v2-fixtures.test.ts
src/thought-v2-renderer.ts
src/thought-v2-renderer.test.ts
src/svg-lab.css
```

## Current Render Contract

The renderer exports:

```ts
buildThoughtV2Svg(input: ThoughtV2SvgInput): string
measureThoughtV2Line(value: string, kind: "prompt" | "agent"): ThoughtV2Measure
```

`buildThoughtV2Svg` emits a formatted multiline SVG string.

The SVG is always:

```text
width="960"
height="960"
viewBox="0 0 960 960"
```

Top-level SVG shape:

```xml
<svg ...>
  <rect id="work-frame" width="960" height="960" fill="#202020"/>
  <g id="work-canvas" transform="translate(16 16) scale(0.9666666666666667)">
    <rect id="canvas-bg" .../>
    <g id="binary-background" ...>
      <text ...>01010001 ...</text>
      ...
    </g>
    <defs>
      <clipPath id="agent-line-clip">...</clipPath>
      <clipPath id="prompt-line-clip">...</clipPath>
    </defs>
    <g id="agent-line-area">
      <rect id="agent-line-bg" .../>
      ...
    </g>
    <g id="prompt-line-area">
      <rect id="prompt-line-bg" .../>
      ...
    </g>
    ...
  </g>
</svg>
```

`work-frame` is part of the SVG artifact itself. FE should not recreate this frame with CSS or page chrome.

`binary-background` is part of the SVG artifact itself. It converts the visible `promptLine` to UTF-8 bytes, then converts the visible `agentLine` to UTF-8 bytes, concatenates the prompt bitstream before the agent bitstream, and lays that one bitstream across the background once. It does not repeat or cycle the binary. The renderer maps each `1` bit to a filled green SVG `<circle>` centered inside a square grid cell and each `0` bit to a hollow green SVG `<circle>` with `fill="none"`. The zero circle uses the same center, radius, and square grid cell as the one circle, so absence is felt as a real place with equal horizontal and vertical footprint. The renderer fits the one-pass bitstream into a centered square-cell grid inside the binary background area. The line frames are hollow so this binary layer reads as the canvas texture under the two visible lines.

The agent line renders as a hollow rounded frame with `fill="none"`. The prompt line renders as a rounded hollow frame with `fill="none"` near the bottom.

## Fixed Local Lab Values

The local lab intentionally removed the style controls. It fixes these values:

```ts
{
  agentFontSize: 44,
  promptFontSize: 16,
  agentTextColor: "#ffffff",
  promptTextColor: "#ffffff",
  agentBgColor: "none",
  agentFrameColor: "#ffffff",
  canvasBgColor: "#000000"
}
```

Default preview text:

```ts
{
  agentLine: "quiet Agent مرحبا",
  promptLine: "Quiet signal 你好"
}
```

## Layout Math

Canvas:

```text
960 x 960
center line y = 480
```

Binary background:

```text
source order = promptLine bytes, then agentLine bytes
encoding = UTF-8
layout = one-pass-square-cell-grid
x = 48
y = 57
max rows = 48
width = 864
height = 846
glyph for 1 = SVG circle
glyph for 0 = hollow SVG circle, fill="none", stroke="#006100", stroke-width="1"
cell mode = square-grid-fit
dot radius ratio = 0.32
dot radius formula = ceil(cell size * 0.32)
dot radius has no fixed min/max cap
fill = #006100
opacity = 0.50
```

Agent frame:

```text
agent bg x = 87
agent bg y = 378
agent bg width = 786
agent bg height = 70
agent bg rx = 8
agent bg fill = none
agent bg stroke = agentFrameColor
agent bg stroke width = AGENT_FRAME_STROKE_WIDTH = 1
agent clip x = 88
agent clip y = 378
agent clip width = 784
agent clip height = 70
agent clip rx = 8
agent text x = 480
agent text y = 413
```

Prompt pill:

```text
prompt bg x = 165
prompt bg y = 868
prompt bg width = 630
prompt bg height = 44
prompt bg rx = 8
prompt bg fill = none
prompt bg stroke width = 1
prompt clip x = 166
prompt clip y = 868
prompt clip width = 628
prompt clip rx = 8
prompt clip height = 44
prompt text x = 480
prompt text y = 890
```

Legacy `lineBgPadding` and `promptBottomOffset` inputs are ignored by this experimental shape branch.

## Text Rendering

All visible text uses:

```xml
dominant-baseline="middle"
text-anchor="middle"
```

The font-family attribute is emitted with raw single quotes, not XML apostrophe entities:

```xml
font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Noto Sans Mono', 'Noto Sans Mono CJK SC', 'Noto Sans Mono CJK JP', 'Noto Sans Mono CJK KR', 'Noto Sans', monospace, sans-serif"
```

SVG text content is XML escaped. Attribute values use attribute escaping and intentionally keep apostrophes raw where legal.

## Carousel Behavior

Both `agentLine` and `promptLine` use the same over-width behavior.

Display units:

```text
ASCII printable U+0021..U+007E = 6 units
normal space U+0020 = 4 units
CJK / fullwidth ranges = 10 units
other visible codepoints = 8 units
```

Visual width estimate:

```text
textWidth = ceil(displayUnits * fontSize / 10)
```

If `textWidth <= targetWidth`, the line is centered:

```xml
<text id="agent-line-text" x="480" ...>...</text>
<text id="prompt-line-text" x="480" ...>...</text>
```

If `textWidth > targetWidth`, the renderer emits a carousel group clipped to the line area:

```xml
<g id="agent-line-carousel">
  <text id="agent-line-text" x="88" clip-path="url(#agent-line-clip)" ...>
    ...
    <animate attributeName="x" values="88;{88 - travel}" dur="{duration}s" repeatCount="indefinite"/>
  </text>
  <text id="agent-line-text-copy" x="{88 + travel}" clip-path="url(#agent-line-clip)" ...>
    ...
    <animate attributeName="x" values="{88 + travel};88" dur="{duration}s" repeatCount="indefinite"/>
  </text>
</g>
```

Prompt line uses the same shape with `prompt-line-carousel`, `prompt-line-clip`, and start x `166`.

Carousel constants:

```text
agent targetWidth = 784
prompt targetWidth = 628
gap = max(240, fontSize * 6)
travel = textWidth + gap
duration seconds = max(14, ceil(travel / 80))
```

## Current Validation

Current lab validation rejects:

```text
empty line
byte length > 1024
display units > 960
leading spaces
trailing spaces
repeated normal spaces
ASCII/C1 control characters
non-normal Unicode spaces
known invisible/bidi control characters
invalid surrogate codepoints
```

Current lab validation allows:

```text
mixed case Latin text
multilingual visible UTF-8
Arabic / CJK / other visible scripts
```

FE tightening still needs to decide and implement deterministic visible-line derivation from raw prompt and raw Agent output. Do not uppercase Latin text as a policy. The visible `agentLine` should preserve the Agent return casing as-is after validation/spacing normalization.

## Local Prepared Works Gallery

The local lab now renders multiple prepared works through `buildThoughtV2Svg` on the same page as the editable preview.

All text injected into lab canvases lives in:

```text
src/thought-v2-fixtures.ts
```

The fixture text module exports:

```ts
thoughtV2DefaultText
thoughtV2TextCorpuses
thoughtV2TextFixtures
```

Each work card shows:

```text
rendered THOUGHT canvas
promptLine text
agentLine text
byte / display-unit metadata
```

Current fixture corpuses:

```text
mixed baseline
long agent lines
long prompt lines
dual carousel stress
global scripts
```

Representative prepared works:

```text
work 01 mixed signal
promptLine: Quiet signal 你好
agentLine:  quiet signal مرحبا

work 02 small ritual
promptLine: small ritual
agentLine:  small ritual

work 03 cjk
promptLine: 安静的信号
agentLine:  静かな合図

work 04 rtl
promptLine: صوت هادئ
agentLine:  אות שקט

work 05 indic thai
promptLine: धीमा संकेत
agentLine:  สัญญาณสงบ

work 06 punctuation
promptLine: signal: quiet, then clear
agentLine:  quiet, then clear

work 07 agent carousel
promptLine: long agent check
agentLine:  a long Agent line should carousel across the canvas without squeezing

work 08 prompt carousel
promptLine: trace the quiet signal across the archive before it becomes another visible proof of attention carried through the window and back
agentLine:  quiet archive

work 19 dual clean spacing
promptLine: the prompt also travels so both text fields need independent clean spacing between repeated copies
agentLine:  the Agent answer is long and the prompt is also long so both lines should carousel cleanly

work 24 human check
promptLine: a human should be able to watch the loop once and understand where each line begins and ends
agentLine:  a human check should see the beginning and end of the Agent line without overlap

work 25 greek
promptLine: ήσυχο σήμα
agentLine:  ήρεμη απάντηση

work 30 ethiopic
promptLine: ጸጥ ያለ ምልክት
agentLine:  የተረጋጋ መልስ

work 40 inuktitut
promptLine: ᓂᐱᖃᙱᑦᑐᖅ ᓇᓗᓇᐃᒃᑯᑕᖅ
agentLine:  ᓇᑲᑦᑐᖅ ᑭᐅᔾᔪᑎ
```

Expected live page signals:

```text
42 work cards
42 work SVGs
43 total SVGs including the editable preview
42 promptLine rows
42 agentLine rows
3 work cards per row at normal widths
multiple long agent carousel works
multiple long prompt carousel works
broad script coverage including Greek, Cyrillic, Korean, Armenian, Georgian, Ethiopic, Khmer, Lao, Tibetan, Tamil, Bengali, Vietnamese, Myanmar, Sinhala, Cherokee, Inuktitut, Turkish, and Polish
```

## FE Tightening Checklist

1. Move renderer constants into the production FE path or import this renderer directly.
2. Make the mint preview and mint calldata use the same `promptLine` and `agentLine` strings.
3. Decide deterministic derivation from raw prompt / raw Agent return to visible lines:
   - normalize normal spaces
   - reject or repair repeated spaces before mint
   - preserve Agent return casing as-is
   - decide clipping / ellipsis strategy for over-limit raw text
4. Keep provenance separate from visible display lines:
   - raw prompt
   - raw Agent return
   - visible promptLine
   - visible agentLine
   - hashes for raw and visible fields
5. Confirm whether animated SVG carousel is acceptable for tokenURI / marketplace rendering.
6. If animated SVG is risky for marketplaces, define a deterministic static fallback.
7. Add browser QA for fallback font behavior on macOS, Windows, and common mobile browsers.
8. Keep `dominant-baseline="middle"` everywhere in V2 SVG output.
9. Keep prompt line with the small rounded hollow frame unless product direction changes.
10. Keep page shell dark/light mode responsive to `prefers-color-scheme`.

## Verification Commands

Current implementation was verified with:

```text
npm test
npm run build
```

Current expected test count:

```text
6 test files
42 tests
```

Direct serialization checks should confirm:

```text
dominant-baseline="middle" exists
dominant-baseline="central" does not exist
'Noto Sans Mono' exists in font-family
&apos;Noto Sans Mono&apos; does not exist
SVG output has multiple lines
```
