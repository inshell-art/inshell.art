import { keccak256, toUtf8Bytes } from "ethers";
import {
  assertThoughtV2TerminalLine as assertThoughtV2Line,
  measureThoughtV2TerminalLine,
  thoughtV2TerminalConversationIdentityHashForLines as thoughtV2ConversationIdentityHashForLines,
} from "@inshell/shared";

import {
  buildVerifiedCanonicalThoughtV2Provenance,
  THOUGHT_V2_MAX_PROVENANCE_BYTES,
  type ThoughtV2ProcessEvidence,
} from "./thought-v2-provenance";
import {
  THOUGHT_V2_CURRENT_ABI,
  THOUGHT_V2_CURRENT_RENDERER_ABI,
} from "./thought-v2-contract-client";
import { THOUGHT_V2_LOCAL_RELEASE } from "./thought-v2-local-release";

export const THOUGHT_V2_LOCAL_MAX_PROVENANCE_BYTES = THOUGHT_V2_MAX_PROVENANCE_BYTES;

export const THOUGHT_V2_LOCAL_NFT_ABI = THOUGHT_V2_CURRENT_ABI;

export const THOUGHT_V2_LOCAL_RENDERER_ABI = THOUGHT_V2_CURRENT_RENDERER_ABI;

export type ThoughtV2LocalProcess = ThoughtV2ProcessEvidence;

export type ThoughtV2LocalProvenanceInput = {
  promptLine: string;
  agentLine: string;
  process: ThoughtV2LocalProcess;
  mintContext: {
    chainId: string;
    thoughtNft: string;
    intendedMinter: string;
  };
  selectedSpec: {
    name: string;
    text: string;
  };
};

const lowerAddress = (value: string, label: string): `0x${string}` => {
  const normalized = value.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized) || /^0x0{40}$/.test(normalized)) {
    throw new Error(`${label} is not a nonzero address`);
  }
  return normalized as `0x${string}`;
};

export const thoughtV2AgentLineHash = (agentLine: string) => {
  assertThoughtV2Line(agentLine, "agent");
  return keccak256(toUtf8Bytes(agentLine));
};

export {
  assertThoughtV2Line,
  measureThoughtV2TerminalLine,
  thoughtV2ConversationIdentityHashForLines,
};

export const buildThoughtV2LocalProvenance = (input: ThoughtV2LocalProvenanceInput) =>
  buildVerifiedCanonicalThoughtV2Provenance({
    promptLine: input.promptLine,
    agentLine: input.agentLine,
    process: input.process,
    mintContext: {
      chainId: input.mintContext.chainId,
      thoughtNft: lowerAddress(input.mintContext.thoughtNft, "thoughtNft"),
      intendedMinter: lowerAddress(input.mintContext.intendedMinter, "intendedMinter"),
    },
    protocol: {
      manifestKeccak256: THOUGHT_V2_LOCAL_RELEASE.protocol.manifestKeccak256,
      protocolReleaseId: THOUGHT_V2_LOCAL_RELEASE.protocol.protocolReleaseId,
      thoughtSpecHash: THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecHash,
      thoughtSpecId: THOUGHT_V2_LOCAL_RELEASE.spec.evmSpecId,
    },
    selectedSpec: {
      exactSpecBytes: toUtf8Bytes(input.selectedSpec.text),
      specName: input.selectedSpec.name,
    },
  }).canonicalJson;
