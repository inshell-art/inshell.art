import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  pulseSaleEventTopic,
  resolveEntrypoint,
} from "./abi";

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

type RpcRequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

export type EthereumBlockTag = "latest" | "pending" | "safe" | "finalized";

export type CallContractArgs = {
  contractAddress: string;
  entrypoint: string;
  calldata?: readonly unknown[];
};

export type EthereumLog = {
  address: string;
  blockHash?: string;
  blockNumber?: string;
  data: Hex;
  logIndex?: string;
  removed?: boolean;
  topics: string[];
  transactionHash?: string;
};

export type GetLogsArgs = {
  address: string;
  fromBlock?: number;
  toBlock?: number | EthereumBlockTag;
  topics?: readonly string[];
};

type LegacyMockProvider = {
  callContract?: (
    args: CallContractArgs,
    blockTag?: EthereumBlockTag
  ) => Promise<unknown>;
  getBlock?: (blockRef: unknown) => Promise<any>;
  getBlockNumber?: () => Promise<number>;
  getBalance?: (address: string, blockTag?: EthereumBlockTag) => Promise<bigint>;
  getLogs?: (args: GetLogsArgs) => Promise<EthereumLog[]>;
  waitForTransaction?: (hash: string) => Promise<unknown>;
};

export type ProviderInterface = LegacyMockProvider & {
  request?: (args: RpcRequestArgs) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: any[]) => void
  ) => void;
};

export const DEFAULT_BLOCK_TAG: EthereumBlockTag = "latest";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

let rpcCounter = 0;

function assertRequestProvider(
  provider: ProviderInterface
): asserts provider is ProviderInterface & {
  request: (args: RpcRequestArgs) => Promise<unknown>;
} {
  if (typeof provider?.request !== "function") {
    throw new Error("Ethereum provider does not support JSON-RPC requests.");
  }
}

export function supportsRpcRequest(provider: ProviderInterface): boolean {
  return typeof provider?.request === "function";
}

function toHexQuantity(value: number | bigint): Hex {
  const bigintValue =
    typeof value === "bigint" ? value : BigInt(Math.max(0, Math.trunc(value)));
  return `0x${bigintValue.toString(16)}`;
}

function normalizeBlockTag(blockTag?: number | EthereumBlockTag): string {
  if (typeof blockTag === "number") {
    return Number.isFinite(blockTag) ? toHexQuantity(blockTag) : DEFAULT_BLOCK_TAG;
  }
  return blockTag ?? DEFAULT_BLOCK_TAG;
}

function splitU256(value: bigint): { low: bigint; high: bigint } {
  const mask = (1n << 128n) - 1n;
  return {
    low: value & mask,
    high: value >> 128n,
  };
}

function parseUint256FromCalldata(values: readonly unknown[]): bigint {
  if (!values.length) return 0n;
  if (values.length === 1) return BigInt(String(values[0]));
  const low = BigInt(String(values[0] ?? 0));
  const high = BigInt(String(values[1] ?? 0));
  return low + (high << 128n);
}

function normalizeAddress(value: unknown): Address {
  return getAddress(String(value));
}

function toDataWords(data: Hex): Hex[] {
  const raw = data.slice(2);
  if (!raw.length) return [];
  const words: Hex[] = [];
  for (let i = 0; i < raw.length; i += 64) {
    words.push(`0x${raw.slice(i, i + 64)}` as Hex);
  }
  return words;
}

function wordToAddress(word: string): string {
  return getAddress(`0x${word.slice(-40)}`);
}

function wordToBigInt(word: string): bigint {
  return BigInt(word);
}

export class JsonRpcProvider implements ProviderInterface {
  constructor(private readonly rpcUrl: string) {}

  async request(args: RpcRequestArgs): Promise<unknown> {
    const response = await fetch(this.rpcUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: ++rpcCounter,
        method: args.method,
        params:
          args.params == null
            ? []
            : Array.isArray(args.params)
            ? args.params
            : [args.params],
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(
        payload?.error?.message ?? `RPC request failed with ${response.status}`
      );
    }
    if (payload?.error) {
      throw new Error(payload.error.message ?? "RPC request failed.");
    }
    return payload?.result;
  }
}

export function getDefaultProvider(): ProviderInterface {
  const rpcUrl =
    (getEnv("VITE_ETH_RPC") as string | undefined) ??
    "http://127.0.0.1:8546";
  return new JsonRpcProvider(rpcUrl);
}

