# THOUGHT Work Profile V2

Identifier: `inshell.thought.work.v2`

## Lines

`promptLine` is the exact human semantic input sent to the Agent and the visible human trace. `agentLine` is the exact returned thought and uniqueness identity. Both are preserved as submitted Unicode scalar sequences encoded as shortest-form UTF-8. No Unicode normalization is allowed.

Both lines must be non-empty and contain only accepted XML 1.0 characters plus ordinary internal U+0020 spaces. Reject malformed or non-shortest UTF-8, surrogate values, code points above U+10FFFF, C0/C1 controls, DEL, non-ASCII whitespace, the frozen Unicode 17.0 default-ignorable ranges, noncharacters, and leading/trailing U+0020. Repeated internal U+0020 spaces are valid and preserved.

| Line | UTF-8 byte length |
| --- | ---: |
| `promptLine` | 1 through 64 |
| `agentLine` | 1 through 64 |

Accepted bytes are stored and hashed exactly. Implementations must not trim, normalize, case-convert, collapse spaces, clip, repair, transliterate, or replace malformed encoding. Display units are renderer measurements only and are not acceptance limits.

### Strict UTF-8 grammar

Decode raw bytes before any transformation. Accept only shortest-form RFC 3629 sequences:

```text
00-7F
C2-DF 80-BF
E0 A0-BF 80-BF
E1-EC 80-BF 80-BF
ED 80-9F 80-BF
EE-EF 80-BF 80-BF
F0 90-BF 80-BF 80-BF
F1-F3 80-BF 80-BF 80-BF
F4 80-8F 80-BF 80-BF
```

Reject every other leader, lone or bad continuation byte, truncated sequence, overlong encoding, encoded surrogate, and value above U+10FFFF. JavaScript implementations must reject unpaired UTF-16 surrogates before calling `TextEncoder` so U+FFFD replacement cannot change identity.

### Frozen scalar predicates

The XML 1.0 Fifth Edition character production is:

```text
U+0009
U+000A
U+000D
U+0020-U+D7FF
U+E000-U+FFFD
U+10000-U+10FFFF
```

The later predicates reject U+0009, U+000A, U+000D, all C0 controls U+0000-U+001F, DEL and C1 controls U+007F-U+009F, and every Unicode 17.0.0 `White_Space` value except U+0020:

```text
U+0009-U+000D
U+0085
U+00A0
U+1680
U+2000-U+200A
U+2028-U+2029
U+202F
U+205F
U+3000
```

Reject exactly this frozen Unicode 17.0.0 `Default_Ignorable_Code_Point` denylist:

```text
U+00AD
U+034F
U+061C
U+115F-U+1160
U+17B4-U+17B5
U+180B-U+180F
U+200B-U+200F
U+202A-U+202E
U+2060-U+206F
U+3164
U+FE00-U+FE0F
U+FEFF
U+FFA0
U+FFF0-U+FFF8
U+1BCA0-U+1BCA3
U+1D173-U+1D17A
U+E0000-U+E0FFF
```

Reject noncharacters U+FDD0-U+FDEF and every scalar whose low 16 bits equal FFFE or FFFF. These numeric tables are permanent for this profile. Implementations must not substitute regex Unicode properties, locale APIs, glyph measurements, or a newer Unicode release.

Ordinary visible combining marks remain valid, including Thai marks, Arabic vowel marks, and `e` followed by U+0301. The denylist deliberately rejects ZWNJ, ZWJ, variation selectors, bidi formatting controls, tag characters, and therefore emoji sequences that require those values.

### Validation order

1. Reject raw byte length 0 or greater than 64.
2. Decode one scalar with the strict grammar.
3. Apply XML, control, whitespace, frozen default-ignorable, and noncharacter predicates.
4. Reject leading or trailing U+0020 and all-space input; preserve repeated internal U+0020.
5. Accept the original bytes unchanged.

## Hashes

```text
promptLineKeccak256 = keccak256(UTF8(promptLine))
agentLineKeccak256  = keccak256(UTF8(agentLine))

agentIdentityDomain = keccak256(UTF8("INSHELL_THOUGHT_V2_AGENT_IDENTITY"))
workDomain          = keccak256(UTF8("INSHELL_THOUGHT_V2_WORK"))
rendererIdHash      = keccak256(UTF8("inshell.thought.svg.v2.binary-weave-32"))

agentIdentityHash = keccak256(abi.encode(agentIdentityDomain, agentLineKeccak256))
workHash = keccak256(abi.encode(workDomain, rendererIdHash, promptLineKeccak256,
                                agentLineKeccak256, binaryFieldKeccak256))
```

`agentIdentityHash` is the permanent uniqueness key. `workHash` fingerprints the complete visible/render input and is not the uniqueness key. The contract computes all authoritative hashes.

Duplicate behavior: the same exact `agentLine` always rejects, even with a different prompt or provenance. A different `agentLine` with the same prompt is allowed.
