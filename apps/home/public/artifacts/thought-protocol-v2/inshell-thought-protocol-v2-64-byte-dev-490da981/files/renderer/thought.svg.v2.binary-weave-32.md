# THOUGHT SVG V2 Binary Weave 32

Identifier: `inshell.thought.svg.v2.binary-weave-32`

The renderer emits canonical UTF-8 SVG bytes with `width="960"`, `height="960"`, and `viewBox="0 0 960 960"`. The deployed `ThoughtNFT` pins an immutable renderer contract whose `RENDERER_ID_HASH` must equal the hash of this identifier.

## Binary loom

Encode each accepted line as its exact UTF-8 bytes. Cycle each non-empty source independently to exactly 64 bytes, then read each expanded source MSB-first as 512 bits.

For every row and column in a 32 x 32 row-major field:

```text
if (row + column) is even:
  field[row][column] = promptBits[row * 16 + floor(column / 2)]
else:
  field[row][column] = agentBits[column * 16 + floor(row / 2)]
```

Pack the 1024 field bits row-major and MSB-first into exactly 128 bytes. Prompt bits therefore travel horizontally and Agent bits vertically. The packed field is artwork input and a work-hash component, not Agent identity.

| Property | Value |
| --- | --- |
| field | x=96, y=96, width=768, height=768 |
| grid | 32 x 32 |
| cell | 24 x 24 |
| center | x=108+24*col, y=108+24*row |
| one | filled circle r=6 |
| zero | hollow circle r=7, stroke=2 |
| canvas | `#000000` |
| field | `#006100`, opacity 1 |

The Agent text block clears rows 11 through 14. The prompt text block clears rows 30 and 31, columns 2 through 29. The SVG emits black clear rectangles at x=92, y=372, width=776, height=76 and x=148, y=820, width=664, height=48. Neither block has a visible frame or non-canvas fill.

Agent text is centered at (480,410), font size 44, clipped at x=94, y=373, width=772, height=74, rx=9. Prompt text is centered at (480,844), font size 16, clipped at x=150, y=821, width=660, height=46, rx=9. Both use `dominant-baseline="middle"`, `xml:space="preserve"`, white fill, and the exact font-family bytes in the reference renderer. Text exceeding its activation width uses the deterministic SVG `<animate>` carousel; short text remains centered.

XML escaping order is `&`, `<`, `>`, `"`, `'`. Attribute order, integer formatting, element order, and final SVG bytes are fixed by the reference renderer and normative fixtures. Determinism claims exact SVG bytes, not identical raster pixels across font environments.
