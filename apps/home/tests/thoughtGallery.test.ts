import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { Buffer } from "node:buffer";
import {
  decodeFunctionData,
  encodeFunctionResult,
  parseAbi,
  type Hex,
} from "viem";
import { loadLocalThoughtGallery } from "../src/services/thoughtGallery";

const thoughtNftAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function promptLineOf(uint256 tokenId) view returns (string)",
  "function agentLineOf(uint256 tokenId) view returns (string)",
  "function agentOf(uint256 tokenId) view returns (string)",
  "function modelOf(uint256 tokenId) view returns (string)",
  "function agentHashOf(uint256 tokenId) view returns (bytes32)",
  "function modelHashOf(uint256 tokenId) view returns (bytes32)",
  "function provenanceOf(uint256 tokenId) view returns (string)",
  "function promptLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function agentLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function provenanceHashOf(uint256 tokenId) view returns (bytes32)",
  "function conversationIdentityHashOf(uint256 tokenId) view returns (bytes32)",
  "function workHashOf(uint256 tokenId) view returns (bytes32)",
  "function pathIdOf(uint256 tokenId) view returns (uint256)",
  "function pathSerialOf(uint256 tokenId) view returns (uint256)",
  "function authorOf(uint256 tokenId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintedAtOf(uint256 tokenId) view returns (uint64)",
  "function creationAttestationDigestOf(uint256 tokenId) view returns (bytes32)",
  "function thoughtSpecOf(uint256 tokenId) view returns (bytes32 specId,bytes32 specHash,string specName,string ref)",
  "function svgOf(uint256 tokenId) view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

const THOUGHT_NFT = "0x2222333344445555666677778888999900001111";
const MINTER = "0x1111222233334444555566667777888899990000";
const PROMPT_HASH =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const AGENT_HASH =
  "0x2222222222222222222222222222222222222222222222222222222222222222";
const PROVENANCE_HASH =
  "0x3333333333333333333333333333333333333333333333333333333333333333";
const SPEC_ID =
  "0x4444444444444444444444444444444444444444444444444444444444444444";
const SPEC_HASH =
  "0x5555555555555555555555555555555555555555555555555555555555555555";
const AGENT_RECORD_HASH =
  "0x6666666666666666666666666666666666666666666666666666666666666666";
const MODEL_RECORD_HASH =
  "0x7777777777777777777777777777777777777777777777777777777777777777";
const CONVERSATION_HASH =
  "0x8888888888888888888888888888888888888888888888888888888888888888";
const WORK_HASH =
  "0x9999999999999999999999999999999999999999999999999999999999999999";
const ATTESTATION_DIGEST =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CANONICAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
const CANONICAL_IMAGE = `data:image/svg+xml;base64,${Buffer.from(
  CANONICAL_SVG,
  "utf8"
).toString("base64")}`;

function result(functionName: string, value: unknown): Hex {
  return encodeFunctionResult({
    abi: thoughtNftAbi,
    functionName: functionName as any,
    result: value as any,
  });
}

