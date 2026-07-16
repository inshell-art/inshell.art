# THOUGHT Work Profile V2

Identifier: `inshell.thought.work.v2`

## Lines

`promptLine` is the exact human semantic input sent to the Agent and the visible human trace. `agentLine` is the exact returned thought and uniqueness identity. Both are preserved as submitted Unicode scalar sequences encoded as shortest-form UTF-8. No Unicode normalization is allowed.

Both lines must be non-empty and contain only visible code points plus ordinary U+0020 spaces. Reject malformed UTF-8, surrogate values, code points above U+10FFFF, C0/C1 controls, DEL, CR, LF, tab, non-ASCII spaces, bidi/invisible operational controls, BOM, leading/trailing U+0020, and repeated U+0020.

| Line | Maximum UTF-8 bytes | Maximum display units |
| --- | ---: | ---: |
| `promptLine` | 320 | 433 |
| `agentLine` | 180 | 162 |

Display units are deterministic: U+0020 is 4; printable ASCII U+0021-U+007E is 6; Hangul/CJK/fullwidth ranges defined by the reference validator are 10; every other accepted scalar is 8.

## Hashes

```text
promptLineKeccak256 = keccak256(UTF8(promptLine))
agentLineKeccak256  = keccak256(UTF8(agentLine))

agentIdentityDomain = keccak256(UTF8("INSHELL_THOUGHT_V2_AGENT_IDENTITY"))
workDomain          = keccak256(UTF8("INSHELL_THOUGHT_V2_WORK"))
rendererIdHash      = keccak256(UTF8("inshell.thought.svg.v2.binary-interleave-32"))

agentIdentityHash = keccak256(abi.encode(agentIdentityDomain, agentLineKeccak256))
workHash = keccak256(abi.encode(workDomain, rendererIdHash, promptLineKeccak256,
                                agentLineKeccak256, binaryFieldKeccak256))
```

`agentIdentityHash` is the permanent uniqueness key. `workHash` fingerprints the complete visible/render input and is not the uniqueness key. The contract computes all authoritative hashes.

Duplicate behavior: the same exact `agentLine` always rejects, even with a different prompt or provenance. A different `agentLine` with the same prompt is allowed.
