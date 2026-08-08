#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  THOUGHT_V2_PROVENANCE_RELEASE,
  THOUGHT_V2_PROVENANCE_SCHEMA,
  verifyThoughtV2Provenance,
  type ThoughtV2ProvenanceIssue,
} from "../apps/thought/src/thought-v2-provenance";
import { validateJsonSchemaValue } from "./lib/thought-metadata-namespace.mjs";
import {
  canonicalThoughtExternalUrl,
  verifyThoughtMarketplaceTraits,
} from "./lib/thought-metadata-portability.mjs";

const require = createRequire(import.meta.url);
const ethersEntry = require.resolve("ethers", {
  paths: [fileURLToPath(new URL("../apps/thought", import.meta.url))],
});
const { Contract, JsonRpcProvider, getAddress, toUtf8Bytes } = await import(ethersEntry);

type ThoughtVerifierProvider = {
  destroy: () => Promise<void>;
  getCode: (address: string) => Promise<string>;
  getNetwork: () => Promise<{ chainId: bigint }>;
};

type JsonObject = Record<string, unknown>;

const METADATA_NAMESPACE_RELEASE = "thought-metadata-namespace-v2-20260731-r1" as const;
const METADATA_NAMESPACE_SCHEMA = "https://inshell.art/protocol/releases/thought-metadata-namespace-v2-20260731-r1/thought.metadata-namespace.v2.schema.json" as const;
const metadataNamespaceSchema = JSON.parse(readFileSync(
  fileURLToPath(new URL(
    "../apps/thought/metadata/v2/thought.metadata-namespace.v2.schema.json",
    import.meta.url,
  )),
  "utf8",
)) as JsonObject;

const ZERO_BYTES32 = `0x${"00".repeat(32)}`;
const THOUGHT_ABI = [
  "function CONTEXT_PROFILE_ID() view returns (string)",
  "function CREATION_ATTESTATION_PROFILE_ID() view returns (bytes32)",
  "function METADATA_PROFILE_ID() view returns (string)",
  "function METADATA_PROFILE_ID_HASH() view returns (bytes32)",
  "function RENDERER_ID() view returns (string)",
  "function RENDERER_ID_HASH() view returns (bytes32)",
  "function WORK_PROFILE_ID() view returns (string)",
  "function agentHashOf(uint256 tokenId) view returns (bytes32)",
  "function agentLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function agentLineOf(uint256 tokenId) view returns (string)",
  "function agentOf(uint256 tokenId) view returns (string)",
  "function authorOf(uint256 tokenId) view returns (address)",
  "function conversationIdentityHashOf(uint256 tokenId) view returns (bytes32)",
  "function creationAttestationDigestOf(uint256 tokenId) view returns (bytes32)",
  "function creationAttestationVerifier() view returns (address)",
  "function mintedAtOf(uint256 tokenId) view returns (uint64)",
  "function modelHashOf(uint256 tokenId) view returns (bytes32)",
  "function modelOf(uint256 tokenId) view returns (string)",
  "function pathIdOf(uint256 tokenId) view returns (uint256)",
  "function pathSerialOf(uint256 tokenId) view returns (uint256)",
  "function promptLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function promptLineOf(uint256 tokenId) view returns (string)",
  "function protocolManifestHash() view returns (bytes32)",
  "function protocolReleaseId() view returns (bytes32)",
  "function provenanceHashOf(uint256 tokenId) view returns (bytes32)",
  "function provenanceOf(uint256 tokenId) view returns (string)",
  "function thoughtRenderer() view returns (address)",
  "function thoughtSpecOf(uint256 tokenId) view returns (bytes32 specId, bytes32 specHash, string specName, string specRef)",
  "function thoughtSpecRegistry() view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function workHashOf(uint256 tokenId) view returns (bytes32)",
] as const;
const SPEC_REGISTRY_ABI = [
  "function thoughtSpecText(bytes32 specId) view returns (string)",
] as const;
const RENDERER_ABI = [
  "function IMPLEMENTATION_ID() view returns (string)",
] as const;

