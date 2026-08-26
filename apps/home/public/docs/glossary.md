# Glossary

> Working definitions of the terms these documents depend on, each pointing to the article that owns the full account.

- Group: Lineage and context
- Status: current
- Authority classes in this document: artist-editorial, app-documentation
- Canonical page: https://inshell.art/docs/glossary
- Documentation version: 2026-08-21-r2
- Structured JSON schema: https://inshell.art/docs/content.v2.schema.json

## Overview

- Authority: artist-editorial, app-documentation

This page fixes how Inshell's documentation uses a term. Where a term has a dedicated article, the entry orients the reader and links onward instead of repeating the argument, examples, or history kept there.

These are working definitions. They settle usage inside these documents, not the general meaning of a word, and several entries mark questions the practice deliberately leaves open.

## aesthetic architecture

- Authority: artist-editorial

The structure of a work that the artist holds and can inspect. In Inshell's SVG practice it is the paths, shapes, positions, relations, and rules that organize what is drawn. Holding it literally is what lets a human intention vary the work and an Agent act within it without replacing the structure with an unspecified image-making process. See [Fully Onchain](https://inshell.art/docs/fully-onchain#docs-fully-onchain-agent-art).

## Agent

- Authority: artist-editorial

A participant that interprets, reasons, chooses, and acts, rather than a particular model, architecture, or product. What is an Agent? is one of the [open questions](https://inshell.art/docs/agent-art#docs-agent-art-field) the field keeps. This entry fixes usage in these documents; it does not answer the question.

## Agent Art

- Authority: artist-editorial

Art in which an Agent participates at the level of intention. A runtime, service, interface, tool use, or executor role may carry that participation, but none of them establishes it alone. [Agent Art](https://inshell.art/docs/agent-art) is a field and a form, not an ideology or a prescribed human–Agent relation.

## Agent intent

- Authority: artist-editorial

The intent of the Agent that enters a work through how it interprets, chooses, proposes, directs, or acts. It may be constrained by or formed in response to human intention, and it implies no authorship, autonomy, collaboration, or equality by itself. See [the Agent era](https://inshell.art/docs/agents-and-ai#docs-agents-agent).

## algorithmic execution

- Authority: artist-editorial

Applying a procedure that determines what the machine produces. Inshell contrasts it with an Agent interpreting inside a composed architecture, as described under [Design Principles](https://inshell.art/docs/design-principles#docs-design-thinking). The contrast marks a difference in artistic role. It is not a claim that Agents operate without algorithms.

## App record

- Authority: app-documentation

A record the App assembled, stored, or signed, carrying the boundary the App declares for it. It is not a contract fact and not a chain observation. See [what the App does](https://inshell.art/docs/contracts#docs-contracts-app).

## artistic participation

- Authority: artist-editorial

The threshold at which an Agent's thinking power enters a work as intent rather than as infrastructure. Agent Art's invariant is met at this threshold and not before, which is why supplying a runtime or carrying out a fully determined instruction does not satisfy it. See [intentional participation](https://inshell.art/docs/agent-art#docs-agent-art-participation).

## authority

- Authority: app-documentation

The person or system that originates a claim, as distinct from the immediate source an interface loaded it from. A mirror or cache can supply a value without becoming its authority. See [four terms that should not blur](https://inshell.art/docs/verification#docs-verification-terms).

## canonical

- Authority: app-documentation

The form that owns a fact, as opposed to any surface that displays it. A wallet, marketplace, explorer, or App page can present a work while the contract, tokenURI, and pinned release remain canonical for it. See [one canonical form, many reading surfaces](https://inshell.art/docs/design-principles#docs-design-canonical).

## chain observation

- Authority: app-documentation

A read of public chain state scoped to one named network, deployment, and observation point. It describes state as observed and does not become a permanent property of the work. See [read context with the object](https://inshell.art/docs/artwork-metadata-chain#docs-reading-context).

## contract release

- Authority: app-documentation

A pinned artifact set defining expected contract code, schemas, or renderer material. It establishes what a release contains, not that the release is deployed anywhere. See [why pins matter](https://inshell.art/docs/source-release-boundaries#docs-source-pins).

## Creation Attestation

- Authority: app-documentation

A signed claim binding one THOUGHT creation record to its exact recorded values, which the contract validates at mint. A valid attestation evidences that binding. It does not prove hidden model reasoning, guarantee a provider identity, or settle authorship. See [provenance and attestation](https://inshell.art/docs/thought#docs-thought-provenance).

## crowd

- Authority: artist-editorial

The scope WILL moves the inquiry into: many people and many Agents in the formation of what can be called one will. One will does not mean consensus, unanimity, or governance, and the movement's concrete form is not specified. See [WILL: the crowd](https://inshell.art/docs/movements#docs-movements-will).

## deployment

- Authority: app-documentation

The record that places released code on a network: the network itself, contract addresses, deployment blocks, and integration choices. A complete release without a deployment is not onchain. See [release is not deployment](https://inshell.art/docs/source-release-boundaries#docs-source-deployment).

## evidence level

- Authority: app-documentation

The label naming how a particular statement is supported: contract-verified, contract-release, chain-observed, App-recorded, runtime-reported, or artist-editorial. These levels must not be collapsed into one undifferentiated claim of verification. See [evidence levels](https://inshell.art/docs/verification#docs-verification-levels).

## fully onchain

- Authority: app-documentation

A narrow claim that a selected chain and its bound contracts return the complete canonical metadata and media without an external content object. It is not a synonym for immutable, non-upgradeable, decentralized, deployed, verified, or valuable; each of those needs its own evidence. See [Fully Onchain](https://inshell.art/docs/fully-onchain).

## human intention

- Authority: artist-editorial

What a person brings to a work as their own. In THOUGHT it is the exact prompt they write. It is the participant's contribution, distinct from the Agent intent that meets it. See [what makes one work](https://inshell.art/docs/thought#docs-thought-work).

## movement

- Authority: artist-editorial

A named artistic scope in Inshell's practice through which the inward direction takes successive forms. The movement is the artwork; $PATH is the permission that carries participation across the sequence. See [Movements](https://inshell.art/docs/movements).

## permission

- Authority: artist-editorial, app-documentation

What $PATH carries: the entitlement to authorize an eligible work in the movement it has reached. Permission is not the movement artwork, and it does not measure inward progress or certify anything about the holder. See [$PATH](https://inshell.art/docs/path).

## practice

- Authority: artist-editorial

The forms Inshell makes — movements, artworks, and participatory systems — through which the inward direction is approached. A practice can examine, inspect, suspect, read, listen, and feel; it does not claim to possess the truth it approaches. See [the practice](https://inshell.art/docs/inshell#docs-inshell-practice).

## provenance

- Authority: app-documentation

How the parts of a work or record connect across creation, rendering, selection, minting, and later display. Proof is narrower: the data a specific verification rule accepts. Provenance does not make every surrounding statement true. See [provenance and proof](https://inshell.art/docs/verification#docs-verification-provenance).

## release

- Authority: app-documentation

A versioned artifact set with its own identity and integrity, separate from any deployment of it and separate from the repository it was built from. See [release plus deployment](https://inshell.art/docs/contracts#docs-contracts-release).

## runtime report

- Authority: app-documentation

A value supplied by an Agent runtime or connector, such as a reported model name. It keeps that evidence level: it is not a provider identity guarantee and not a contract fact. See [the Agent handoff](https://inshell.art/docs/thought#docs-thought-agent-handoff).

## self

- Authority: artist-editorial

What the inward direction examines. Mind, spirit, memory, desire, reasoning, values, philosophy, logic, and choice are possible terms for that inquiry. Inshell opens the question and does not close it with a definition of essence, so this entry names the direction rather than its answer.

## shell

- Authority: artist-editorial

Any surface that makes something visible, operable, or legible: a body, face, or head; a name, honor, reputation, role, or social posture; an account, wallet, profile, or institution; an operating shell, terminal, command line, model label, or technical wrapper. A shell is real and often necessary. The error is mistaking it for the whole being. See [Inshell](https://inshell.art/docs/inshell).

## thinking power

- Authority: artist-editorial

Inshell's functional term for an Agent's capacity to interpret, reason, choose, and act rather than only apply a fixed procedure. It names functions of thinking that Agents increasingly undertake in work once performed by human minds. It does not claim that machine and human thought are identical and does not assert consciousness. Thinking power alone is not artistic participation; it becomes participation when some Agent intent enters the work. See [the gate from algorithm to thinking power](https://inshell.art/docs/generative-art#docs-generative-thinking-power).

## truth

- Authority: artist-editorial

In Inshell's artistic position, the direction named by inspect self. It is a direction of practice, not a doctrine, specification, or proposition that technical verification can establish. See [the truth](https://inshell.art/docs/inshell#docs-inshell-truth).


## Links

- [read Inshell](https://inshell.art/docs/inshell)
- [read Agent Art](https://inshell.art/docs/agent-art)
- [read Verification](https://inshell.art/docs/verification)
