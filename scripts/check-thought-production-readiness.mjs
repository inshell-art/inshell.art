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
const launchState = read("apps/thought/src/thought-launch-state.ts");
const statusApi = read("functions/api/thought-agent/v1/shared.ts");
const attestationApi = read("functions/api/thought-contract/v2/attestation.ts");
const deploymentModule = read("apps/thought/src/thought-v2-production-deployment.ts");
const galleryRelease = read("functions/api/thought-gallery-release.ts");
const galleryApi = read("functions/api/thought-gallery.ts");
const galleryHome = read("apps/home/src/services/thoughtGallery.ts");
const ecosystemHome = read("apps/home/src/components/EcosystemHome.tsx");
const pathAuction = read("apps/home/src/components/AuctionCanvas.tsx");
const pathGallery = read("apps/home/src/components/PathPage.tsx");
const thoughtIndex = read("apps/thought/index.html");
const thoughtStyle = read("apps/thought/src/style.css");
const thoughtGalleryPage = read("apps/home/src/components/ThoughtGalleryPage.tsx");
const thoughtDetailPage = read("apps/home/src/components/ThoughtDetailPage.tsx");
const homeApp = read("apps/home/src/App.tsx");
const pathBeforeDeployPage = read("apps/home/src/components/PathBeforeDeployCanvas.tsx");
const studioPreviewService = read("apps/home/src/services/studioPreview.ts");
const homeStyle = read("apps/home/src/main.css");
const inshellShell = read("packages/inshell-shell/src/index.tsx");
const thoughtShell = read("apps/thought/src/thought-shell.tsx");

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
  consumer.artifactId !== "thought-v2-canonical-portable-release-20260807-r2" ||
  consumer.productionConsumable !== true ||
  consumer.deploymentAuthorized !== false
) fail("current canonical consumer lock drifted");

for (const snippet of [
  '"status": "canonical-portable-not-deployed"',
  '"v2MintEnabled": false',
]) if (!generated.includes(snippet)) fail(`generated protocol release is missing ${snippet}`);

for (const snippet of [
  "THOUGHT_V2_PROTOCOL_RELEASE.deployment.v2MintEnabled &&",
  "THOUGHT_V2_PRODUCTION_DEPLOYMENT &&",
  "PATH_AUCTION_ADDRESS",
  "const isThoughtMintEnabled = () => thoughtLaunchState.mintEnabled",
  "await refreshThoughtLaunchState();",
  "if (isThoughtMintEnabled()) {",
]) if (!main.includes(snippet)) fail(`browser mint gate is missing ${snippet}`);

for (const snippet of [
  'schema: "inshell.thought.launch-state.v1"',
  "readModelMatchesDeployment",
  "nowMs - observedAtMs <= maxReadModelAgeMs",
  'readModel.status === "open"',
  "observedAtMs >= openTimeMs",
]) if (!launchState.includes(snippet)) fail(`authoritative launch-state gate is missing ${snippet}`);

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
  'status: "prelaunch"',
  "THOUGHT records will appear when onchain minting opens.",
]) if (!ecosystemHome.includes(snippet)) fail(`canonical home gallery is missing ${snippet}`);

// studio-preview keeps the frontend usable, so the home surface must not
// describe a movement as undeployed.
for (const forbidden of [
  "not deployed",
  "on ${PUBLIC_NETWORK_CONFIG.chainLabel} now",
  "The gallery has no minted THOUGHTs yet.",
]) if (ecosystemHome.includes(forbidden)) fail(`canonical home gallery still says ${forbidden}`);

for (const forbidden of [
  "This view needs more room",
  "The $PATH contract is not deployed yet. Come back when it goes live.",
]) if (pathAuction.includes(forbidden)) fail(`canonical PATH surface still says ${forbidden}`);

for (const forbidden of ["Mint the first $PATH.", "Mint a $PATH"]) {
  if (pathAuction.includes(forbidden) || pathGallery.includes(forbidden)) {
    fail(`Studio Preview still exposes PATH mint guidance: ${forbidden}`);
  }
}

for (const snippet of [
  "const studioPreview = isStudioPreviewActive();",
  "studioPreview ? null : maybeResolveAddress",
  "studioPreview && !pathTokenId ? (",
  "<PathBeforeDeployCanvas />",
  "<VerifyPage beforeDeploy={studioPreview} />",
]) if (!homeApp.includes(snippet)) fail(`home route boundary is missing ${snippet}`);

