#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyThoughtMetadataPortability } from "./lib/thought-metadata-portability.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = JSON.parse(await fs.readFile(
  path.join(root, "apps/thought/contract-release/consumer-lock.json"),
  "utf8",
));
const releaseRoot = path.join(
  root,
  "apps/thought/contract-release/releases",
  lock.artifactId,
);
const metadataProfile = JSON.parse(await fs.readFile(
  path.join(releaseRoot, "protocol/current/v2/metadata/thought.metadata.v2.profile.json"),
  "utf8",
));
const fixture = JSON.parse(await fs.readFile(
  path.join(releaseRoot, "fixtures/neutral-agent-model-token-uri-examples.anvil.json"),
  "utf8",
));

const gates = {
  canonicalExternalUrl: { passed: false, detail: "not checked" },
  portableMarketplaceTraits: { passed: false, detail: "not checked" },
  productionContractArtifact: {
    passed: lock.productionConsumable === true,
    detail: lock.productionConsumable === true
      ? `${lock.artifactId} is production-consumable`
      : `${lock.artifactId} is nonproduction`,
  },
};

try {
  const result = verifyThoughtMetadataPortability({
    artifactId: lock.artifactId,
    decodedExamples: fixture.examples,
    metadataProfile,
  });
  gates.canonicalExternalUrl = {
    passed: true,
    detail: `${result.verifiedExamples} decoded tokenURI fixtures use canonical external_url values`,
  };
} catch (error) {
  gates.canonicalExternalUrl.detail = error instanceof Error ? error.message : String(error);
}

try {
  verifyThoughtMetadataPortability({
    artifactId: lock.artifactId,
    decodedExamples: fixture.examples,
    metadataProfile,
    requirePortableTraits: true,
  });
  gates.portableMarketplaceTraits = {
    passed: true,
    detail: "metadata profile and decoded tokenURI fixtures use the portable five-trait profile",
  };
} catch (error) {
  gates.portableMarketplaceTraits.detail = error instanceof Error ? error.message : String(error);
}

const localReady = Object.values(gates).every(({ passed }) => passed);
const stagingReady = localReady && lock.deploymentAuthorized === true;
const blockers = Object.entries(gates)
  .filter(([, gate]) => !gate.passed)
  .map(([gate, value]) => ({ gate, detail: value.detail }));
const stagingBlockers = [
  ...blockers,
  ...lock.deploymentAuthorized === true
    ? []
    : [{
        gate: "deploymentAuthorization",
        detail: `${lock.artifactId} does not authorize staging or persistent-chain deployment`,
      }],
];

console.log(JSON.stringify({
  schema: "inshell.thought.portability-readiness.v1",
  artifactId: lock.artifactId,
  localReady,
  stagingReady,
  deploymentAuthorized: lock.deploymentAuthorized === true,
  gates,
  blockers,
  stagingBlockers,
}, null, 2));

if (process.argv.includes("--require-ready") && !localReady) process.exitCode = 1;
if (process.argv.includes("--require-staging-ready") && !stagingReady) process.exitCode = 1;