export type ThoughtProvenanceVerifierInput = {
  chainId: bigint;
  contract: string;
  provider: ThoughtVerifierProvider;
  tokenId: bigint;
};

export type ThoughtProvenanceVerifierCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export type ThoughtProvenanceVerifierReport = {
  schema: "inshell.thought.verification.v2";
  verifier: {
    provenanceRelease: typeof THOUGHT_V2_PROVENANCE_RELEASE;
    provenanceSchema: typeof THOUGHT_V2_PROVENANCE_SCHEMA;
    metadataNamespaceRelease: typeof METADATA_NAMESPACE_RELEASE;
    metadataNamespaceSchema: typeof METADATA_NAMESPACE_SCHEMA;
  };
  target: {
    chainId: string;
    contract: string;
    tokenId: string;
  };
  conforming: boolean;
  portable: boolean;
  portabilityIssues: string[];
  provenanceHash: string | null;
  creationAttestation: {
    digest: string | null;
    status: "contract-verified" | "unattested" | "unavailable";
  };
  checks: ThoughtProvenanceVerifierCheck[];
  issues: ThoughtV2ProvenanceIssue[];
};

const lowerHex = (value: unknown) => String(value).toLowerCase();
const decimal = (value: unknown) => BigInt(String(value)).toString(10);
const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const decodeTokenUri = (tokenUri: string): JsonObject => {
  const prefix = "data:application/json;base64,";
  if (!tokenUri.startsWith(prefix)) {
    throw new Error("tokenURI() must return base64-encoded application/json");
  }
  const parsed = JSON.parse(Buffer.from(tokenUri.slice(prefix.length), "base64").toString("utf8"));
  if (!isObject(parsed)) throw new Error("tokenURI() metadata must be a JSON object");
  return parsed;
};

const addEqualityCheck = (
  checks: ThoughtProvenanceVerifierCheck[],
  id: string,
  actual: unknown,
  expected: unknown,
  label: string,
) => {
  const ok = actual === expected;
  checks.push({
    id,
    ok,
    detail: ok ? `${label} matches typed chain state` : `${label} mismatch`,
  });
};

const failedReport = (
  input: ThoughtProvenanceVerifierInput,
  contract: string,
  checks: ThoughtProvenanceVerifierCheck[],
  message: string,
): ThoughtProvenanceVerifierReport => ({
  schema: "inshell.thought.verification.v2",
  verifier: {
    provenanceRelease: THOUGHT_V2_PROVENANCE_RELEASE,
    provenanceSchema: THOUGHT_V2_PROVENANCE_SCHEMA,
    metadataNamespaceRelease: METADATA_NAMESPACE_RELEASE,
    metadataNamespaceSchema: METADATA_NAMESPACE_SCHEMA,
  },
  target: {
    chainId: input.chainId.toString(),
    contract,
    tokenId: input.tokenId.toString(),
  },
  conforming: false,
  portable: false,
  portabilityIssues: [message],
  provenanceHash: null,
  creationAttestation: { digest: null, status: "unavailable" },
  checks,
  issues: [{ code: "chain.read", path: "target", message }],
});

