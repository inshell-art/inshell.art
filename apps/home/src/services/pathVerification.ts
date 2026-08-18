import {
  getProtocolReleaseChainId,
  getProtocolReleaseCodeHash,
  maybeResolveAddress,
} from "@inshell/contracts";
import {
  getBlockNumber,
  getChainId,
  getCode,
  getDefaultProvider,
  type ProviderInterface,
} from "@inshell/ethereum";
import { getAddress, isAddress, keccak256, toEventSelector, type Hex } from "viem";
import {
  readPathTokenOwner,
  readPathTokenUri,
} from "@/services/pathTokens";

const TRANSFER_TOPIC = toEventSelector("Transfer(address,address,uint256)");
const ZERO_TOPIC =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export type PathVerificationTarget = {
  chainId: number;
  contract: string;
  tokenId: string;
  transactionHash?: string;
};

export type PathVerificationTransaction = {
  blockNumber: number | null;
  from: string | null;
  status: "confirmed" | "reverted" | "unavailable";
  transferEvent: "matched" | "not found" | "unavailable";
  valueWei: string | null;
};

export type PathVerificationResult = {
  actualCodeHash: string | null;
  codeHashMatches: boolean;
  configuredChainId: number;
  configuredContract: string;
  contractMatches: boolean;
  expectedCodeHash: string | null;
  metadataAttributeCount: number;
  metadataName: string;
  observedAtBlock: number;
  observedChainId: number;
  owner: string;
  passed: boolean;
  target: PathVerificationTarget;
  tokenUri: string;
  transaction: PathVerificationTransaction | null;
};

type RpcTransaction = {
  from?: string;
  value?: string;
};

type RpcReceipt = {
  blockNumber?: string;
  logs?: Array<{
    address?: string;
    topics?: string[];
  }>;
  status?: string;
};

function parsePositiveInteger(value: string | null): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isTransactionHash(value: string | null): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function normalizeTarget(target: PathVerificationTarget): PathVerificationTarget {
  const tokenId = parsePositiveInteger(target.tokenId);
  if (!Number.isSafeInteger(target.chainId) || target.chainId <= 0) {
    throw new Error("The verification link has an invalid chain ID.");
  }
  if (!isAddress(target.contract)) {
    throw new Error("The verification link has an invalid contract address.");
  }
  if (tokenId == null) {
    throw new Error("The verification link has an invalid $PATH token ID.");
  }
  if (target.transactionHash && !isTransactionHash(target.transactionHash)) {
    throw new Error("The verification link has an invalid transaction hash.");
  }
  return {
    chainId: target.chainId,
    contract: getAddress(target.contract),
    tokenId: String(tokenId),
    ...(target.transactionHash
      ? { transactionHash: target.transactionHash.toLowerCase() }
      : {}),
  };
}

export function buildPathVerificationHref(target: PathVerificationTarget): string {
  const normalized = normalizeTarget(target);
  const query = new URLSearchParams({
    type: "path",
    chain: String(normalized.chainId),
    contract: normalized.contract,
    token: normalized.tokenId,
  });
  if (normalized.transactionHash) {
    query.set("tx", normalized.transactionHash);
  }
  return `/verify?${query.toString()}#verify-path-record`;
}

export function parsePathVerificationTarget(
  search: string,
): PathVerificationTarget | null {
  const query = new URLSearchParams(search);
  if (query.get("type") !== "path") return null;
  const chainId = parsePositiveInteger(query.get("chain"));
  const contract = query.get("contract")?.trim() ?? "";
  const tokenId = query.get("token")?.trim() ?? "";
  const transactionHash = query.get("tx")?.trim() || undefined;
  if (chainId == null) {
    throw new Error("The verification link has an invalid chain ID.");
  }
  return normalizeTarget({ chainId, contract, tokenId, transactionHash });
}

function parseMetadata(tokenUri: string): Record<string, unknown> {
  try {
    if (tokenUri.startsWith("data:application/json;base64,")) {
      const encoded = tokenUri.slice("data:application/json;base64,".length);
      const binary = globalThis.atob(encoded);
      const bytes = Uint8Array.from(binary, (character) =>
        character.charCodeAt(0),
      );
      return JSON.parse(
        new TextDecoder().decode(bytes),
      ) as Record<string, unknown>;
    }
    if (tokenUri.startsWith("data:application/json;utf8,")) {
      return JSON.parse(
        decodeURIComponent(tokenUri.slice("data:application/json;utf8,".length)),
      ) as Record<string, unknown>;
    }
    if (tokenUri.trim().startsWith("{")) {
      return JSON.parse(tokenUri) as Record<string, unknown>;
    }
  } catch {
    // A returned tokenURI is still useful evidence even if its JSON cannot be decoded.
  }
  return {};
}

