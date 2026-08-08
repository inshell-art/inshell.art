# THOUGHT Work Profile V2

Identifier: `inshell.thought.work.v2.terminal-english-64`

## Artistic constraint

THOUGHT returns to the primitive computer age, when language had to pass
through a narrow terminal alphabet. V2 keeps that constraint as its form:
enough symbols for dialogue, hesitation, interruption, and connection,
without typographic ornament or programming syntax.

English is the protocol language of the finished work. This is a formal and
artistic constraint, not a claim that English is universal. The contract
enforces only the exact byte repertoire below. It cannot and must not decide
whether a line is grammatical English, meaningful, or aesthetically valid.

## Exact lines

`promptLine` is the visible human utterance. `agentLine` is the visible Agent
utterance. Each is an exact non-empty sequence of 1 through 64 accepted bytes.
Every accepted character is one US-ASCII byte, so byte and character counts
are equal.

The closed 76-character repertoire is:

```text
U+0020                         SPACE
U+0030-U+0039                  0-9
U+0041-U+005A                  A-Z
U+0061-U+007A                  a-z
U+002E U+002C U+003F U+0021    . , ? !
U+003A U+003B                  : ;
U+0027 U+0022                  ' "
U+002D U+0028 U+0029          - ( )
U+002F U+0026                  / &
```

In compact literal order:

```text
 ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,?!:;'"-()/&
```

The punctuation table is conversational: sentence rhythm, clause structure,
contractions, quotation, interruption, grouping, alternatives, and
connection. Punctuation-only lines such as `...` and `!!!` are valid. There is
no letter-or-digit requirement.

Leading U+0020, trailing U+0020, and repeated internal U+0020 are rejected.
Tabs, line breaks, controls, non-ASCII bytes, and every other printable ASCII
symbol are rejected. Accepted case, punctuation, and spacing are stored and
hashed exactly. No implementation may trim, collapse, normalize, case-fold,
translate, repair, or otherwise rewrite a submitted line.

Validation order is:

1. reject zero bytes;
2. reject more than 64 bytes;
3. reject leading or trailing U+0020;
4. scan each original byte from left to right, rejecting the first byte
   outside the closed repertoire or the first repeated U+0020;
5. accept the original bytes unchanged.

`declaredAgent` and `declaredModel` are creation-context labels, not visible
work lines. They remain exact 1-through-64-byte shortest-form UTF-8 strings
under `inshell.thought.context.v2.visible-utf8-64`. The Terminal English
repertoire does not apply to those declarations. Repeated internal U+0020 is
preserved for declarations even though it is rejected in artwork lines.

Both labels are exact typed mint fields, canonical metadata traits, and
required provenance declarations. Their exact UTF-8 hashes are bound into an
official creation-attestation claim. Their status is always
`declared-unverified`: attestation proves that an authorized signer bound the
labels to the claim, not that the labels are objectively true. Declarations do
not affect conversation identity, work hash, or SVG artwork.

## Ordered conversation identity

V2 uniqueness is the exact ordered pair `(promptLine, agentLine)`:

```text
same prompt + same Agent line      => duplicate
same prompt + different Agent line => distinct work
different prompt + same Agent line => distinct work
(prompt, Agent) != (Agent, prompt)  => distinct ordered roles
```

Hashes are:

```text
promptLineKeccak256 = keccak256(UTF8(promptLine))
agentLineKeccak256  = keccak256(UTF8(agentLine))

conversationIdentityDomain = keccak256(UTF8(
  "INSHELL_THOUGHT_V2_CONVERSATION_IDENTITY"
))

conversationIdentityHash = keccak256(abi.encode(
  conversationIdentityDomain,
  promptLineKeccak256,
  agentLineKeccak256
))
```

The duplicate check occurs before PATH consumption. Any failed mint must leave
PATH, supply, identity reservations, and work reservations unchanged.

## Work hash

V2 has no binary weave. Its work hash binds the exact lines to the canonical
renderer identity:

```text
rendererIdHash = keccak256(UTF8(
  "inshell.thought.svg.v2.terminal-chat-path-glyphs"
))
workDomain = keccak256(UTF8("INSHELL_THOUGHT_V2_WORK"))

workHash = keccak256(abi.encode(
  workDomain,
  rendererIdHash,
  promptLineKeccak256,
  agentLineKeccak256
))
```

`conversationIdentityHash` expresses collection uniqueness. `workHash`
fingerprints the same exact utterances under one renderer contract. Both are
computed authoritatively by `ThoughtNFTV2`.