export async function verifyThoughtTokenProvenance(
  input: ThoughtProvenanceVerifierInput,
): Promise<ThoughtProvenanceVerifierReport> {
  const checks: ThoughtProvenanceVerifierCheck[] = [];
  const portabilityIssues: string[] = [];
  let contractAddress: string;
  try {
    contractAddress = getAddress(input.contract).toLowerCase();
  } catch {
    return failedReport(input, input.contract, checks, "contract must be a valid EVM address");
  }

  try {
    const network = await input.provider.getNetwork();
    const chainMatches = network.chainId === input.chainId;
    checks.push({
      id: "rpc-chain",
      ok: chainMatches,
      detail: chainMatches
        ? `RPC reports chain ${input.chainId}`
        : `RPC reports chain ${network.chainId}; expected ${input.chainId}`,
    });
    if (!chainMatches) {
      return failedReport(input, contractAddress, checks, "RPC chain ID does not match --chain-id");
    }

    const code = await input.provider.getCode(contractAddress);
    const hasCode = code !== "0x";
    checks.push({
      id: "contract-code",
      ok: hasCode,
      detail: hasCode ? "contract bytecode found" : "no contract bytecode found",
    });
    if (!hasCode) {
      return failedReport(input, contractAddress, checks, "no THOUGHT contract code at target");
    }

    const thought = new Contract(contractAddress, THOUGHT_ABI, input.provider);
    const [
      promptLine,
      agentLine,
      promptLineHash,
      agentLineHash,
      agent,
      agentHash,
      model,
      modelHash,
      intendedMinter,
      mintedAt,
      pathId,
      pathSerial,
      conversationIdentityHash,
      workHash,
      provenanceJson,
      storedProvenanceHash,
      protocolReleaseId,
      manifestKeccak256,
      thoughtSpec,
      specRegistryAddress,
      attestationDigest,
      attestationVerifier,
      attestationProfileId,
      metadataProfileId,
      metadataProfileIdHash,
      workProfileId,
      rendererId,
      rendererIdHash,
      rendererAddress,
      tokenUri,
    ] = await Promise.all([
      thought.promptLineOf(input.tokenId),
      thought.agentLineOf(input.tokenId),
      thought.promptLineHashOf(input.tokenId),
      thought.agentLineHashOf(input.tokenId),
      thought.agentOf(input.tokenId),
      thought.agentHashOf(input.tokenId),
      thought.modelOf(input.tokenId),
      thought.modelHashOf(input.tokenId),
      thought.authorOf(input.tokenId),
      thought.mintedAtOf(input.tokenId),
      thought.pathIdOf(input.tokenId),
      thought.pathSerialOf(input.tokenId),
      thought.conversationIdentityHashOf(input.tokenId),
      thought.workHashOf(input.tokenId),
      thought.provenanceOf(input.tokenId),
      thought.provenanceHashOf(input.tokenId),
      thought.protocolReleaseId(),
      thought.protocolManifestHash(),
      thought.thoughtSpecOf(input.tokenId),
      thought.thoughtSpecRegistry(),
      thought.creationAttestationDigestOf(input.tokenId),
      thought.creationAttestationVerifier(),
      thought.CREATION_ATTESTATION_PROFILE_ID(),
      thought.METADATA_PROFILE_ID(),
      thought.METADATA_PROFILE_ID_HASH(),
      thought.WORK_PROFILE_ID(),
      thought.RENDERER_ID(),
      thought.RENDERER_ID_HASH(),
      thought.thoughtRenderer(),
      thought.tokenURI(input.tokenId),
    ]);

    const specRegistry = getAddress(String(specRegistryAddress)).toLowerCase();
    const registryCode = await input.provider.getCode(specRegistry);
    const hasRegistryCode = registryCode !== "0x";
    checks.push({
      id: "spec-registry-code",
      ok: hasRegistryCode,
      detail: hasRegistryCode ? "spec registry bytecode found" : "spec registry bytecode missing",
    });
    if (!hasRegistryCode) {
      return failedReport(input, contractAddress, checks, "THOUGHT spec registry is unavailable");
    }
    const registry = new Contract(specRegistry, SPEC_REGISTRY_ABI, input.provider);
    const selectedSpecText = String(await registry.thoughtSpecText(thoughtSpec.specId));
    const renderer = getAddress(String(rendererAddress)).toLowerCase();
    const rendererCode = await input.provider.getCode(renderer);
    checks.push({
      id: "renderer-code",
      ok: rendererCode !== "0x",
      detail: rendererCode !== "0x" ? "renderer bytecode found" : "renderer bytecode missing",
    });
    if (rendererCode === "0x") {
      return failedReport(input, contractAddress, checks, "THOUGHT renderer is unavailable");
    }
    const rendererContract = new Contract(renderer, RENDERER_ABI, input.provider);
    const rendererImplementationId = String(await rendererContract.IMPLEMENTATION_ID());

    const metadata = decodeTokenUri(String(tokenUri));
    const namespace = metadata.thought;
    if (!isObject(namespace)) throw new Error("tokenURI() metadata.thought is missing");
    try {
      validateJsonSchemaValue(namespace, metadataNamespaceSchema);
      checks.push({
        id: "metadata-namespace-schema",
        ok: true,
        detail: "metadata.thought conforms to the locked local V2 schema",
      });
    } catch (error) {
      checks.push({
        id: "metadata-namespace-schema",
        ok: false,
        detail: error instanceof Error ? error.message : "metadata.thought schema mismatch",
      });
    }

    const digest = lowerHex(attestationDigest);
    const attestationStatus = digest === ZERO_BYTES32
      ? "unattested" as const
      : "contract-verified" as const;
    const expectedMetadataAttestation = attestationStatus === "contract-verified"
      ? "Inshell THOUGHT App"
      : "Unattested";

    const expectedValues: Array<[string, unknown, unknown, string]> = [
      ["metadata-prompt", namespace.promptLine, String(promptLine), "promptLine"],
      ["metadata-agent-line", namespace.agentLine, String(agentLine), "agentLine"],
      ["metadata-prompt-hash", namespace.promptLineKeccak256, lowerHex(promptLineHash), "promptLineKeccak256"],
      ["metadata-agent-line-hash", namespace.agentLineKeccak256, lowerHex(agentLineHash), "agentLineKeccak256"],
      ["metadata-conversation-hash", namespace.conversationIdentityHash, lowerHex(conversationIdentityHash), "conversationIdentityHash"],
      ["metadata-work-hash", namespace.workHash, lowerHex(workHash), "workHash"],
      ["metadata-work-precheck", namespace.workHashPrecheck, lowerHex(workHash), "workHashPrecheck"],
      ["metadata-provenance", namespace.provenanceJson, String(provenanceJson), "provenanceJson"],
      ["metadata-provenance-hash", namespace.provenanceHash, lowerHex(storedProvenanceHash), "provenanceHash"],
      ["metadata-provenance-check", namespace.provenanceCommitmentCheck, lowerHex(storedProvenanceHash), "provenanceCommitmentCheck"],
      ["metadata-agent-record", (namespace.records as JsonObject)?.agent && ((namespace.records as JsonObject).agent as JsonObject).label, String(agent), "records.agent.label"],
      ["metadata-agent-record-hash", (namespace.records as JsonObject)?.agent && ((namespace.records as JsonObject).agent as JsonObject).keccak256, lowerHex(agentHash), "records.agent.keccak256"],
      ["metadata-model-record", (namespace.records as JsonObject)?.model && ((namespace.records as JsonObject).model as JsonObject).label, String(model), "records.model.label"],
      ["metadata-model-record-hash", (namespace.records as JsonObject)?.model && ((namespace.records as JsonObject).model as JsonObject).keccak256, lowerHex(modelHash), "records.model.keccak256"],
      ["metadata-record-identity", (namespace.records as JsonObject)?.workIdentityInput, false, "records.workIdentityInput"],
      ["metadata-mint-chain", (namespace.mint as JsonObject)?.chainId, input.chainId.toString(), "mint.chainId"],
      ["metadata-mint-contract", (namespace.mint as JsonObject)?.contract, contractAddress, "mint.contract"],
      ["metadata-mint-token", (namespace.mint as JsonObject)?.tokenId, input.tokenId.toString(), "mint.tokenId"],
      ["metadata-mint-minter", (namespace.mint as JsonObject)?.minter, lowerHex(intendedMinter), "mint.minter"],
      ["metadata-minted-at", (namespace.mint as JsonObject)?.mintedAt, decimal(mintedAt), "mint.mintedAt"],
      ["metadata-path-id", (namespace.mint as JsonObject)?.pathId, decimal(pathId), "mint.pathId"],
      ["metadata-path-serial", (namespace.mint as JsonObject)?.pathSerial, decimal(pathSerial), "mint.pathSerial"],
      ["metadata-protocol-release", (namespace.protocol as JsonObject)?.protocolReleaseId, lowerHex(protocolReleaseId), "protocol.protocolReleaseId"],
      ["metadata-protocol-manifest", (namespace.protocol as JsonObject)?.manifestKeccak256, lowerHex(manifestKeccak256), "protocol.manifestKeccak256"],
      ["metadata-spec-id", (namespace.protocol as JsonObject)?.thoughtSpecId, lowerHex(thoughtSpec.specId), "protocol.thoughtSpecId"],
      ["metadata-spec-hash", (namespace.protocol as JsonObject)?.thoughtSpecHash, lowerHex(thoughtSpec.specHash), "protocol.thoughtSpecHash"],
      ["metadata-profile", namespace.metadataProfileId, String(metadataProfileId), "metadataProfileId"],
      ["metadata-profile-hash", namespace.metadataProfileIdHash, lowerHex(metadataProfileIdHash), "metadataProfileIdHash"],
      ["metadata-work-profile", namespace.workProfileId, String(workProfileId), "workProfileId"],
      ["metadata-renderer", namespace.rendererId, String(rendererId), "rendererId"],
      ["metadata-renderer-hash", namespace.rendererIdHash, lowerHex(rendererIdHash), "rendererIdHash"],
      ["metadata-renderer-implementation", namespace.rendererImplementationId, rendererImplementationId, "rendererImplementationId"],
      ["metadata-attestation-digest", (namespace.creationAttestation as JsonObject)?.digest, digest, "creationAttestation.digest"],
      ["metadata-attestation-profile", (namespace.creationAttestation as JsonObject)?.profileId, lowerHex(attestationProfileId), "creationAttestation.profileId"],
      ["metadata-attestation-status", (namespace.creationAttestation as JsonObject)?.status, expectedMetadataAttestation, "creationAttestation.status"],
      ["metadata-attestation-verifier", (namespace.creationAttestation as JsonObject)?.verifier, lowerHex(attestationVerifier), "creationAttestation.verifier"],
    ];
    for (const [id, actual, expected, label] of expectedValues) {
      addEqualityCheck(checks, id, actual, expected, label);
    }

    const expectedExternalUrl = canonicalThoughtExternalUrl(input.tokenId);
    const externalUrlMatches = metadata.external_url === expectedExternalUrl;
    checks.push({
      id: "external-url",
      ok: externalUrlMatches,
      detail: externalUrlMatches
        ? `external_url is ${expectedExternalUrl}`
        : `external_url must be ${expectedExternalUrl}`,
    });
    if (!externalUrlMatches) portabilityIssues.push(`external_url must be ${expectedExternalUrl}`);

    try {
      verifyThoughtMarketplaceTraits(metadata.attributes, input.tokenId);
      checks.push({
        id: "marketplace-traits",
        ok: true,
        detail: "marketplace traits match the portable five-trait profile",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "marketplace traits are not portable";
      portabilityIssues.push(message);
      checks.push({ id: "marketplace-traits", ok: false, detail: message });
    }

    const exactBytes = toUtf8Bytes(String(provenanceJson));
    const verification = verifyThoughtV2Provenance(
      exactBytes,
      {
        agent: String(agent),
        agentLine: String(agentLine),
        chainId: input.chainId.toString(),
        intendedMinter: lowerHex(intendedMinter) as `0x${string}`,
        manifestKeccak256: lowerHex(manifestKeccak256) as `0x${string}`,
        model: String(model),
        promptLine: String(promptLine),
        protocolReleaseId: lowerHex(protocolReleaseId) as `0x${string}`,
        provenanceHash: lowerHex(storedProvenanceHash) as `0x${string}`,
        thoughtNft: contractAddress as `0x${string}`,
        thoughtSpecHash: lowerHex(thoughtSpec.specHash) as `0x${string}`,
        thoughtSpecId: lowerHex(thoughtSpec.specId) as `0x${string}`,
        workHash: lowerHex(workHash) as `0x${string}`,
      },
      {
        exactSpecBytes: toUtf8Bytes(selectedSpecText),
        specName: String(thoughtSpec.specName),
      },
    );

    checks.push(
      {
        id: "provenance-hash",
        ok: verification.provenanceHash === lowerHex(storedProvenanceHash),
        detail: "exact provenance bytes match the contract provenance hash",
      },
      {
        id: "provenance-v2",
        ok: verification.conforming,
        detail: verification.conforming
          ? "provenance is canonical and matches typed token state"
          : "provenance verification reported issues",
      },
      {
        id: "selected-spec",
        ok: selectedSpecText.length > 0,
        detail: selectedSpecText.length > 0
          ? `selected spec bytes loaded as ${String(thoughtSpec.specName)}`
          : "selected spec bytes are empty",
      },
      {
        id: "creation-attestation",
        ok: true,
        detail: attestationStatus === "contract-verified"
          ? "the THOUGHT Contract accepted a Creation Attestation at mint"
          : "the token was minted through the permitted unattested path",
      },
    );

    const integrityChecks = checks.filter(({ id }) => id !== "marketplace-traits");
    const conforming = verification.conforming && integrityChecks.every(({ ok }) => ok);
    return {
      schema: "inshell.thought.verification.v2",
      verifier: {
        provenanceRelease: THOUGHT_V2_PROVENANCE_RELEASE,
        provenanceSchema: THOUGHT_V2_PROVENANCE_SCHEMA,
        metadataNamespaceRelease: METADATA_NAMESPACE_RELEASE,
        metadataNamespaceSchema: METADATA_NAMESPACE_SCHEMA,
      },
      target: {
        chainId: input.chainId.toString(),
        contract: contractAddress,
        tokenId: input.tokenId.toString(),
      },
      conforming,
      portable: conforming && portabilityIssues.length === 0,
      portabilityIssues,
      provenanceHash: verification.provenanceHash,
      creationAttestation: {
        digest,
        status: attestationStatus,
      },
      checks,
      issues: verification.issues,
    };
  } catch (error) {
    return failedReport(
      input,
      contractAddress,
      checks,
      error instanceof Error ? error.message : "THOUGHT token verification failed",
    );
  }
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
  console.error(
    "use: pnpm verify:thought -- --rpc-url <url> --chain-id <id> --contract <address> --token-id <id>",
  );
  process.exit(2);
}

async function main() {
  if (process.argv.includes("--help")) usage();
  const rpcUrl = flag("--rpc-url") ?? process.env.THOUGHT_RPC_URL;
  const chainIdText = flag("--chain-id");
  const contract = flag("--contract");
  const tokenIdText = flag("--token-id");
  if (!rpcUrl || !chainIdText || !contract || !tokenIdText) usage();

  let chainId: bigint;
  let tokenId: bigint;
  try {
    chainId = BigInt(chainIdText);
    tokenId = BigInt(tokenIdText);
    if (chainId <= 0n || tokenId <= 0n) usage();
  } catch {
    usage();
  }

  const provider = new JsonRpcProvider(rpcUrl, chainId);
  try {
    const report = await verifyThoughtTokenProvenance({
      chainId,
      contract,
      provider,
      tokenId,
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.conforming) process.exitCode = 1;
  } finally {
    await provider.destroy();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
