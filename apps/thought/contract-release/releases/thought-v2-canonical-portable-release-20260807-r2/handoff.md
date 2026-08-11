# THOUGHT V2 canonical portable Contract release r2 handoff

Date: 2026-08-07

From: THOUGHT Contract owner

To: `inshell.art/thought` owner

## Purpose

r2 is the production-consumable Contract package for the canonical THOUGHT V2
bytecode after pinning PATH v0.5.0. It supersedes r1 for new deployments. It
does not alter THOUGHT ABI, bytecode, token state, metadata, provenance,
attestation, renderer output, or mint semantics.

## Exact delta from r1

- pin PATH release `v0.5.0` and its immutable publication evidence;
- require PATH consume authorization schema `permission-epoch-v1`;
- require the canonical PATH `consumeUnit(...)` return type `uint32`;
- record that a fresh PATH deployment is required for this dependency;
- update the App / Contract boundary and release input with those facts.

The package contains machine-readable r1-to-r2 evidence proving every bundled
THOUGHT ABI, creation bytecode, runtime bytecode, selected-spec byte, renderer
payload, metadata fixture, and artwork fixture remains exact.

## Consumer rule

Consume r2 as one immutable pin. Verify its annotated tag, tag target,
manifest SHA-256, and every `SHA256SUMS.txt` entry. Do not combine the r2 PATH
lock with r1 release-envelope files.

Fresh local or persistent deployments must use a separately verified PATH
v0.5.0 deployment and must read `permissionEpoch` and consume nonce when
constructing PATH authorization.

## Authorization boundary

`productionConsumable: true` authorizes exact-byte consumption only. This
release does not authorize a deployment, protocol registration, signer use,
frontend rollout, or production promotion. Those remain explicit operator
actions.