function topicTokenId(topic: string | undefined): bigint | null {
  if (!topic) return null;
  try {
    return BigInt(topic);
  } catch {
    return null;
  }
}

async function readTransactionEvidence(args: {
  provider: ProviderInterface;
  target: PathVerificationTarget;
}): Promise<PathVerificationTransaction | null> {
  const transactionHash = args.target.transactionHash;
  if (!transactionHash || typeof args.provider.request !== "function") return null;
  const [transaction, receipt] = (await Promise.all([
    args.provider.request({
      method: "eth_getTransactionByHash",
      params: [transactionHash],
    }),
    args.provider.request({
      method: "eth_getTransactionReceipt",
      params: [transactionHash],
    }),
  ])) as [RpcTransaction | null, RpcReceipt | null];
  if (!transaction && !receipt) {
    return {
      blockNumber: null,
      from: null,
      status: "unavailable",
      transferEvent: "unavailable",
      valueWei: null,
    };
  }
  const tokenId = BigInt(args.target.tokenId);
  const transferMatched = receipt?.logs?.some((log) => {
    const topics = log.topics ?? [];
    return (
      log.address?.toLowerCase() === args.target.contract.toLowerCase() &&
      topics[0]?.toLowerCase() === TRANSFER_TOPIC.toLowerCase() &&
      topics[1]?.toLowerCase() === ZERO_TOPIC &&
      topicTokenId(topics[3]) === tokenId
    );
  });
  return {
    blockNumber: receipt?.blockNumber
      ? Number.parseInt(receipt.blockNumber, 16)
      : null,
    from: transaction?.from ? getAddress(transaction.from) : null,
    status:
      receipt?.status === "0x1"
        ? "confirmed"
        : receipt?.status === "0x0"
          ? "reverted"
          : "unavailable",
    transferEvent:
      receipt == null ? "unavailable" : transferMatched ? "matched" : "not found",
    valueWei: transaction?.value ? BigInt(transaction.value).toString() : null,
  };
}

export async function verifyPathRecord(
  rawTarget: PathVerificationTarget,
): Promise<PathVerificationResult> {
  const target = normalizeTarget(rawTarget);
  const configuredChainId = getProtocolReleaseChainId();
  const configuredContract = maybeResolveAddress("path_nft");
  if (configuredChainId == null || !configuredContract) {
    throw new Error("The active App build has no pinned $PATH deployment.");
  }
  const provider = getDefaultProvider();
  const [observedChainIdValue, observedAtBlock, code, owner, tokenUri, transaction] =
    await Promise.all([
      getChainId(provider),
      getBlockNumber(provider),
      getCode(provider, target.contract),
      readPathTokenOwner({
        provider,
        pathNftAddress: target.contract,
        tokenId: BigInt(target.tokenId),
      }),
      readPathTokenUri({
        provider,
        pathNftAddress: target.contract,
        tokenId: BigInt(target.tokenId),
      }),
      readTransactionEvidence({ provider, target }),
    ]);
  const observedChainId = Number(observedChainIdValue);
  const expectedCodeHash = getProtocolReleaseCodeHash("path_nft") ?? null;
  const actualCodeHash = code && code !== "0x" ? keccak256(code as Hex) : null;
  const contractMatches =
    configuredContract.toLowerCase() === target.contract.toLowerCase();
  const codeHashMatches =
    expectedCodeHash != null &&
    actualCodeHash != null &&
    expectedCodeHash.toLowerCase() === actualCodeHash.toLowerCase();
  const metadata = parseMetadata(tokenUri);
  const metadataName =
    typeof metadata.name === "string" && metadata.name.trim()
      ? metadata.name.trim()
      : "unavailable";
  const metadataAttributeCount = Array.isArray(metadata.attributes)
    ? metadata.attributes.length
    : 0;
  const transactionPassed =
    transaction == null ||
    (transaction.status === "confirmed" && transaction.transferEvent === "matched");
  const passed =
    target.chainId === configuredChainId &&
    observedChainId === configuredChainId &&
    contractMatches &&
    codeHashMatches &&
    Boolean(owner) &&
    Boolean(tokenUri) &&
    transactionPassed;

  return {
    actualCodeHash,
    codeHashMatches,
    configuredChainId,
    configuredContract: getAddress(configuredContract),
    contractMatches,
    expectedCodeHash,
    metadataAttributeCount,
    metadataName,
    observedAtBlock,
    observedChainId,
    owner,
    passed,
    target,
    tokenUri,
    transaction,
  };
}
