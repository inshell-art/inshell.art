import {
  Contract,
  ZeroAddress,
  encodeBytes32String,
  getAddress,
  keccak256,
  toUtf8Bytes,
  type ContractRunner,
  type Provider,
} from "ethers";

import thoughtNftV2Abi from "../contract-integration/current/thought-nft-v2.abi.json";
import thoughtRendererV2Abi from "../contract-integration/current/thought-renderer-v2.abi.json";
import verifierAbi from "../contract-integration/current/creation-attestation-verifier.abi.json";
import integrationLock from "../contract-integration/current/integration-lock.json";
import provenanceLock from "../provenance/v2/provenance-lock.json";
import creativeSpecLock from "../spec/THOUGHT.v2.lock.json";

export const THOUGHT_V2_CURRENT_ABI = thoughtNftV2Abi;
export const THOUGHT_V2_CURRENT_RENDERER_ABI = thoughtRendererV2Abi;
export const THOUGHT_V2_CURRENT_VERIFIER_ABI = verifierAbi;
export const THOUGHT_V2_CURRENT_INTEGRATION_LOCK = integrationLock;

export type ThoughtV2AnvilRuntime = {
  schema: "inshell.thought.v2.anvil-gallery-runtime.v1";
  status: "ready";
  chainId: 31337;
  rpcUrl: string;
  contracts: {
    pathNft: string;
    thoughtSpecRegistry: string;
    thoughtRenderer: string;
    protocolRegistry: string;
    creationAttestationVerifier: string;
    thoughtNft: string;
  };
  pathPulseAdapter: {
    address: string;
  };
  pulseAuction: {
    address: string;
  };
  paymentToken: {
    address: string;
  };
  provenance: {
    artifactId: string;
    authority: string;
    id: string;
    ref: string;
    schemaKeccak256: string;
    schemaSha256: string;
  };
  attestation: {
    authority: string;
    authorityEpoch: number;
    profileId: string;
    status: string;
    verifier: string;
  };
  protocolRelease: {
    id: string;
    manifestHash: string;
    manifestUri: string;
    status: string;
    manifest: {
      artifacts: Array<{
        keccak256: string;
        path: string;
        role: string;
      }>;
      identifiers: {
        contextProfile: string;
        contextProfileHash: string;
        metadataProfile: string;
        metadataProfileHash: string;
        provenance: string;
        renderer: string;
        rendererHash: string;
        workProfile: string;
        workProfileHash: string;
      };
      rendererImplementation: {
        id: string;
        releaseReady: boolean;
        usesForeignObject: boolean;
        usesNativeSvgPaths: boolean;
      };
      glyphLibrary: {
        family: string;
        faceSha256: string;
        libraryMemberId: string;
        librarySetId: string;
        manualEditPayloadSha256: string;
        packedBytes: number;
        packedKeccak256: string;
        packedSha256: string;
        releaseTag: string;
        releaseReady: boolean;
        role: string;
      };
      selectedSpec: {
        name: string;
        thoughtSpecId: string;
        thoughtSpecHash: string;
      };
    };
  };
  renderer: {
    canonicalRendererId: string;
    implementationId: string;
    releaseReady: boolean;
    externalUrlBase: string;
    glyphDataPointer: string;
    glyphDefinitionsKeccak256: string;
    glyphPackedBytes: number;
    glyphPackedKeccak256: string;
    glyphPackedSha256: string;
    glyphLibraryMemberId: string;
  };
  selectedSpec: {
    id: string;
    hash: string;
    name: string;
    ref: string;
  };
};

export type ThoughtV2RuntimeVerification = {
  compatible: boolean;
  issues: string[];
};

const nonzeroAddress = (value: string) =>
  /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);

const sameHex = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase();

