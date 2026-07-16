# THOUGHT SVG V2 Binary Interleave 32

Identifier: `inshell.thought.svg.v2.binary-interleave-32`

The renderer emits exact UTF-8 SVG bytes with `width="960"`, `height="960"`, and `viewBox="0 0 960 960"`.

## Binary field

Encode each line as UTF-8 and emit every byte MSB-first. Cycle or truncate each source independently to 512 bits, then interleave `P0,A0,P1,A1,...,P511,A511`. Pack the result into 128 bytes with field bit zero as the most significant bit of byte zero. Grid index is row-major.

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

The Agent text block clears complete cells at x=96, y=384, width=768, height=72. The prompt text block clears complete cells at x=144, y=816, width=672, height=48. The blocks have no visible frame or fill distinct from the canvas.

Agent text is centered at (480,420), font size 44. Prompt text is centered at (480,840), font size 16. Both use `dominant-baseline="middle"`, white fill, and the exact font-family bytes in the reference renderer. Text that exceeds its clip uses the specified deterministic SVG `<animate>` carousel; short text remains centered.

XML escaping order is `&`, `<`, `>`, `"`, `'`. Attribute order, integer formatting, element order, and final SVG bytes are fixed by the reference renderer and normative fixtures. Determinism claims exact SVG bytes, not identical raster pixels across font environments.
