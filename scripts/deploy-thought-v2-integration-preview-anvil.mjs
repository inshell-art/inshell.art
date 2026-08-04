#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ContractFactory,
  NonceManager,
  concat,
  encodeBytes32String,
  getBytes,
  id,
  keccak256,
  toBeHex,
  toUtf8Bytes,
  zeroPadValue,
  JsonRpcProvider,
  ZeroAddress,
} from "../apps/thought/node_modules/ethers/lib.esm/index.js";
import {
  THOUGHT_ANVIL_CHAIN_ID,
  THOUGHT_ANVIL_RPC_URL,
  THOUGHT_CONTRACT_RUNTIME_FILE,
  THOUGHT_PATH_FIXTURE_COUNT,
  THOUGHT_PATH_FIXTURE_SIGNER_INDEX,
  resolvePinnedPathRelease,
} from "./thought-local-lane.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rpcUrl = process.env.RPC_URL?.trim() || THOUGHT_ANVIL_RPC_URL;
const treasury = process.env.PATH_TREASURY ?? "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const artifactId = "thought-v2-canonical-portable-release-20260801-r1";
const previewRoot = path.join(
  root,
  "apps/thought/contract-release/releases",
  artifactId,
);
const compiledRoot = path.join(previewRoot, "contract/compiled");
const creativeSpecLockFile = path.join(root, "apps/thought/spec/THOUGHT.v2.lock.json");
const creativeSpecFile = path.join(root, "apps/thought/spec/THOUGHT.v2.md");
const provenanceRoot = path.join(root, "apps/thought/provenance/v2");
const provenanceLockFile = path.join(provenanceRoot, "provenance-lock.json");
const provenanceSchemaFile = path.join(
  provenanceRoot,
  "thought.provenance.v2.schema.json",
);
const addressesFile = THOUGHT_CONTRACT_RUNTIME_FILE;
const lockFile = path.join(root, "apps/thought/contract-release/consumer-lock.json");
const movement = encodeBytes32String("THOUGHT");
const auctionOpenDelaySeconds = Number.parseInt(
  process.env.PATH_AUCTION_OPEN_DELAY_SECONDS ?? "30",
  10,
);

if (
  !Number.isSafeInteger(auctionOpenDelaySeconds) ||
  auctionOpenDelaySeconds < 0
) {
  throw new Error("PATH_AUCTION_OPEN_DELAY_SECONDS must be a non-negative integer");
}

const readArtifact = async (file) => {
  const artifact = JSON.parse(await fs.readFile(file, "utf8"));
  const bytecode = typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode?.object;
  if (!artifact.abi || !bytecode || bytecode === "0x") throw new Error(`invalid artifact: ${file}`);
  return { abi: artifact.abi, bytecode };
};

const deploy = async (signer, file, args = []) => {
  const artifact = await readArtifact(file);
  const contract = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
};

const thoughtArtifact = (contract) => path.join(compiledRoot, `${contract}.json`);

const normalizeCanonicalJson = (value) => {
  if (Array.isArray(value)) return value.map(normalizeCanonicalJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalizeCanonicalJson(value[key])]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) throw new Error("non-finite JSON number");
  return value;
};

const canonicalJsonStringify = (value) => JSON.stringify(normalizeCanonicalJson(value));

const deployDataPointer = async (signer, payload) => {
  const runtime = concat(["0x00", payload]);
  const runtimeLength = getBytes(runtime).length;
  if (runtimeLength > 24_576) {
    throw new Error(`code-storage pointer runtime is ${runtimeLength}/24576 bytes`);
  }
  const creation = concat([
    "0x61",
    zeroPadValue(toBeHex(runtimeLength), 2),
    "0x80600c6000396000f3",
    runtime,
  ]);
  const receipt = await (await signer.sendTransaction({ data: creation })).wait();
  if (!receipt?.contractAddress) throw new Error("code-storage pointer deployment failed");
  return receipt.contractAddress;
};

const assertDataPointer = async (provider, pointer, expectedKeccak256, label) => {
  const code = await provider.getCode(pointer);
  if (!code.startsWith("0x00") || keccak256(`0x${code.slice(4)}`) !== expectedKeccak256) {
    throw new Error(`${label} pointer readback failed`);
  }
};