export const assertThoughtV2AnvilRuntime = (value: unknown): ThoughtV2AnvilRuntime => {
  if (!value || typeof value !== "object") {
    throw new Error("THOUGHT Contract runtime descriptor is missing.");
  }
  const runtime = value as ThoughtV2AnvilRuntime;
  if (
    runtime.schema !== integrationLock.chain.runtimeDescriptorSchema ||
    runtime.status !== "ready" ||
    runtime.chainId !== integrationLock.chain.chainId
  ) {
    throw new Error("THOUGHT Contract runtime descriptor is incompatible.");
  }
  const addresses = [
    runtime.contracts?.pathNft,
    runtime.contracts?.thoughtSpecRegistry,
    runtime.contracts?.thoughtRenderer,
    runtime.contracts?.protocolRegistry,
    runtime.contracts?.creationAttestationVerifier,
    runtime.contracts?.thoughtNft,
  ];
  if (!addresses.every((address) => typeof address === "string" && nonzeroAddress(address))) {
    throw new Error("THOUGHT Contract runtime descriptor has an invalid address.");
  }
  if (
    !nonzeroAddress(runtime.pathPulseAdapter?.address) ||
    !nonzeroAddress(runtime.pulseAuction?.address) ||
    !/^0x[0-9a-f]{40}$/i.test(runtime.paymentToken?.address)
  ) {
    throw new Error("THOUGHT Contract runtime descriptor has invalid $PATH acquisition wiring.");
  }
  if (
    runtime.provenance?.artifactId !== provenanceLock.artifactId ||
    runtime.provenance?.authority !== provenanceLock.authority.owner ||
    runtime.provenance?.id !== provenanceLock.provenanceSchema ||
    !sameHex(
      runtime.provenance?.schemaKeccak256 ?? "",
      provenanceLock.artifacts.schema.keccak256,
    ) ||
    runtime.provenance?.schemaSha256 !== provenanceLock.artifacts.schema.sha256
  ) {
    throw new Error("THOUGHT Contract runtime descriptor has a stale provenance schema.");
  }
  if (
    !nonzeroAddress(runtime.renderer?.glyphDataPointer) ||
    runtime.renderer?.externalUrlBase !== "https://inshell.art/thought/" ||
    runtime.renderer?.glyphPackedBytes !== 4_600 ||
    !/^0x[0-9a-f]{64}$/i.test(runtime.renderer?.glyphPackedKeccak256 ?? "") ||
    !/^[0-9a-f]{64}$/i.test(runtime.renderer?.glyphPackedSha256 ?? "")
  ) {
    throw new Error("THOUGHT Contract runtime descriptor has invalid Mono 76 renderer data.");
  }
  return runtime;
};

export const createThoughtNftV2Contract = (
  address: string,
  runner: ContractRunner,
) => new Contract(getAddress(address), THOUGHT_V2_CURRENT_ABI, runner);

export const createThoughtV2VerifierContract = (
  address: string,
  runner: ContractRunner,
) => new Contract(getAddress(address), THOUGHT_V2_CURRENT_VERIFIER_ABI, runner);

export const createThoughtRendererV2Contract = (
  address: string,
  runner: ContractRunner,
) => new Contract(getAddress(address), THOUGHT_V2_CURRENT_RENDERER_ABI, runner);

const SPEC_REGISTRY_ABI = [
  "function validateThoughtSpec(bytes32 specId,bytes32 specHash) view returns (bool)",
  "function thoughtSpecText(bytes32 specId) view returns (string)",
] as const;

const PATH_ABI = [
  "function getAuthorizedMinter(bytes32 movement) view returns (address)",
  "function getMovementQuota(bytes32 movement) view returns (uint32)",
  "function isMovementFrozen(bytes32 movement) view returns (bool)",
] as const;

