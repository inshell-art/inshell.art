# Inshell Mono 76 v1.0.0 — downstream implementation handoff

- Release tag: `v1.0.0`
- Package: `@inshell/mono-76`
- Family: `Inshell Mono 76`
- Short name: `Mono 76`
- Face: `Regular 400`

## What to consume

Consume only the sealed package in `release/mono-76/` or install the exact Git
tag. Do not consume `experiments/`, `sets/fifth-set/`, or the Source Code Pro
outline reference under `legacy/`.

The release contains 76 ordered records:

```text
 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,?!:;'"-()/&
```

SPACE is metrics-only; 75 records draw paths.

## Option A — install the immutable Git tag

```sh
npm install "git+ssh://git@github.com/inshell-art/inshell-mono-76.git#v1.0.0"
```

Commit the lockfile. Confirm that it resolves commit and tag `v1.0.0`; do not
depend on `main` or an experiment branch.

## Option B — vendor the release directory

```sh
git clone --branch v1.0.0 --depth 1 \
  git@github.com:inshell-art/inshell-mono-76.git /tmp/inshell-mono-76-v1
mkdir -p vendor
cp -R /tmp/inshell-mono-76-v1/release/mono-76 vendor/mono-76
node ./vendor/mono-76/verify.mjs
npm install --save ./vendor/mono-76
```

Commit the complete `vendor/mono-76/` directory and the lockfile. Never copy
only `glyphs.json` or `packed.bin`; the verifier, metadata, notice, and hashes
are part of the dependency contract.

## Render SVG

```js
import {
  assertMono76Text,
  loadMono76Font,
  renderMono76Line,
  supportsMono76Text
} from "@inshell/mono-76";

const font = await loadMono76Font();
const text = "THOUGHT WILL AWA!";

if (!supportsMono76Text(font, text)) {
  throw new Error("Mono 76 received unsupported text");
}
assertMono76Text(font, text);

const svg = renderMono76Line(font, text, {
  background: "#000000",
  stroke: "#00ff35",
  padding: 2
});
```

The renderer returns a complete SVG string. To compose paths yourself, load
`@inshell/mono-76/glyphs` and preserve this exact visual contract:

- `fill="none"`
- `stroke-width="1.23"`
- `stroke-linecap="round"`
- `stroke-linejoin="round"`
- fixed advance `10`
- global x-origin shift `+1`
- no kerning
- y-up paths placed using the declared SVG baseline and a `scale(1 -1)` flip

The 40 optical translations are already baked into the `d` strings. Do not
apply `composition.appliedPerGlyphOffsets` at runtime.

## Use the on-chain payload

```js
import { loadMono76Packed } from "@inshell/mono-76";
import {
  decodeMono76PackedGlyph,
  inspectMono76Packed
} from "@inshell/mono-76/onchain/decoder";

const packed = await loadMono76Packed();
const metadata = inspectMono76Packed(packed);
const thoughtPath = [..."THOUGHT"].map((character) =>
  decodeMono76PackedGlyph(packed, character)
);

console.log(metadata.glyphCount); // 76
console.log(metadata.pathBytes);  // 4438
console.log(thoughtPath);
```

IM76 stores raw path strings only. On-chain renderers must reproduce the
stroke, cap, join, advance, origin shift, and SVG coordinate transform.

## CI and integrity pin

For a vendored installation:

```json
{
  "scripts": {
    "verify:mono-76": "node ./vendor/mono-76/verify.mjs"
  }
}
```

For a Git-tag installation, run:

```sh
node ./node_modules/@inshell/mono-76/release/mono-76/verify.mjs
```

Pin the final values published in `release/mono-76/manifest.json`:

- `faceSha256`
- `packedSha256`
- `packedKeccak256`
- `manualEditPayloadSha256`

Do not copy hash values from a design experiment or an earlier Fifth Set
export.

## Acceptance checklist

1. Verify the installed package.
2. Render `THOUGHT WILL AWA!` and `PATH`.
3. Render uppercase, lowercase, `0123456789`, and `.,?!:;'"-()/&`.
4. Confirm SPACE advances by 10 units without drawing a path.
5. Confirm unsupported input throws instead of substituting a glyph.
6. Confirm fixed advance, origin shift, stroke, caps, joins, and no fill.
7. Confirm no runtime kerning or second optical-offset table is applied.
8. Pin the Git tag and manifest hashes in the downstream release record.

## Rollback

Rollback by restoring the downstream repository's previous dependency and
lockfile. Do not use repository tag `v0.1.0` as an equivalent visual rollback:
that tag is the older Source Code Pro-derived outline reference with different
geometry, metrics, size, and licensing.
