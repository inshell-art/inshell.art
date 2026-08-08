#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const readJson = (relative) => JSON.parse(read(relative));
const fail = (message) => {
  throw new Error(`THOUGHT production-readiness check failed: ${message}`);
};

const lock = readJson("apps/thought/production/deployment-lock.json");
const consumer = readJson("apps/thought/contract-release/consumer-lock.json");
const generated = read("packages/thought-agent-protocol/src/release.generated.ts");
const main = read("apps/thought/src/main.ts");
const statusApi = read("functions/api/thought-agent/v1/shared.ts");
const attestationApi = read("functions/api/thought-contract/v2/attestation.ts");
const deploymentModule = read("apps/thought/src/thought-v2-production-deployment.ts");
const galleryRelease = read("functions/api/thought-gallery-release.ts");
const galleryApi = read("functions/api/thought-gallery.ts");
const galleryHome = read("apps/home/src/services/thoughtGallery.ts");
const ecosystemHome = read("apps/home/src/components/EcosystemHome.tsx");
const homeApp = read("apps/home/src/App.tsx");

if (
  lock.schema !== "inshell.thought.production-deployment-lock.v1" ||
  lock.requiredArtifactId !== "thought-v2-canonical-portable-release-20260807-r2" ||
  lock.status !== "not-deployed" ||
  lock.enabled !== false ||
  lock.artifactId !== null ||
  lock.manifestSha256 !== null ||
  lock.chainId !== null ||
  lock.contracts !== null ||
  lock.deployBlocks !== null ||
  lock.release !== null ||
  lock.attestation !== null ||
  lock.authorization?.deploymentApproved !== false ||
  lock.authorization?.frontendActivationApproved !== false ||
  lock.authorization?.signerActivationApproved !== false
) fail("disabled deployment lock is incomplete, enabled, or contains deployment material");

if (
  consumer.artifactId !== "thought-v2-canonical-portable-release-20260801-r1" ||
  consumer.productionConsumable !== true ||
  consumer.deploymentAuthorized !== false
) fail("current canonical consumer lock drifted");

for (const snippet of [
  '"status": "canonical-portable-not-deployed"',
  '"v2MintEnabled": false',
]) if (!generated.includes(snippet)) fail(`generated protocol release is missing ${snippet}`);

for (const snippet of [
  "THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled &&",
  "THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null",
  "IS_LOCAL_THOUGHT_V2 || (",
]) if (!main.includes(snippet)) fail(`browser mint gate is missing ${snippet}`);

for (const snippet of [
  "THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled &&",
  "THOUGHT_V2_PRODUCTION_DEPLOYMENT !== null",
]) if (!statusApi.includes(snippet)) fail(`Agent API mint status gate is missing ${snippet}`);

for (const snippet of [
  'enabled: false',
  'PRODUCTION_ATTESTATION_NOT_AUTHORIZED',
  'json(503',
  'browserSigning: false',
]) if (!attestationApi.includes(snippet)) fail(`attestation fail-closed route is missing ${snippet}`);

for (const snippet of [
  "lock.artifactId !== pinnedArtifactId",
  "lock.manifestSha256 !== pinnedManifestSha256",
  "authorization?.deploymentApproved !== true",
  "authorization?.frontendActivationApproved !== true",
  "authorization?.signerActivationApproved !== true",
]) if (!deploymentModule.includes(snippet)) fail(`deployment-lock validator is missing ${snippet}`);

for (const snippet of [
  "THOUGHT_V2_PRODUCTION_DEPLOYMENT",
  "thoughtGallerySnapshotKey",
  "deployment.artifactId",
  "deployment.manifestSha256",
]) if (!galleryRelease.includes(snippet)) fail(`gallery release identity is missing ${snippet}`);

for (const snippet of [
  "THOUGHT_GALLERY_DEPLOYMENT_INACTIVE",
  "inactiveThoughtGalleryResponse",
  "deployment.contractAddress",
  "deployment.deployBlock",
]) if (!galleryApi.includes(snippet)) fail(`gallery API deployment gate is missing ${snippet}`);

for (const snippet of [
  "THOUGHT_V2_PRODUCTION_DEPLOYMENT",
  "clearThoughtGalleryCaches",
  "Current THOUGHT collection is not deployed.",
  "payload.artifactId !== THOUGHT_GALLERY_DEPLOYMENT.artifactId",
]) if (!galleryHome.includes(snippet)) fail(`home gallery deployment gate is missing ${snippet}`);

for (const snippet of [
  "isThoughtGalleryDeploymentActive",
  "loadThoughtGallery",
  'aria-label="THOUGHT works"',
  "Current THOUGHT collection is not deployed.",
]) if (!ecosystemHome.includes(snippet)) fail(`canonical home gallery is missing ${snippet}`);

for (const forbidden of [
  "THOUGHT_V2_ARTIFACT_SAMPLES",
  "thoughtV2ArtifactSampleUrl",
  "fixtureWorks",
]) if (ecosystemHome.includes(forbidden)) fail(`canonical home gallery still renders ${forbidden}`);

for (const snippet of [
  'pathname === "/gallery"',
  'window.history.replaceState({}, "", "/")',
]) if (!homeApp.includes(snippet)) fail(`deprecated /gallery route is missing redirect ${snippet}`);

const sensitivePattern = /(?:PRIVATE_KEY|MNEMONIC|SECRET_KEY|SIGNER_KEY)/;
for (const relative of [
  "apps/thought/production/deployment-lock.json",
  "apps/thought/src/thought-v2-production-deployment.ts",
  "functions/api/thought-contract/v2/attestation.ts",
]) if (sensitivePattern.test(read(relative))) fail(`${relative} contains forbidden signer material`);

const requireActivationReady = process.argv.includes("--require-activation-ready");
if (requireActivationReady) {
  fail("activation is blocked until canonical r2 is published, a deployment lock is reviewed, and the signer boundary is explicitly authorized");
}

console.log(JSON.stringify({
  activationReady: false,
  browserSigning: false,
  contractArtifactSynchronized: false,
  currentConsumerArtifactId: consumer.artifactId,
  deploymentLockEnabled: false,
  expectedNextArtifactId: lock.requiredArtifactId,
  preparedForReviewedProductionActivation: true,
  productionAttestationEnabled: false,
  signerIntegrationAuthorized: false,
}, null, 2));