export const verifyThoughtV2CurrentRuntime = async (
  provider: Provider,
  input: ThoughtV2AnvilRuntime,
): Promise<ThoughtV2RuntimeVerification> => {
  const runtime = assertThoughtV2AnvilRuntime(input);
  const issues: string[] = [];
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(integrationLock.chain.chainId)) {
    issues.push(`chain ID ${network.chainId} does not match ${integrationLock.chain.chainId}`);
  }

  const addresses = Object.values(runtime.contracts);
  const codes = await Promise.all(addresses.map((address) => provider.getCode(address)));
  codes.forEach((code, index) => {
    if (!/^0x[0-9a-f]+$/i.test(code) || /^0x0*$/i.test(code)) {
      issues.push(`no bytecode at ${addresses[index]}`);
    }
  });

  const thought = createThoughtNftV2Contract(runtime.contracts.thoughtNft, provider);
  const verifier = createThoughtV2VerifierContract(
    runtime.contracts.creationAttestationVerifier,
    provider,
  );
  const rendererContract = createThoughtRendererV2Contract(
    runtime.contracts.thoughtRenderer,
    provider,
  );
  const registry = new Contract(
    runtime.contracts.thoughtSpecRegistry,
    SPEC_REGISTRY_ABI,
    provider,
  );
  const path = new Contract(runtime.contracts.pathNft, PATH_ABI, provider);
  const movement = encodeBytes32String("THOUGHT");

  const [
    pathNft,
    specRegistry,
    renderer,
    protocolRegistry,
    verifierAddress,
    releaseId,
    manifestHash,
    rendererId,
    rendererIdHash,
    workProfileId,
    workProfileHash,
    contextProfileId,
    contextProfileHash,
    metadataProfileId,
    metadataProfileHash,
    maxPromptBytes,
    maxAgentBytes,
    maxAgentRecordBytes,
    maxModelRecordBytes,
    maxProvenanceBytes,
    verifierProfile,
    authority,
    authorityEpoch,
    selectedSpecValid,
    selectedSpecText,
    authorizedMinter,
    movementQuota,
    movementFrozen,
    rendererImplementationId,
    rendererCanonicalId,
    rendererMetadataProfileId,
    rendererExternalUrlBase,
    glyphLibraryMemberId,
    glyphDataPointer,
    glyphDefinitionsPointer2,
    glyphDefinitionsIndexPointer,
    glyphDefinitionsKeccak256,
    glyphPackedKeccak256,
  ] = await Promise.all([
    thought.pathNft(),
    thought.thoughtSpecRegistry(),
    thought.thoughtRenderer(),
    thought.protocolRegistry(),
    thought.creationAttestationVerifier(),
    thought.protocolReleaseId(),
    thought.protocolManifestHash(),
    thought.RENDERER_ID(),
    thought.RENDERER_ID_HASH(),
    thought.WORK_PROFILE_ID(),
    thought.WORK_PROFILE_ID_HASH(),
    thought.CONTEXT_PROFILE_ID(),
    thought.CONTEXT_PROFILE_ID_HASH(),
    thought.METADATA_PROFILE_ID(),
    thought.METADATA_PROFILE_ID_HASH(),
    thought.MAX_PROMPT_LINE_BYTES(),
    thought.MAX_AGENT_LINE_BYTES(),
    thought.MAX_AGENT_RECORD_BYTES(),
    thought.MAX_MODEL_RECORD_BYTES(),
    thought.MAX_PROVENANCE_BYTES(),
    verifier.PROFILE_ID(),
    verifier.authority(),
    verifier.authorityEpoch(),
    registry.validateThoughtSpec(runtime.selectedSpec.id, runtime.selectedSpec.hash),
    registry.thoughtSpecText(runtime.selectedSpec.id),
    path.getAuthorizedMinter(movement),
    path.getMovementQuota(movement),
    path.isMovementFrozen(movement),
    rendererContract.IMPLEMENTATION_ID(),
    rendererContract.RENDERER_ID(),
    rendererContract.METADATA_PROFILE_ID(),
    rendererContract.EXTERNAL_URL_BASE(),
    rendererContract.GLYPH_LIBRARY_MEMBER_ID(),
    rendererContract.glyphDefinitionsPointer1(),
    rendererContract.glyphDefinitionsPointer2(),
    rendererContract.glyphDefinitionsIndexPointer(),
    rendererContract.glyphDefinitionsKeccak256(),
    rendererContract.GLYPH_PACKED_KECCAK256(),
  ]);

  const checkHex = (label: string, actual: string, expected: string) => {
    if (!sameHex(actual, expected)) issues.push(`${label} mismatch`);
  };
  const checkAddress = (label: string, actual: string, expected: string) =>
    checkHex(label, getAddress(actual), getAddress(expected));
  const lockedRelease = integrationLock.runtimeBaseline.protocolRelease;
  const lockedRenderer = integrationLock.renderer.profile;

  checkAddress("PATH dependency", pathNft, runtime.contracts.pathNft);
  checkAddress("spec registry", specRegistry, runtime.contracts.thoughtSpecRegistry);
  checkAddress("renderer", renderer, runtime.contracts.thoughtRenderer);
  checkAddress("protocol registry", protocolRegistry, runtime.contracts.protocolRegistry);
  checkAddress("verifier", verifierAddress, runtime.contracts.creationAttestationVerifier);
  checkAddress("PATH authorized minter", authorizedMinter, runtime.contracts.thoughtNft);
  checkHex("protocol release", releaseId, runtime.protocolRelease.id);
  checkHex("protocol manifest", manifestHash, runtime.protocolRelease.manifestHash);
  checkHex("renderer profile", rendererIdHash, runtime.protocolRelease.manifest.identifiers.rendererHash);
  checkHex("work profile", workProfileHash, runtime.protocolRelease.manifest.identifiers.workProfileHash);
  checkHex("context profile", contextProfileHash, runtime.protocolRelease.manifest.identifiers.contextProfileHash);
  checkHex("metadata profile", metadataProfileHash, runtime.protocolRelease.manifest.identifiers.metadataProfileHash);
  checkHex("attestation profile", verifierProfile, runtime.attestation.profileId);
  checkAddress("attestation authority", authority, runtime.attestation.authority);
  checkHex(
    "vendored renderer profile",
    runtime.protocolRelease.manifest.identifiers.rendererHash,
    lockedRelease.rendererProfileHash,
  );
  checkHex(
    "vendored work profile",
    runtime.protocolRelease.manifest.identifiers.workProfileHash,
    lockedRelease.workProfileHash,
  );
  checkHex(
    "vendored context profile",
    runtime.protocolRelease.manifest.identifiers.contextProfileHash,
    lockedRelease.contextProfileHash,
  );
  checkHex(
    "vendored metadata profile",
    runtime.protocolRelease.manifest.identifiers.metadataProfileHash,
    lockedRelease.metadataProfileHash,
  );
  checkHex(
    "vendored attestation profile",
    runtime.attestation.profileId,
    lockedRelease.creationAttestationProfileHash,
  );
  checkHex(
    "App creative spec ID",
    runtime.selectedSpec.id,
    creativeSpecLock.artifact.thoughtSpecId,
  );
  checkHex(
    "App creative spec hash",
    runtime.selectedSpec.hash,
    creativeSpecLock.artifact.thoughtSpecHash,
  );
  if (runtime.selectedSpec.name !== creativeSpecLock.artifact.name) {
    issues.push("App creative spec name mismatch");
  }
  const provenanceArtifact = runtime.protocolRelease.manifest.artifacts.find(
    ({ role }) => role === "provenance-schema",
  );
  if (
    runtime.protocolRelease.manifest.identifiers.provenance !==
      provenanceLock.provenanceSchema ||
    provenanceArtifact?.path !== runtime.provenance.ref ||
    !sameHex(
      provenanceArtifact?.keccak256 ?? "",
      provenanceLock.artifacts.schema.keccak256,
    )
  ) {
    issues.push("App provenance schema binding mismatch");
  }
  if (
    runtime.renderer.implementationId !== lockedRelease.rendererImplementationId ||
    runtime.protocolRelease.manifest.rendererImplementation.id !==
      lockedRelease.rendererImplementationId
  ) {
    issues.push("vendored renderer implementation mismatch");
  }
  if (
    rendererImplementationId !== lockedRenderer.implementationId ||
    rendererCanonicalId !== lockedRenderer.id ||
    rendererMetadataProfileId !==
      runtime.protocolRelease.manifest.identifiers.metadataProfile ||
    glyphLibraryMemberId !== lockedRenderer.glyphLibraryMemberId ||
    glyphLibraryMemberId !==
      runtime.protocolRelease.manifest.glyphLibrary.libraryMemberId
  ) {
    issues.push("renderer identity or glyph library mismatch");
  }
  if (
    rendererExternalUrlBase !== lockedRenderer.externalUrlBase ||
    rendererExternalUrlBase !== runtime.renderer.externalUrlBase
  ) {
    issues.push("renderer external URL base mismatch");
  }
  checkAddress(
    "packed glyph data pointer",
    glyphDataPointer,
    runtime.renderer.glyphDataPointer,
  );
  if (glyphDefinitionsPointer2 !== ZeroAddress) {
    issues.push("legacy glyph definitions pointer 2 is not empty");
  }
  if (glyphDefinitionsIndexPointer !== ZeroAddress) {
    issues.push("legacy glyph definitions index pointer is not empty");
  }
  checkHex(
    "packed glyph definitions",
    glyphDefinitionsKeccak256,
    lockedRenderer.glyphPackedKeccak256,
  );
  checkHex(
    "renderer packed glyph constant",
    glyphPackedKeccak256,
    lockedRenderer.glyphPackedKeccak256,
  );
  checkHex(
    "runtime packed glyph hash",
    runtime.renderer.glyphPackedKeccak256,
    lockedRenderer.glyphPackedKeccak256,
  );
  if (
    runtime.renderer.glyphPackedBytes !== lockedRenderer.glyphPackedBytes ||
    runtime.renderer.glyphPackedSha256 !== lockedRenderer.glyphPackedSha256
  ) {
    issues.push("runtime packed glyph payload mismatch");
  }
  const glyphPointerCode = await provider.getCode(glyphDataPointer);
  if (!/^0x[0-9a-f]+$/i.test(glyphPointerCode) || /^0x0*$/i.test(glyphPointerCode)) {
    issues.push("no bytecode at packed renderer glyph pointer");
  }

  if (rendererId !== runtime.renderer.canonicalRendererId) issues.push("renderer ID mismatch");
  if (workProfileId !== runtime.protocolRelease.manifest.identifiers.workProfile) {
    issues.push("work profile ID mismatch");
  }
  if (contextProfileId !== runtime.protocolRelease.manifest.identifiers.contextProfile) {
    issues.push("context profile ID mismatch");
  }
  if (metadataProfileId !== runtime.protocolRelease.manifest.identifiers.metadataProfile) {
    issues.push("metadata profile ID mismatch");
  }
  if (
    maxPromptBytes !== 64n ||
    maxAgentBytes !== 64n ||
    maxAgentRecordBytes !== 64n ||
    maxModelRecordBytes !== 64n ||
    maxProvenanceBytes !== 20_000n
  ) {
    issues.push("Contract limits mismatch");
  }
  if (BigInt(authorityEpoch) !== BigInt(runtime.attestation.authorityEpoch)) {
    issues.push("attestation authority epoch mismatch");
  }
  if (!selectedSpecValid || keccak256(toUtf8Bytes(selectedSpecText)) !== runtime.selectedSpec.hash) {
    issues.push("selected spec readback mismatch");
  }
  if (movementQuota !== 1n || !movementFrozen) {
    issues.push("PATH THOUGHT movement configuration mismatch");
  }
  if (
    !runtime.renderer.releaseReady ||
    !runtime.protocolRelease.manifest.rendererImplementation.releaseReady ||
    !runtime.protocolRelease.manifest.glyphLibrary.releaseReady ||
    !lockedRenderer.rendererReleaseReady ||
    runtime.protocolRelease.manifest.rendererImplementation.usesForeignObject ||
    !runtime.protocolRelease.manifest.rendererImplementation.usesNativeSvgPaths
  ) {
    issues.push("native-path renderer release-ready facts mismatch");
  }

  return { compatible: issues.length === 0, issues };
};