function localThoughtProvider(
  totalSupply = 1n,
  includeAttestedTraits = true
) {
  const provenance = JSON.stringify({
    process: {
      kind: "agent-run",
      agent: {
        label: "Codex",
      },
      model: {
        label: "gpt-test",
      },
      run: {
        adapter: "codex",
      },
    },
  });
  const tokenUri = `data:application/json,${encodeURIComponent(
    JSON.stringify({
      name: "THOUGHT #1",
      image: CANONICAL_IMAGE,
      attributes: includeAttestedTraits
        ? [
            { trait_type: "Agent", value: "Codex" },
            { trait_type: "Model", value: "gpt-test" },
            { trait_type: "Creation Attestation", value: "Inshell THOUGHT App" },
          ]
        : [
            { trait_type: "Agent", value: "Codex" },
            { trait_type: "Model", value: "gpt-test" },
            { trait_type: "Creation Attestation", value: "Unattested" },
          ],
      properties: {
        agent: "Codex",
        agentKeccak256: AGENT_RECORD_HASH,
        model: "gpt-test",
        modelKeccak256: MODEL_RECORD_HASH,
      },
    })
  )}`;
  return {
    request: jest.fn(async ({ method, params }: any) => {
      expect(method).toBe("eth_call");
      const call = params[0] as { data: Hex; to: string; gas?: string };
      expect(call.to.toLowerCase()).toBe(THOUGHT_NFT.toLowerCase());
      expect(call.gas).toBe("0x5f5e100");
      const decoded = decodeFunctionData({
        abi: thoughtNftAbi,
        data: call.data,
      });
      switch (decoded.functionName) {
        case "totalSupply":
          return result("totalSupply", totalSupply);
        case "promptLineOf":
          return result("promptLineOf", "why?");
        case "agentLineOf":
          return result("agentLineOf", "because");
        case "agentOf":
          return result("agentOf", "Codex");
        case "modelOf":
          return result("modelOf", "gpt-test");
        case "agentHashOf":
          return result("agentHashOf", AGENT_RECORD_HASH);
        case "modelHashOf":
          return result("modelHashOf", MODEL_RECORD_HASH);
        case "provenanceOf":
          return result("provenanceOf", provenance);
        case "promptLineHashOf":
          return result("promptLineHashOf", PROMPT_HASH);
        case "agentLineHashOf":
          return result("agentLineHashOf", AGENT_HASH);
        case "provenanceHashOf":
          return result("provenanceHashOf", PROVENANCE_HASH);
        case "conversationIdentityHashOf":
          return result("conversationIdentityHashOf", CONVERSATION_HASH);
        case "workHashOf":
          return result("workHashOf", WORK_HASH);
        case "pathIdOf":
          return result("pathIdOf", 7n);
        case "pathSerialOf":
          return result("pathSerialOf", 2n);
        case "authorOf":
          return result("authorOf", MINTER);
        case "ownerOf":
          return result("ownerOf", MINTER);
        case "mintedAtOf":
          return result("mintedAtOf", 1_780_000_000n);
        case "creationAttestationDigestOf":
          return result("creationAttestationDigestOf", ATTESTATION_DIGEST);
        case "thoughtSpecOf":
          return result("thoughtSpecOf", [
            SPEC_ID,
            SPEC_HASH,
            "THOUGHT.v2.md",
            "dev://THOUGHT.v2.md",
          ]);
        case "svgOf":
          return result("svgOf", CANONICAL_SVG);
        case "tokenURI":
          return result("tokenURI", tokenUri);
        default:
          throw new Error(`unexpected function ${decoded.functionName}`);
      }
    }),
  };
}

describe("local THOUGHT gallery", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("reads minted THOUGHT records and canonical SVGs from Anvil", async () => {
    const provider = localThoughtProvider();
    const thoughts = await loadLocalThoughtGallery({
      provider,
      thoughtNftAddress: THOUGHT_NFT,
    });

    expect(thoughts).toHaveLength(1);
    expect(thoughts[0]).toMatchObject({
      tokenId: 1,
      pathId: "7",
      minter: MINTER,
      prompt: "why?",
      rawText: "because",
      returnedText: "because",
      provider: "codex",
      agent: "Codex",
      model: "gpt-test",
      agentHash: AGENT_RECORD_HASH,
      modelHash: MODEL_RECORD_HASH,
      thoughtSpecId: SPEC_ID,
      thoughtSpecHash: SPEC_HASH,
      thoughtSpecName: "THOUGHT.v2.md",
      thoughtSpecRef: "dev://THOUGHT.v2.md",
      conversationIdentityHash: CONVERSATION_HASH,
      workHash: WORK_HASH,
      pathSerial: "2",
      currentOwner: MINTER,
      creationAttestationDigest: ATTESTATION_DIGEST,
      mintedAt: 1_780_000_000,
      txHash: "",
      blockNumber: 0,
    });
    expect(thoughts[0]?.image).toBe(CANONICAL_IMAGE);
  });

  test("returns an empty gallery when the Anvil collection has no supply", async () => {
    const provider = localThoughtProvider(0n);
    await expect(
      loadLocalThoughtGallery({
        provider,
        thoughtNftAddress: THOUGHT_NFT,
      })
    ).resolves.toEqual([]);
    expect(provider.request).toHaveBeenCalledTimes(1);
  });

  test("keeps neutral Agent and Model records for Unattested metadata", async () => {
    const thoughts = await loadLocalThoughtGallery({
      provider: localThoughtProvider(1n, false),
      thoughtNftAddress: THOUGHT_NFT,
    });

    expect(thoughts[0]).toMatchObject({
      agent: "Codex",
      model: "gpt-test",
    });
  });
});