function encodeCall(entrypoint: string, calldata: readonly unknown[] = []): {
  data: Hex;
  decode: (result: Hex) => unknown;
} {
  const resolved = resolveEntrypoint(entrypoint);
  if (resolved.functionName === "getCurrentPrice") {
    return {
      data: encodeFunctionData({
        abi: resolved.abi,
        functionName: resolved.functionName,
      }),
      decode: (result) =>
        decodeFunctionResult({
          abi: resolved.abi,
          functionName: resolved.functionName,
          data: result,
        }),
    };
  }
  if (resolved.functionName === "curveActive") {
    return {
      data: encodeFunctionData({
        abi: resolved.abi,
        functionName: resolved.functionName,
      }),
      decode: (result) =>
        decodeFunctionResult({
          abi: resolved.abi,
          functionName: resolved.functionName,
          data: result,
        }),
    };
  }
  if (resolved.functionName === "getConfig") {
    return {
      data: encodeFunctionData({
        abi: resolved.abi,
        functionName: resolved.functionName,
      }),
      decode: (result) => {
        const decoded = decodeFunctionResult({
          abi: resolved.abi,
          functionName: resolved.functionName,
          data: result,
        }) as readonly [bigint, bigint, bigint, bigint, bigint];
        const [openTime, genesisPrice, genesisFloor, k, pts] = decoded;
        return { openTime, genesisPrice, genesisFloor, k, pts };
      },
    };
  }
  if (resolved.functionName === "balanceOf") {
    return {
      data: encodeFunctionData({
        abi: resolved.abi,
        functionName: resolved.functionName,
        args: [normalizeAddress(calldata[0])],
      }),
      decode: (result) =>
        decodeFunctionResult({
          abi: resolved.abi,
          functionName: resolved.functionName,
          data: result,
        }),
    };
  }
  if (resolved.functionName === "allowance") {
    return {
      data: encodeFunctionData({
        abi: resolved.abi,
        functionName: resolved.functionName,
        args: [normalizeAddress(calldata[0]), normalizeAddress(calldata[1])],
      }),
      decode: (result) =>
        decodeFunctionResult({
          abi: resolved.abi,
          functionName: resolved.functionName,
          data: result,
        }),
    };
  }
  throw new Error(`Entrypoint ${entrypoint} is not a read call.`);
}

export function encodeExecuteData(
  entrypoint: string,
  calldata: readonly unknown[] = []
): Hex {
  const resolved = resolveEntrypoint(entrypoint);
  if (resolved.functionName === "approve") {
    return encodeFunctionData({
      abi: resolved.abi,
      functionName: resolved.functionName,
      args: [normalizeAddress(calldata[0]), parseUint256FromCalldata(calldata.slice(1))],
    });
  }
  if (resolved.functionName === "bid") {
    return encodeFunctionData({
      abi: resolved.abi,
      functionName: resolved.functionName,
      args: [parseUint256FromCalldata(calldata)],
    });
  }
  throw new Error(`Entrypoint ${entrypoint} is not a write call.`);
}

export async function callContract<T = unknown>(
  provider: ProviderInterface,
  args: CallContractArgs,
  blockTag?: number | EthereumBlockTag
): Promise<T> {
  if (typeof provider.callContract === "function") {
    return (await provider.callContract(
      args,
      normalizeBlockTag(blockTag) as EthereumBlockTag
    )) as T;
  }
  assertRequestProvider(provider);
  const { data, decode } = encodeCall(args.entrypoint, args.calldata ?? []);
  const result = (await provider.request({
    method: "eth_call",
    params: [
      {
        to: normalizeAddress(args.contractAddress),
        data,
      },
      normalizeBlockTag(blockTag),
    ],
  })) as Hex;
  if (!result || result === "0x") {
    throw new Error(
      `No return data from ${args.entrypoint} at ${normalizeAddress(
        args.contractAddress
      )}. Verify the RPC network, contract address, and PATH FE release.`
    );
  }
  return decode(result) as T;
}

export async function getChainId(provider: ProviderInterface): Promise<bigint> {
  assertRequestProvider(provider);
  const result = (await provider.request({ method: "eth_chainId" })) as string;
  return BigInt(result);
}

export async function getCode(
  provider: ProviderInterface,
  address: string,
  blockTag?: number | EthereumBlockTag
): Promise<Hex> {
  assertRequestProvider(provider);
  const result = (await provider.request({
    method: "eth_getCode",
    params: [normalizeAddress(address), normalizeBlockTag(blockTag)],
  })) as Hex;
  return result ?? "0x";
}

export function hashBytecode(code: Hex): Hex | undefined {
  if (!code || code === "0x") return undefined;
  return keccak256(code);
}

export function hashUtf8String(value: string): Hex {
  return keccak256(stringToHex(value));
}

export async function getBlockNumber(provider: ProviderInterface): Promise<number> {
  if (typeof provider.getBlockNumber === "function") {
    return provider.getBlockNumber();
  }
  assertRequestProvider(provider);
  const result = (await provider.request({
    method: "eth_blockNumber",
  })) as string;
  return Number.parseInt(result, 16);
}

export async function getBalance(
  provider: ProviderInterface,
  address: string,
  blockTag?: number | EthereumBlockTag
): Promise<bigint> {
  if (typeof provider.getBalance === "function") {
    return provider.getBalance(address, normalizeBlockTag(blockTag) as EthereumBlockTag);
  }
  assertRequestProvider(provider);
  const result = (await provider.request({
    method: "eth_getBalance",
    params: [normalizeAddress(address), normalizeBlockTag(blockTag)],
  })) as string;
  return BigInt(result);
}

