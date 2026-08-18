import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { keccak256, toEventSelector } from "viem";
import {
  buildPathVerificationHref,
  parsePathVerificationTarget,
  verifyPathRecord,
} from "../src/services/pathVerification";

const mockGetProtocolReleaseChainId = jest.fn<any>();
const mockGetProtocolReleaseCodeHash = jest.fn<any>();
const mockMaybeResolveAddress = jest.fn<any>();
const mockGetBlockNumber = jest.fn<any>();
const mockGetChainId = jest.fn<any>();
const mockGetCode = jest.fn<any>();
const mockGetDefaultProvider = jest.fn<any>();
const mockReadPathTokenOwner = jest.fn<any>();
const mockReadPathTokenUri = jest.fn<any>();

jest.mock("@inshell/contracts", () => ({
  getProtocolReleaseChainId: (...args: unknown[]) =>
    mockGetProtocolReleaseChainId(...args),
  getProtocolReleaseCodeHash: (...args: unknown[]) =>
    mockGetProtocolReleaseCodeHash(...args),
  maybeResolveAddress: (...args: unknown[]) => mockMaybeResolveAddress(...args),
}));

jest.mock("@inshell/ethereum", () => ({
  getBlockNumber: (...args: unknown[]) => mockGetBlockNumber(...args),
  getChainId: (...args: unknown[]) => mockGetChainId(...args),
  getCode: (...args: unknown[]) => mockGetCode(...args),
  getDefaultProvider: (...args: unknown[]) => mockGetDefaultProvider(...args),
}));

jest.mock("../src/services/pathTokens", () => ({
  readPathTokenOwner: (...args: unknown[]) => mockReadPathTokenOwner(...args),
  readPathTokenUri: (...args: unknown[]) => mockReadPathTokenUri(...args),
}));

const CONTRACT = "0x1111222233334444555566667777888899990000";
const TRANSACTION =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER = "0x9999888877776666555544443333222211110000";
const BYTECODE = "0x6000";
const TRANSFER_TOPIC = toEventSelector("Transfer(address,address,uint256)");
const ZERO_TOPIC = `0x${"0".repeat(64)}`;

function tokenTopic(tokenId: bigint): string {
  return `0x${tokenId.toString(16).padStart(64, "0")}`;
}

function utf8Metadata(name = "$PATH #4") {
  return `data:application/json;utf8,${encodeURIComponent(
    JSON.stringify({
      name,
      attributes: [
        { trait_type: "stage", value: "THOUGHT" },
        { trait_type: "THOUGHT", value: "0 / 1 used" },
      ],
    }),
  )}`;
}