for (const snippet of [
  "readAuctionStatusOverride",
  "isPathDeploymentActive",
]) if (!studioPreviewService.includes(snippet)) fail(`Studio Preview authority is missing ${snippet}`);

for (const snippet of [
  'data-auction-status="before_deploy"',
  "permission token for movement mints.",
  "$PATH minting is not open yet.",
  "The onchain release is being prepared.",
  "Create a THOUGHT while you wait.",
  'href="/thought"',
]) if (!pathBeforeDeployPage.includes(snippet)) fail(`before_deploy PATH copy is missing ${snippet}`);

if (inshellShell.includes("studioPreview ? null : <div")) {
  fail("before_deploy hides the read-only global wallet guidance");
}
for (const snippet of [
  "inshell-topbar__wallet-surface",
  '"connect wallet"',
  "address read only.",
  "no signature.",
  "no tx or approval.",
]) if (!inshellShell.includes(snippet)) fail(`shell wallet guidance is missing ${snippet}`);
for (const snippet of [
  "!studioPreview ? <ThoughtWalletBridge /> : null",
  "expectedChainId={studioPreview ? undefined : expectedChainId}",
  "studioPreview ? undefined : disconnectedWalletNote(expectedChainId)",
]) if (!thoughtShell.includes(snippet)) fail(`before_deploy wallet boundary is missing ${snippet}`);

for (const [source, label] of [
  [main, "standalone THOUGHT gallery"],
  [thoughtGalleryPage, "canonical THOUGHT gallery"],
  [thoughtDetailPage, "canonical THOUGHT detail"],
]) {
  for (const forbidden of [
    'galleryStatus.textContent = "Current THOUGHT collection is not deployed."',
    'thoughtDetailStatus.textContent = "Current THOUGHT collection is not deployed."',
  ]) if (source.includes(forbidden)) fail(`${label} still renders deployment absence`);
}

for (const snippet of [
  "Create and save a THOUGHT in this browser. Onchain minting is not open yet.",
  "Onchain THOUGHT details will appear when minting opens.",
]) if (!main.includes(snippet)) fail(`standalone THOUGHT surface is missing ${snippet}`);

for (const [source, label] of [
  [ecosystemHome, "home"],
  [pathBeforeDeployPage, "PATH"],
  [thoughtGalleryPage, "gallery"],
  [thoughtDetailPage, "THOUGHT detail"],
  [main, "standalone THOUGHT"],
]) if (source.includes("Studio Preview")) fail(`${label} exposes the internal Studio Preview label`);

for (const snippet of [
  "Create the first THOUGHT",
  "[ Home ]",
  "[ Create yours ]",
]) if (!thoughtIndex.includes(snippet)) fail(`THOUGHT navigation is missing ${snippet}`);

for (const [source, label] of [
  [homeStyle, "canonical THOUGHT gallery"],
  [thoughtStyle, "standalone THOUGHT gallery"],
]) {
  for (const snippet of [
    "grid-template-columns: minmax(0, 1fr) auto",
    "grid-column: 1 / -1",
  ]) if (!source.includes(snippet)) fail(`${label} mobile actions are missing ${snippet}`);
}

for (const forbidden of [
  "THOUGHT_V2_ARTIFACT_SAMPLES",
  "thoughtV2ArtifactSampleUrl",
  "fixtureWorks",
]) if (ecosystemHome.includes(forbidden)) fail(`canonical home gallery still renders ${forbidden}`);

for (const snippet of [
  '"/gallery": "THOUGHT works created from one human prompt and one Agent response."',
  '"/gallery": "THOUGHT gallery"',
]) if (!homeApp.includes(snippet)) fail(`canonical /gallery route is missing metadata ${snippet}`);

if (
  homeApp.includes('pathname === "/gallery"') &&
  homeApp.includes('window.history.replaceState({}, "", "/")')
) fail("canonical /gallery route is still rewritten to /");

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
  contractArtifactSynchronized: true,
  currentConsumerArtifactId: consumer.artifactId,
  deploymentLockEnabled: false,
  expectedNextArtifactId: lock.requiredArtifactId,
  preparedForReviewedProductionActivation: true,
  productionAttestationEnabled: false,
  signerIntegrationAuthorized: false,
}, null, 2));