export async function getBlock(
  provider: ProviderInterface,
  blockRef: number | EthereumBlockTag
): Promise<{ number?: number; timestamp?: number }> {
  if (typeof provider.getBlock === "function") {
    const block = await provider.getBlock(blockRef);
    const rawTimestamp = (block as any)?.timestamp;
    const timestamp =
      typeof rawTimestamp === "string"
        ? Number.parseInt(rawTimestamp, 16)
        : Number(rawTimestamp);
    return {
      number:
        typeof (block as any)?.number === "string"
          ? Number.parseInt((block as any).number, 16)
          : Number((block as any)?.number),
      timestamp: Number.isFinite(timestamp) ? timestamp : undefined,
    };
  }
  assertRequestProvider(provider);
  const result = (await provider.request({
    method: "eth_getBlockByNumber",
    params: [normalizeBlockTag(blockRef), false],
  })) as { number?: string; timestamp?: string } | null;
  return {
    number: result?.number ? Number.parseInt(result.number, 16) : undefined,
    timestamp: result?.timestamp
      ? Number.parseInt(result.timestamp, 16)
      : undefined,
  };
}

export async function getLogs(
  provider: ProviderInterface,
  args: GetLogsArgs
): Promise<EthereumLog[]> {
  if (typeof provider.getLogs === "function") {
    return provider.getLogs(args);
  }
  assertRequestProvider(provider);
  const topics = args.topics?.length ? [args.topics] : undefined;
  const result = (await provider.request({
    method: "eth_getLogs",
    params: [
      {
        address: normalizeAddress(args.address),
        fromBlock:
          typeof args.fromBlock === "number"
            ? normalizeBlockTag(args.fromBlock)
            : undefined,
        toBlock:
          typeof args.toBlock === "number" || typeof args.toBlock === "string"
            ? normalizeBlockTag(args.toBlock as number | EthereumBlockTag)
            : DEFAULT_BLOCK_TAG,
        topics,
      },
    ],
  })) as EthereumLog[];
  return Array.isArray(result) ? result : [];
}

export async function waitForTransaction(
  provider: ProviderInterface,
  hash: string,
  timeoutMs = 120_000,
  pollMs = 1_500
): Promise<{ status?: string }> {
  if (typeof provider.waitForTransaction === "function") {
    return (await provider.waitForTransaction(hash)) as { status?: string };
  }
  assertRequestProvider(provider);
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") {
        throw new Error("Transaction reverted.");
      }
      return receipt;
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollMs));
  }
  throw new Error("Transaction was not confirmed before timeout.");
}

export async function sendTransaction(
  provider: ProviderInterface,
  tx: {
    from: string;
    to: string;
    data: Hex;
    value?: bigint;
  }
): Promise<string> {
  assertRequestProvider(provider);
  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: normalizeAddress(tx.from),
        to: normalizeAddress(tx.to),
        data: tx.data,
        value:
          typeof tx.value === "bigint" && tx.value > 0n
            ? toHexQuantity(tx.value)
            : undefined,
      },
    ],
  })) as string;
  return hash;
}

export function getBidEventSelectors(): Set<string> {
  return new Set([pulseSaleEventTopic.toLowerCase()]);
}

export function decodeSaleLog(log: EthereumLog): {
  buyer?: string;
  epochIndex?: number;
  lastPrice?: bigint;
  nowTs?: number;
  anchorTime?: number;
  floorPrice?: bigint;
} | null {
  const topic0 = log.topics?.[0]?.toLowerCase();
  if (topic0 !== pulseSaleEventTopic.toLowerCase()) return null;
  const dataWords = toDataWords(log.data);
  const topicCount = log.topics?.length ?? 0;
  let buyer: string | undefined;
  let epochIndex: bigint | undefined;
  let offset = 0;

  if (topicCount > 1) {
    buyer = wordToAddress(log.topics[1]);
  }
  if (topicCount > 2) {
    epochIndex = wordToBigInt(log.topics[2]);
  }

  if (!buyer && dataWords.length === 6) {
    buyer = wordToAddress(dataWords[0]);
    offset += 1;
  }
  if (epochIndex == null && dataWords.length - offset >= 5) {
    epochIndex = wordToBigInt(dataWords[offset]);
    offset += 1;
  }
  if (dataWords.length - offset < 4) return null;

  const lastPrice = wordToBigInt(dataWords[offset]);
  const nowTs = Number(wordToBigInt(dataWords[offset + 1]));
  const anchorTime = Number(wordToBigInt(dataWords[offset + 2]));
  const floorPrice = wordToBigInt(dataWords[offset + 3]);

  return {
    buyer,
    epochIndex:
      epochIndex != null && epochIndex <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(epochIndex)
        : undefined,
    lastPrice,
    nowTs: Number.isFinite(nowTs) ? nowTs : undefined,
    anchorTime: Number.isFinite(anchorTime) ? anchorTime : undefined,
    floorPrice,
  };
}

export function bigintToU256(value: bigint): { low: string; high: string } {
  const limbs = splitU256(value);
  return {
    low: limbs.low.toString(10),
    high: limbs.high.toString(10),
  };
}