const previewFileKeccak = async (relativePath) =>
  keccak256(await fs.readFile(path.join(previewRoot, relativePath)));

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function main() {
  const provider = new JsonRpcProvider(rpcUrl);
  const pathRelease = await resolvePinnedPathRelease();
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(THOUGHT_ANVIL_CHAIN_ID)) {
    throw new Error(
      `local acceptance deploy requires THOUGHT Anvil chain ${THOUGHT_ANVIL_CHAIN_ID}, got ${network.chainId}`,
    );
  }
  const unlockedSigner = await provider.getSigner(0);
  const deployerAddress = await unlockedSigner.getAddress();
  const existingNonce = await provider.getTransactionCount(deployerAddress);
  if (existingNonce !== 0 && process.env.INSHELL_ALLOW_LOCAL_REDEPLOY !== "1") {
    throw new Error(
      `local acceptance deploy requires fresh Anvil; deployer nonce is ${existingNonce}. ` +
      "Set INSHELL_ALLOW_LOCAL_REDEPLOY=1 only after saving an explicit local-chain checkpoint.",
    );
  }
  const signer = new NonceManager(unlockedSigner);
  const vendorLock = JSON.parse(await fs.readFile(lockFile, "utf8"));
  if (
    vendorLock.artifactId !== artifactId ||
    vendorLock.productionConsumable !== true ||
    vendorLock.deploymentAuthorized !== false
  ) {
    throw new Error("canonical portable Contract release lock mismatch");
  }
  const creativeSpecLock = JSON.parse(await fs.readFile(creativeSpecLockFile, "utf8"));
  if (
    creativeSpecLock.schema !== "inshell.thought.creative-spec-lock.v1" ||
    creativeSpecLock.authority?.owner !== "THOUGHT App" ||
    creativeSpecLock.contractIntegration?.registered !== false
  ) {
    throw new Error("App-owned creative spec lock mismatch");
  }
  const specName = creativeSpecLock.artifact?.name;
  const specRef =
    `app://thought/creative-spec/${creativeSpecLock.artifactId}/${specName}`;
  if (specName !== "THOUGHT.v2.md") {
    throw new Error("App-owned creative spec name mismatch");
  }
  const provenanceLock = JSON.parse(await fs.readFile(provenanceLockFile, "utf8"));
  const provenanceSchemaBytes = await fs.readFile(provenanceSchemaFile);
  if (
    provenanceLock.schema !== "inshell.thought.provenance-lock.v1" ||
    provenanceLock.authority?.owner !== "THOUGHT App" ||
    provenanceLock.provenanceSchema !== "inshell.thought.provenance.v2" ||
    provenanceLock.publication?.published !== false ||
    provenanceLock.artifacts?.schema?.sha256 !== sha256(provenanceSchemaBytes) ||
    provenanceLock.artifacts?.schema?.keccak256 !== keccak256(provenanceSchemaBytes)
  ) {
    throw new Error("App-owned provenance V2 lock mismatch");
  }
  const provenanceSchemaRef =
    `app://thought/provenance/${provenanceLock.artifactId}/thought.provenance.v2.schema.json`;

  const latest = await provider.getBlock("latest");
  if (!latest) throw new Error("latest Anvil block unavailable");
  const currentWallClock = Math.floor(Date.now() / 1000);
  const openTime = BigInt(
    Math.max(latest.timestamp, currentWallClock) + auctionOpenDelaySeconds,
  );

  const pathNft = await deploy(signer, pathRelease.artifacts.PathNFT, [
    deployerAddress,
    "PATH",
    "PATH",
    "",
    99n,
    604_800n,
  ]);
  const pathNftAddress = await pathNft.getAddress();
  const adapter = await deploy(signer, pathRelease.artifacts.PathPulseAdapter, [
    deployerAddress,
    ZeroAddress,
    pathNftAddress,
    1n,
    1n,
  ]);
  const adapterAddress = await adapter.getAddress();
  const auction = await deploy(signer, pathRelease.artifacts.PulseAuction, [
    openTime,
    600_000_000_000_000_000n,
    10_000_000_000_000_000n,
    9_000_000_000_000_000n,
    100_000_000_000_000n,
    ZeroAddress,
    treasury,
    adapterAddress,
  ]);
  const auctionAddress = await auction.getAddress();
  await (await adapter.setAuction(auctionAddress)).wait();
  await (await adapter.freezeWiring()).wait();
  await (await pathNft.grantRole(id("MINTER_ROLE"), adapterAddress)).wait();
  await (await pathNft.freezePublicMinter(adapterAddress)).wait();

  const specBytes = await fs.readFile(creativeSpecFile);
  const specSha256 = createHash("sha256").update(specBytes).digest("hex");
  const thoughtSpecId = id(specName);
  const thoughtSpecHash = keccak256(specBytes);
  const expectedSpec = creativeSpecLock.artifact;
  if (
    specBytes.length !== expectedSpec.byteLength ||
    specSha256 !== expectedSpec.sha256 ||
    thoughtSpecId !== expectedSpec.thoughtSpecId ||
    thoughtSpecHash !== expectedSpec.thoughtSpecHash
  ) {
    throw new Error("App-owned creative spec bytes do not match their lock");
  }

  const specRegistry = await deploy(signer, thoughtArtifact("ThoughtSpecRegistry"), [deployerAddress]);
  const specRegistryAddress = await specRegistry.getAddress();
  const staticSpec = await specRegistry.registerThoughtSpec.staticCall(specName, specRef, specBytes);
  if (staticSpec[0] !== thoughtSpecId || staticSpec[1] !== thoughtSpecHash) {
    throw new Error("selected spec registration parity failed");
  }
  await (await specRegistry.registerThoughtSpec(specName, specRef, specBytes)).wait();

  const protocolRegistry = await deploy(signer, thoughtArtifact("ThoughtSpecRegistryV2"), [deployerAddress]);
  const protocolRegistryAddress = await protocolRegistry.getAddress();
  const rendererProfile = JSON.parse(await fs.readFile(
    path.join(previewRoot, "protocol/current/v2/renderer/thought.renderer.v2.profile.json"),
    "utf8",
  ));
  const glyphPackedBytes = await fs.readFile(
    path.join(previewRoot, rendererProfile.format.packedPath),
  );
  const glyphPackedKeccak256 = keccak256(glyphPackedBytes);
  const glyphPackedSha256 = sha256(glyphPackedBytes);
  if (
    glyphPackedBytes.length !== rendererProfile.format.totalBytes ||
    glyphPackedKeccak256 !== rendererProfile.format.packedKeccak256 ||
    glyphPackedSha256 !== rendererProfile.format.packedSha256
  ) {
    throw new Error("Mono 76 packed renderer payload mismatch");
  }
  const glyphDataPointer = await deployDataPointer(signer, glyphPackedBytes);
  await assertDataPointer(
    provider,
    glyphDataPointer,
    glyphPackedKeccak256,
    "Mono 76 packed glyph data",
  );
  const renderer = await deploy(
    signer,
    thoughtArtifact("ThoughtRendererV2"),
    [glyphDataPointer],
  );
  const rendererAddress = await renderer.getAddress();
  if (
    await renderer.IMPLEMENTATION_ID() !== rendererProfile.implementationId ||
    await renderer.GLYPH_LIBRARY_MEMBER_ID() !==
      rendererProfile.glyphSource.libraryMemberId ||
    await renderer.glyphDefinitionsPointer1() !== glyphDataPointer ||
    await renderer.glyphDefinitionsPointer2() !== ZeroAddress ||
    await renderer.glyphDefinitionsIndexPointer() !== ZeroAddress ||
    await renderer.glyphDefinitionsKeccak256() !== glyphPackedKeccak256 ||
    await renderer.GLYPH_PACKED_KECCAK256() !== glyphPackedKeccak256 ||
    await renderer.EXTERNAL_URL_BASE() !==
      vendorLock.compatibility.metadataProfile.externalUrl.base
  ) {
    throw new Error("Mono 76 renderer compatibility check failed");
  }

  const manifestArtifacts = [
    {
      keccak256: provenanceLock.artifacts.schema.keccak256,
      path: provenanceSchemaRef,
      role: "provenance-schema",
    },
    {
      keccak256: thoughtSpecHash,
      path: specRef,
      role: "creative-spec",
    },
    ...await Promise.all([
    ["work-profile", "protocol/current/v2/work/thought.work.v2.profile.json"],
    ["context-profile", "protocol/current/v2/context/thought.context.v2.profile.json"],
    ["metadata-profile", "protocol/current/v2/metadata/thought.metadata.v2.profile.json"],
    ["creation-attestation-profile", "protocol/current/v2/attestation/thought.creation-workflow-attestation.v2.md"],
    ["renderer-profile", "protocol/current/v2/renderer/thought.renderer.v2.profile.json"],
    ["renderer-glyph-packed-im76", "protocol/current/v2/renderer/mono-76.im76.bin"],
    ["renderer-glyph-package-manifest", "dependencies/mono-76/manifest.json"],
    ["renderer-glyph-provenance", "dependencies/mono-76/PROVENANCE.md"],
    ["renderer-glyph-license", "dependencies/mono-76/UNLICENSED.md"],
    ["renderer-glyph-notice", "dependencies/mono-76/NOTICE.md"],
    ].map(async ([role, artifactPath]) => ({
      keccak256: await previewFileKeccak(artifactPath),
      path: artifactPath,
      role,
    }))),
  ];
  const compatibility = vendorLock.compatibility;
  const manifest = {
    artifacts: manifestArtifacts,
    chainId: network.chainId.toString(),
    glyphLibrary: {
      family: rendererProfile.glyphSource.familyName,
      faceSha256: rendererProfile.glyphSource.faceSha256,
      libraryMemberId: rendererProfile.glyphSource.libraryMemberId,
      librarySetId: rendererProfile.glyphSource.familyId,
      manualEditPayloadSha256:
        rendererProfile.glyphSource.manualEditPayloadSha256,
      packedBytes: glyphPackedBytes.length,
      packedKeccak256: glyphPackedKeccak256,
      packedSha256: `0x${glyphPackedSha256}`,
      releaseTag: rendererProfile.glyphSource.releaseTag,
      releaseReady: rendererProfile.qualification.rendererReleaseReady,
      role: "canonical-native-svg-paths",
    },
    identifiers: {
      contextProfile: compatibility.contextProfile.id,
      contextProfileHash: compatibility.contextProfile.idKeccak256,
      metadataProfile: compatibility.metadataProfile.id,
      metadataProfileHash: compatibility.metadataProfile.idKeccak256,
      provenance: compatibility.provenance.id,
      renderer: compatibility.renderer.canonicalId,
      rendererHash: compatibility.renderer.canonicalIdKeccak256,
      workProfile: compatibility.workProfile.id,
      workProfileHash: compatibility.workProfile.idKeccak256,
    },
    productionRegistrationAuthorized: false,
    rendererImplementation: {
      id: compatibility.renderer.packagedImplementation,
      releaseReady: rendererProfile.qualification.rendererReleaseReady,
      usesForeignObject: rendererProfile.restrictions.foreignObject,
      usesNativeSvgPaths: true,
    },
    schema: "inshell.thought.protocol.v2.disposable-anvil-manifest.v1",
    selectedSpec: { name: specName, thoughtSpecHash, thoughtSpecId },
    status: "registered-disposable-anvil",
  };
  const manifestJson = canonicalJsonStringify(manifest);
  const manifestHash = keccak256(toUtf8Bytes(manifestJson));
  const manifestURI = `dev://thought/v2/anvil/${manifestHash}`;
  const protocolReleaseId = await protocolRegistry.registerRelease.staticCall(manifestHash, manifestURI);
  await (await protocolRegistry.registerRelease(manifestHash, manifestURI)).wait();

  const verifier = await deploy(signer, thoughtArtifact("CreationAttestationVerifierV2"), [deployerAddress, deployerAddress]);
  const verifierAddress = await verifier.getAddress();
  const thoughtNft = await deploy(signer, thoughtArtifact("ThoughtNFTV2"), [
    pathNftAddress,
    specRegistryAddress,
    rendererAddress,
    protocolRegistryAddress,
    protocolReleaseId,
    verifierAddress,
  ]);
  const thoughtNftAddress = await thoughtNft.getAddress();
  await (await pathNft.setMovementConfig(movement, thoughtNftAddress, 1)).wait();
  await (await pathNft.freezeMovementConfig(movement)).wait();

  // Daily THOUGHT App work must exercise the canonical PATH contract boundary,
  // but it must not depend on the separately owned auction flow. Seed disposable
  // Spark fixtures through PATH's official issuer-allowlist/self-claim path.
  const fixtureUnlockedSigner = await provider.getSigner(
    THOUGHT_PATH_FIXTURE_SIGNER_INDEX,
  );
  const fixtureOwner = await fixtureUnlockedSigner.getAddress();
  const fixtureSigner = new NonceManager(fixtureUnlockedSigner);
  const fixturePathNft = pathNft.connect(fixtureSigner);
  await (await pathNft.grantRole(id("RESERVED_ROLE"), deployerAddress)).wait();
  const pathFixtureTokens = [];
  for (let index = 0; index < THOUGHT_PATH_FIXTURE_COUNT; index += 1) {
    await (await pathNft.allowSparker(fixtureOwner)).wait();
    const tokenId = await fixturePathNft.mintSparker.staticCall("0x");
    await (await fixturePathNft.mintSparker("0x")).wait();
    const [owner, stage, stageMinted, sparker] = await Promise.all([
      pathNft.ownerOf(tokenId),
      pathNft.getStage(tokenId),
      pathNft.getStageMinted(tokenId),
      pathNft.isSparker(tokenId),
    ]);
    if (
      owner.toLowerCase() !== fixtureOwner.toLowerCase() ||
      stage !== 0n ||
      stageMinted !== 0n ||
      sparker !== true
    ) {
      throw new Error(`seeded PATH fixture ${tokenId} failed canonical readback`);
    }
    pathFixtureTokens.push({
      tokenId: tokenId.toString(),
      initialOwner: owner,
      initialStage: Number(stage),
      initialStageMinted: Number(stageMinted),
      sparker,
    });
  }
  const pathReservedRemaining = Number(await pathNft.getReservedRemaining());

  const runtime = {
    schema: "inshell.thought.v2.anvil-gallery-runtime.v1",
    status: "ready",
    generatedAt: new Date().toISOString(),
    artifact: {
      artifactId,
      classification: vendorLock.classification,
      manifestSha256: vendorLock.manifestSha256,
      sourceTag: vendorLock.sourceTag,
      sourceCommit: vendorLock.sourceCommit,
      productionConsumable: true,
      deploymentAuthorized: false,
      acceptanceOnly: true,
    },
    localContractIntegration: {
      id: artifactId,
      productionConsumable: true,
      deploymentAuthorized: false,
      acceptanceOnly: true,
    },
    localLane: {
      id: "thought",
      isolation: "dedicated-anvil",
      pathRelease: {
        releaseTag: pathRelease.pin.releaseTag,
        releasePublicationCommit: pathRelease.pin.releasePublicationCommit,
        contractSourceCommit: pathRelease.pin.contractSourceCommit,
        manifestSha256: pathRelease.pin.manifestSha256,
      },
    },
    creativeSpec: {
      artifactId: creativeSpecLock.artifactId,
      authority: creativeSpecLock.authority.owner,
      byteLength: specBytes.length,
      name: specName,
      ref: specRef,
      sha256: specSha256,
      thoughtSpecHash,
      thoughtSpecId,
    },
    provenance: {
      artifactId: provenanceLock.artifactId,
      authority: provenanceLock.authority.owner,
      id: provenanceLock.provenanceSchema,
      ref: provenanceSchemaRef,
      schemaKeccak256: provenanceLock.artifacts.schema.keccak256,
      schemaSha256: provenanceLock.artifacts.schema.sha256,
    },
    rpcUrl,
    chainId: Number(network.chainId),
    path: { address: pathNftAddress },
    pathNft: { address: pathNftAddress },
    pathPulseAdapter: { address: adapterAddress },
    pulseAuction: { address: auctionAddress },
    paymentToken: { address: ZeroAddress },
    pathMovement: { name: "THOUGHT", quota: 1, frozen: true },
    pathSpark: {
      claimMode: "issuer-allowlist-recipient-self-claim",
      issuer: deployerAddress,
      reservedCap: 99,
      reservedRemaining: pathReservedRemaining,
      claimDurationSeconds: 604800,
    },
    pathFixtures: {
      schema: "inshell.thought.local-path-fixtures.v1",
      purpose: "routine-thought-development-without-path-auction-dependency",
      disposableOnly: true,
      source: "reserved-spark-self-claim",
      pathReleaseTag: pathRelease.pin.releaseTag,
      ownerSignerIndex: THOUGHT_PATH_FIXTURE_SIGNER_INDEX,
      initialOwner: fixtureOwner,
      movement: "THOUGHT",
      movementQuotaPerToken: 1,
      count: pathFixtureTokens.length,
      tokens: pathFixtureTokens,
    },
    pathAuction: {
      openTime: Number(openTime),
      k: "600000000000000000",
      genesisPrice: "10000000000000000",
      genesisFloor: "9000000000000000",
      pts: "100000000000000",
      treasury,
    },
    thoughtSpecRegistry: { address: specRegistryAddress, owner: deployerAddress },
    protocolRegistry: { address: protocolRegistryAddress, owner: deployerAddress },
    contracts: {
      pathNft: pathNftAddress,
      thoughtSpecRegistry: specRegistryAddress,
      thoughtRenderer: rendererAddress,
      protocolRegistry: protocolRegistryAddress,
      creationAttestationVerifier: verifierAddress,
      thoughtNft: thoughtNftAddress,
    },
    thoughtRenderer: {
      address: rendererAddress,
      id: await renderer.RENDERER_ID(),
      idHash: await renderer.RENDERER_ID_HASH(),
      implementationId: await renderer.IMPLEMENTATION_ID(),
      externalUrlBase: await renderer.EXTERNAL_URL_BASE(),
      glyphDataPointer,
      glyphDefinitionsKeccak256: glyphPackedKeccak256,
      glyphPackedBytes: glyphPackedBytes.length,
      glyphPackedKeccak256,
      glyphPackedSha256,
      glyphLibraryMemberId: await renderer.GLYPH_LIBRARY_MEMBER_ID(),
    },
    renderer: {
      canonicalRendererId: await renderer.RENDERER_ID(),
      implementationId: await renderer.IMPLEMENTATION_ID(),
      releaseReady: rendererProfile.qualification.rendererReleaseReady,
      externalUrlBase: await renderer.EXTERNAL_URL_BASE(),
      glyphDataPointer,
      glyphDefinitionsKeccak256: glyphPackedKeccak256,
      glyphPackedBytes: glyphPackedBytes.length,
      glyphPackedKeccak256,
      glyphPackedSha256,
      glyphLibraryMemberId: await renderer.GLYPH_LIBRARY_MEMBER_ID(),
    },
    creationAttestationVerifier: {
      address: verifierAddress,
      authority: await verifier.authority(),
      authorityEpoch: Number(await verifier.authorityEpoch()),
      owner: deployerAddress,
      profileId: await verifier.profileId(),
    },
    attestation: {
      authority: await verifier.authority(),
      authorityEpoch: Number(await verifier.authorityEpoch()),
      profileId: await verifier.profileId(),
      status: "mock-valid-eip712",
      verifier: verifierAddress,
    },
    thought: { address: thoughtNftAddress },
    thoughtNft: { address: thoughtNftAddress },
    protocolRelease: {
      id: protocolReleaseId,
      manifestHash,
      manifestUri: manifestURI,
      manifestURI,
      status: manifest.status,
      manifest,
      manifestJson,
      rendererIdHash: compatibility.renderer.canonicalIdKeccak256,
      workProfileIdHash: compatibility.workProfile.idKeccak256,
      contextProfileIdHash: compatibility.contextProfile.idKeccak256,
      metadataProfileIdHash: compatibility.metadataProfile.idKeccak256,
      creationAttestationProfileIdHash: compatibility.creationAttestation.idKeccak256,
    },
    thoughtSpecs: [{
      specName,
      specId: thoughtSpecId,
      specHash: thoughtSpecHash,
      ref: specRef,
      byteLength: specBytes.length,
      sha256: specSha256,
    }],
    recommendedThoughtSpecName: specName,
    recommendedThoughtSpecId: thoughtSpecId,
    recommendedThoughtSpecHash: thoughtSpecHash,
    thoughtSpec: { specName, id: thoughtSpecId, hash: thoughtSpecHash, ref: specRef },
    selectedSpec: {
      id: thoughtSpecId,
      hash: thoughtSpecHash,
      name: specName,
      ref: specRef,
    },
  };
  await fs.mkdir(path.dirname(addressesFile), { recursive: true });
  await fs.writeFile(addressesFile, `${JSON.stringify(runtime, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(runtime, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
