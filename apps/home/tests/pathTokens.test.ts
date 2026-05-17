import { describe, expect, jest, test } from "@jest/globals";
import {
  decodeFunctionData,
  encodeFunctionResult,
  getAddress,
  parseAbi,
  toEventSelector,
  type Hex,
} from "viem";
import {
  loadAllPathTokens,
  loadWalletPathTokens,
} from "../src/services/pathTokens";

const pathNftAbi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

const TRANSFER_TOPIC = toEventSelector("Transfer(address,address,uint256)");
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const OWNER = "0x1111222233334444555566667777888899990000";
const OTHER = "0x9999888877776666555544443333222211110000";
const PATH_NFT = "0x2222333344445555666677778888999900001111";

function addressTopic(address: string): string {
  return `0x${getAddress(address).slice(2).toLowerCase().padStart(64, "0")}`;
}

function tokenTopic(tokenId: bigint): string {
  return `0x${tokenId.toString(16).padStart(64, "0")}`;
}

function transferLog(from: string, to: string, tokenId: bigint, block: number, index: number) {
  return {
    address: PATH_NFT,
    blockNumber: `0x${block.toString(16)}`,
    data: "0x" as Hex,
    logIndex: `0x${index.toString(16)}`,
    topics: [
      TRANSFER_TOPIC,
      from === ZERO_TOPIC ? ZERO_TOPIC : addressTopic(from),
      to === ZERO_TOPIC ? ZERO_TOPIC : addressTopic(to),
      tokenTopic(tokenId),
    ],
    transactionHash: `0x${block.toString(16).padStart(64, "0")}`,
  };
}

function topicMatches(filter: string | null | undefined, value: string | undefined) {
  return filter == null || filter.toLowerCase() === value?.toLowerCase();
}

function metadataUri(name = "PATH #1") {
  const json = JSON.stringify({
    name,
    image: "data:image/svg+xml;base64,PHN2ZyAvPg==",
    attributes: [
      { trait_type: "Stage", value: "THOUGHT" },
      { trait_type: "THOUGHT", value: "1/3" },
    ],
  });
  return `data:application/json;base64,${globalThis.btoa(json)}`;
}

describe("path token inventory", () => {
  test("loads owned PATH tokens from Transfer logs and tokenURI metadata", async () => {
    const logs = [
      transferLog(ZERO_TOPIC, OWNER, 1n, 2, 0),
      transferLog(ZERO_TOPIC, OWNER, 2n, 3, 0),
      transferLog(OWNER, OTHER, 2n, 4, 0),
    ];
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x10";
        if (method === "eth_getLogs") {
          const filter = params[0];
          const topics = filter.topics as Array<string | null>;
          return logs.filter((log) =>
            topics.every((topic, index) => topicMatches(topic, log.topics[index]))
          );
        }
        if (method === "eth_call") {
          const call = params[0];
          const decoded = decodeFunctionData({
            abi: pathNftAbi,
            data: call.data,
          });
          if (decoded.functionName === "balanceOf") {
            return encodeFunctionResult({
              abi: pathNftAbi,
              functionName: "balanceOf",
              result: 1n,
            });
          }
          if (decoded.functionName === "ownerOf") {
            return encodeFunctionResult({
              abi: pathNftAbi,
              functionName: "ownerOf",
              result: decoded.args[0] === 1n ? OWNER : OTHER,
            });
          }
          if (decoded.functionName === "tokenURI") {
            return encodeFunctionResult({
              abi: pathNftAbi,
              functionName: "tokenURI",
              result: metadataUri(),
            });
          }
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const tokens = await loadWalletPathTokens({
      provider,
      pathNftAddress: PATH_NFT,
      walletAddress: OWNER,
      fromBlock: 1,
    });

    expect(tokens.map((token) => token.tokenIdLabel)).toEqual(["1"]);
    expect(tokens[0]?.metadata.name).toBe("PATH #1");
    expect(tokens[0]?.metadata.attributes?.[0]).toEqual({
      trait_type: "Stage",
      value: "THOUGHT",
    });
  });

  test("loads all minted PATH tokens from sequential ownerOf scan", async () => {
    const provider = {
      request: jest.fn(async ({ method, params }: any) => {
        if (method === "eth_blockNumber") return "0x10";
        if (method === "eth_getLogs") {
          throw new Error("eth_getLogs should not be needed for sequential PATH ids");
        }
        if (method === "eth_call") {
          const call = params[0];
          const decoded = decodeFunctionData({
            abi: pathNftAbi,
            data: call.data,
          });
          if (decoded.functionName === "ownerOf") {
            if (decoded.args[0] > 2n) {
              throw new Error("ERC721NonexistentToken");
            }
            return encodeFunctionResult({
              abi: pathNftAbi,
              functionName: "ownerOf",
              result: decoded.args[0] === 1n ? OWNER : OTHER,
            });
          }
          if (decoded.functionName === "tokenURI") {
            return encodeFunctionResult({
              abi: pathNftAbi,
              functionName: "tokenURI",
              result: metadataUri(`PATH #${decoded.args[0].toString()}`),
            });
          }
        }
        throw new Error(`unexpected RPC method ${method}`);
      }),
    };

    const tokens = await loadAllPathTokens({
      provider,
      pathNftAddress: PATH_NFT,
      fromBlock: 1,
    });

    expect(tokens.map((token) => token.tokenIdLabel)).toEqual(["1", "2"]);
    expect(tokens.map((token) => token.owner?.toLowerCase())).toEqual([
      OWNER.toLowerCase(),
      OTHER.toLowerCase(),
    ]);
    expect(tokens.map((token) => token.metadata.name)).toEqual([
      "PATH #1",
      "PATH #2",
    ]);
  });
});