describe("PATH verification links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProtocolReleaseChainId.mockReturnValue(31337);
    mockGetProtocolReleaseCodeHash.mockReturnValue(keccak256(BYTECODE));
    mockMaybeResolveAddress.mockReturnValue(CONTRACT);
    mockGetBlockNumber.mockResolvedValue(99);
    mockGetChainId.mockResolvedValue(31337n);
    mockGetCode.mockResolvedValue(BYTECODE);
    mockReadPathTokenOwner.mockResolvedValue(OWNER);
    mockReadPathTokenUri.mockResolvedValue(utf8Metadata());
  });

  test("carries only record locators into the verifier", () => {
    const href = buildPathVerificationHref({
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
      transactionHash: TRANSACTION,
    });
    const url = new URL(href, "https://inshell.art");

    expect(url.pathname).toBe("/verify");
    expect(url.hash).toBe("#verify-path-record");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: "path",
      chain: "31337",
      contract: CONTRACT,
      token: "4",
      tx: TRANSACTION,
    });
    expect(url.searchParams.has("owner")).toBe(false);
    expect(url.searchParams.has("tokenURI")).toBe(false);
  });

  test("parses a valid PATH verifier target", () => {
    expect(
      parsePathVerificationTarget(
        `?type=path&chain=31337&contract=${CONTRACT}&token=4&tx=${TRANSACTION}`,
      ),
    ).toEqual({
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
      transactionHash: TRANSACTION,
    });
  });

  test("ignores other verifier types and rejects malformed PATH locators", () => {
    expect(parsePathVerificationTarget("?type=thought&token=4")).toBeNull();
    expect(() =>
      parsePathVerificationTarget(
        `?type=path&chain=31337&contract=${CONTRACT}&token=0`,
      ),
    ).toThrow("invalid $PATH token ID");
  });

  test("rejects unsafe verifier locator fields", () => {
    expect(() =>
      buildPathVerificationHref({
        chainId: 0,
        contract: CONTRACT,
        tokenId: "4",
      }),
    ).toThrow("invalid chain ID");
    expect(() =>
      buildPathVerificationHref({
        chainId: 31337,
        contract: "not-an-address",
        tokenId: "4",
      }),
    ).toThrow("invalid contract address");
    expect(() =>
      buildPathVerificationHref({
        chainId: 31337,
        contract: CONTRACT,
        tokenId: "4",
        transactionHash: "0x1234",
      }),
    ).toThrow("invalid transaction hash");
  });

  test("verifies the pinned contract, token metadata, and matching mint transfer", async () => {
    const provider = {
      request: jest.fn<any>(async ({ method }: { method: string }) => {
        if (method === "eth_getTransactionByHash") {
          return { from: OWNER, value: "0x2386f26fc10000" };
        }
        if (method === "eth_getTransactionReceipt") {
          return {
            blockNumber: "0x63",
            status: "0x1",
            logs: [
              {
                address: CONTRACT,
                topics: [TRANSFER_TOPIC, ZERO_TOPIC, ZERO_TOPIC, tokenTopic(4n)],
              },
            ],
          };
        }
        throw new Error(`unexpected method ${method}`);
      }),
    };
    mockGetDefaultProvider.mockReturnValue(provider);

    const result = await verifyPathRecord({
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
      transactionHash: TRANSACTION.toUpperCase().replace("0X", "0x"),
    });

    expect(result.passed).toBe(true);
    expect(result.codeHashMatches).toBe(true);
    expect(result.contractMatches).toBe(true);
    expect(result.metadataName).toBe("$PATH #4");
    expect(result.metadataAttributeCount).toBe(2);
    expect(result.transaction).toEqual({
      blockNumber: 99,
      from: OWNER,
      status: "confirmed",
      transferEvent: "matched",
      valueWei: "10000000000000000",
    });
    expect(result.target.transactionHash).toBe(TRANSACTION);
  });

  test("returns evidence with a failed verdict when transaction evidence mismatches", async () => {
    const metadata = JSON.stringify({ name: "", attributes: "invalid" });
    mockReadPathTokenUri.mockResolvedValue(
      `data:application/json;base64,${globalThis.btoa(metadata)}`,
    );
    mockGetProtocolReleaseCodeHash.mockReturnValue(keccak256("0x6001"));
    mockGetDefaultProvider.mockReturnValue({
      request: jest.fn<any>(async ({ method }: { method: string }) => {
        if (method === "eth_getTransactionByHash") return null;
        if (method === "eth_getTransactionReceipt") {
          return { blockNumber: "0x64", status: "0x0", logs: [] };
        }
        return null;
      }),
    });

    const result = await verifyPathRecord({
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
      transactionHash: TRANSACTION,
    });

    expect(result.passed).toBe(false);
    expect(result.codeHashMatches).toBe(false);
    expect(result.metadataName).toBe("unavailable");
    expect(result.metadataAttributeCount).toBe(0);
    expect(result.transaction?.status).toBe("reverted");
    expect(result.transaction?.transferEvent).toBe("not found");
  });

  test("supports record-only verification and reports a missing pinned deployment", async () => {
    mockGetDefaultProvider.mockReturnValue({});
    const result = await verifyPathRecord({
      chainId: 31337,
      contract: CONTRACT,
      tokenId: "4",
    });
    expect(result.transaction).toBeNull();
    expect(result.passed).toBe(true);

    mockMaybeResolveAddress.mockReturnValue(null);
    await expect(
      verifyPathRecord({ chainId: 31337, contract: CONTRACT, tokenId: "4" }),
    ).rejects.toThrow("no pinned $PATH deployment");
  });
});
