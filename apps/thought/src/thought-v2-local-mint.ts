import {
  assertThoughtLine,
  canonicalJsonStringify,
  thoughtWorkHashes,
  type CanonicalJson,
} from "@inshell/shared";
import { keccak256, toUtf8Bytes } from "ethers";

import {
  THOUGHT_V2_LOCAL_RELEASE,
  type ThoughtV2ProtocolBinding,
} from "./thought-v2-local-release";

export const THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES = 20_000;

export const THOUGHT_V2_LOCAL_NFT_ABI = [
  "error AgentLineAlreadyMinted(bytes32 agentIdentityHash, uint256 tokenId)",
  "error DisplayLineEmpty(uint8 kind)",
  "error DisplayLineTooLarge(uint8 kind, uint256 actual, uint256 max)",
  "error EmptyProvenance()",
  "error InvalidProtocolRelease(bytes32 protocolReleaseId)",
  "error InvalidThoughtSpecPair(bytes32 thoughtSpecId, bytes32 thoughtSpecHash)",
  "error ProvenanceTooLarge(uint256 size, uint256 max)",
  "function mint((string promptLine,string agentLine,uint256 pathId,bytes32 thoughtSpecId,bytes32 thoughtSpecHash,string provenanceJson,uint256 deadline,bytes pathSignature) input) returns (uint256 tokenId)",
  "function tokenOfAgentLineHash(bytes32 agentLineHash) view returns (uint256 tokenId)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function svgOf(uint256 tokenId) view returns (string)",
  "function promptLineOf(uint256 tokenId) view returns (string)",
  "function agentLineOf(uint256 tokenId) view returns (string)",
  "function provenanceOf(uint256 tokenId) view returns (string)",
  "function promptLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function agentLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function provenanceHashOf(uint256 tokenId) view returns (bytes32)",
  "function pathIdOf(uint256 tokenId) view returns (uint256)",
  "function mintedAtOf(uint256 tokenId) view returns (uint64)",
  "function thoughtSpecOf(uint256 tokenId) view returns (bytes32 specId, bytes32 specHash, string specName, string ref)",
  "function authorOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)",
  "function pathNft() view returns (address)",
  "function thoughtSpecRegistry() view returns (address)",
  "function thoughtRenderer() view returns (address)",
  "function protocolRegistry() view returns (address)",
  "function protocolReleaseId() view returns (bytes32)",
  "function protocolManifestHash() view returns (bytes32)",
  "function RENDERER_PROFILE_KECCAK256() view returns (bytes32)",
  "function WORK_PROFILE_KECCAK256() view returns (bytes32)",
  "function previewSvg(string promptLine,string agentLine) view returns (string)",
  "event ThoughtMinted(uint256 indexed tokenId,address indexed minter,bytes32 indexed workHash,bytes32 promptLineHash,bytes32 agentLineHash,bytes32 agentIdentityHash,bytes32 binaryFieldKeccak256,uint256 pathId,uint256 pathSerial,bytes32 thoughtSpecId,bytes32 thoughtSpecHash)",
] as const;

export type ThoughtV2LocalProcess =
  | { kind: "manual" }
  | {
      kind: "agent-run";
      agentDeclaration: {
        schema: "inshell.thought.agent-declaration.v1";
        status: "declared-unverified";
        agentLabel: string;
        declaredOneCreativeResult: true;
      };
      transport?: {
        adapter?: string;
        runId?: string;
        rawResponseSha256?: string;
      };
    };

export type ThoughtV2LocalProvenanceInput = {
  protocol?: ThoughtV2ProtocolBinding;
  promptLine: string;
  agentLine: string;
  process: ThoughtV2LocalProcess;
  mintContext: {
    chainId: string;
    thoughtNft: string;
    pathNft: string;
    minter: string;
    movement: "THOUGHT";
    pathId: string;
  };
};

const lowerAddress = (value: string, label: string) => {
  const normalized = value.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`${label} is not an address`);
  }
  return normalized;
};

export const thoughtV2AgentLineHash = (agentLine: string) => {
  assertThoughtLine(agentLine, "agent");
  return keccak256(toUtf8Bytes(agentLine));
};

export const buildThoughtV2LocalProvenance = (input: ThoughtV2LocalProvenanceInput) => {
  assertThoughtLine(input.promptLine, "prompt");
  assertThoughtLine(input.agentLine, "agent");
  const work = thoughtWorkHashes(input.promptLine, input.agentLine);
  const serialized = canonicalJsonStringify({
    schema: "inshell.thought.provenance.v2",
    protocol: input.protocol ?? THOUGHT_V2_LOCAL_RELEASE.protocol,
    work: {
      promptLine: input.promptLine,
      agentLine: input.agentLine,
      ...work,
    },
    process: input.process,
    mintContext: {
      chainId: input.mintContext.chainId,
      thoughtNft: lowerAddress(input.mintContext.thoughtNft, "thoughtNft"),
      pathNft: lowerAddress(input.mintContext.pathNft, "pathNft"),
      minter: lowerAddress(input.mintContext.minter, "minter"),
      movement: "THOUGHT",
      pathId: input.mintContext.pathId,
    },
  } as unknown as CanonicalJson);
  const size = toUtf8Bytes(serialized).length;
  if (size > THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES) {
    throw new Error(`provenance is ${size}/${THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES} bytes`);
  }
  return serialized;
};
