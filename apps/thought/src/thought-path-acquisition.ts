export const THOUGHT_PATH_ACQUISITION_STORAGE_KEY =
  "inshell:thought:path-acquisition:v1";

export type ThoughtPathAcquisitionState =
  | "idle"
  | "quoting"
  | "review"
  | "awaiting_signature"
  | "submitted"
  | "inventory_pending"
  | "error";

export type PendingThoughtPathAcquisition = Readonly<{
  version: 1;
  account: string;
  chainId: number;
  auction: string;
  pathNft: string;
  workHash: string;
  txHash: string;
  updatedAt: number;
}>;

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const parseJson = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
};

export const parsePendingThoughtPathAcquisition = (
  value: unknown,
  now = Date.now(),
): PendingThoughtPathAcquisition | null => {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const candidate = parsed as Record<string, unknown>;
  if (
    candidate.version !== 1 ||
    typeof candidate.account !== "string" ||
    !ADDRESS_PATTERN.test(candidate.account) ||
    typeof candidate.chainId !== "number" ||
    !Number.isSafeInteger(candidate.chainId) ||
    candidate.chainId <= 0 ||
    typeof candidate.auction !== "string" ||
    !ADDRESS_PATTERN.test(candidate.auction) ||
    typeof candidate.pathNft !== "string" ||
    !ADDRESS_PATTERN.test(candidate.pathNft) ||
    typeof candidate.workHash !== "string" ||
    !HASH_PATTERN.test(candidate.workHash) ||
    typeof candidate.txHash !== "string" ||
    !HASH_PATTERN.test(candidate.txHash) ||
    typeof candidate.updatedAt !== "number" ||
    !Number.isSafeInteger(candidate.updatedAt) ||
    candidate.updatedAt <= 0 ||
    now - candidate.updatedAt > PENDING_TTL_MS
  ) {
    return null;
  }

  return Object.freeze({
    version: 1 as const,
    account: candidate.account.toLowerCase(),
    chainId: candidate.chainId,
    auction: candidate.auction.toLowerCase(),
    pathNft: candidate.pathNft.toLowerCase(),
    workHash: candidate.workHash.toLowerCase(),
    txHash: candidate.txHash.toLowerCase(),
    updatedAt: candidate.updatedAt,
  });
};

export const serializePendingThoughtPathAcquisition = (
  value: PendingThoughtPathAcquisition,
) => {
  const parsed = parsePendingThoughtPathAcquisition(value, value.updatedAt);
  if (!parsed) throw new Error("invalid pending $PATH acquisition");
  return JSON.stringify(parsed);
};

export const pendingThoughtPathAcquisitionMatches = (
  pending: PendingThoughtPathAcquisition,
  expected: Readonly<{
    account: string;
    chainId: number;
    auction: string;
    pathNft: string;
    workHash: string;
  }>,
) =>
  pending.account === expected.account.toLowerCase() &&
  pending.chainId === expected.chainId &&
  pending.auction === expected.auction.toLowerCase() &&
  pending.pathNft === expected.pathNft.toLowerCase() &&
  pending.workHash === expected.workHash.toLowerCase();

type PathMintLockManager = {
  request<T>(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<T>,
  ): Promise<T>;
};

export type ThoughtPathAcquisitionLockResult<T> =
  | Readonly<{ acquired: true; value: T }>
  | Readonly<{ acquired: false; reason: "busy" }>;

let fallbackPathAcquisitionLockActive = false;

const withFallbackThoughtPathAcquisitionLock = async <T>(
  task: () => Promise<T>,
): Promise<ThoughtPathAcquisitionLockResult<T>> => {
  if (fallbackPathAcquisitionLockActive) {
    return Object.freeze({ acquired: false as const, reason: "busy" as const });
  }
  fallbackPathAcquisitionLockActive = true;
  try {
    return Object.freeze({ acquired: true as const, value: await task() });
  } finally {
    fallbackPathAcquisitionLockActive = false;
  }
};

type ThoughtPathAcquisitionErrorLike = {
  cause?: unknown;
  code?: unknown;
  data?: unknown;
  error?: unknown;
  info?: unknown;
  message?: unknown;
  originalError?: unknown;
  reason?: unknown;
  shortMessage?: unknown;
};

export type ThoughtPathAcquisitionFailure = Readonly<{
  title: string;
  detail: string;
  nextStep: string;
}>;

export const thoughtPathAcquisitionGasLimit = (estimatedGas: bigint) => {
  if (estimatedGas <= 0n) {
    throw new Error("invalid $PATH gas estimate");
  }
  // Wallet RPC estimates have under-reported the nested PATH settlement cost
  // on local Anvil. A percentage margin covers execution variance; the fixed
  // reserve covers the adapter/NFT call boundary. Unused gas is not charged.
  return (estimatedGas * 125n + 99n) / 100n + 30_000n;
};

type ThoughtPathAcquisitionLocalBlockProvider = {
  getBlockNumber(): Promise<number>;
  send(method: string, params: unknown[]): Promise<unknown>;
};

export const advanceThoughtPathAcquisitionLocalBlock = async (
  provider: ThoughtPathAcquisitionLocalBlockProvider,
  lastBidBlock: bigint,
  enabled: boolean,
) => {
  if (!enabled) return false;
  const currentBlock = BigInt(await provider.getBlockNumber());
  if (lastBidBlock < currentBlock) return false;
  const blocksNeeded = lastBidBlock - currentBlock + 1n;
  try {
    // Pulse accepts only one bid per block. Restored local state can also carry
    // an auction lastBlock ahead of Anvil's restored head. Advance directly
    // past that stored block so the wallet's gas estimate can succeed.
    await provider.send("anvil_mine", [`0x${blocksNeeded.toString(16)}`]);
    return true;
  } catch {
    // Public networks and restricted RPCs advance independently. Let the
    // normal estimate surface the current chain outcome.
    return false;
  }
};

const collectPathAcquisitionErrorDetails = (error: unknown) => {
  const messages: string[] = [];
  const codes: string[] = [];
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0 && visited.size < 16) {
    const value = queue.shift();
    if (value == null || visited.has(value)) continue;
    visited.add(value);

    if (typeof value === "string") {
      const message = value.trim();
      if (!message) continue;
      messages.push(message);
      if (message.startsWith("{")) {
        try {
          queue.push(JSON.parse(message) as unknown);
        } catch {
          // Keep the original provider string when it is not JSON.
        }
      }
      continue;
    }
    if (typeof value !== "object") continue;

    const item = value as ThoughtPathAcquisitionErrorLike;
    for (const candidate of [item.shortMessage, item.message, item.reason]) {
      if (typeof candidate === "string" && candidate.trim()) {
        messages.push(candidate.trim());
      }
    }
    if (typeof item.code === "string" || typeof item.code === "number") {
      codes.push(String(item.code).toUpperCase());
    }
    queue.push(
      item.error,
      item.cause,
      item.info,
      item.data,
      item.originalError,
    );
  }

  return {
    codes,
    messages,
    normalized: messages.join(" ").toLowerCase(),
  };
};

export const formatThoughtPathAcquisitionFailure = (
  error: unknown,
  currencyLabel: string,
): ThoughtPathAcquisitionFailure => {
  const { codes, messages, normalized } = collectPathAcquisitionErrorDetails(error);

  if (
    codes.includes("4001") ||
    codes.includes("ACTION_REJECTED") ||
    /user (?:rejected|denied|cancelled|canceled)|transaction rejected/.test(normalized)
  ) {
    return {
      title: "$PATH mint canceled",
      detail: "No transaction was submitted. No $PATH was created.",
      nextStep: "select “Try again” when ready",
    };
  }
  if (
    codes.includes("-32002") ||
    /already.*(?:pending|open)|request.*pending/.test(normalized)
  ) {
    return {
      title: "wallet request already open",
      detail: "Finish or cancel the request in your wallet.",
      nextStep: "then try again",
    };
  }
  if (/insufficient funds|exceeds balance/.test(normalized)) {
    return {
      title: "not enough funds",
      detail: `This wallet needs enough ${currencyLabel} for the $PATH price and gas.`,
      nextStep: `add ${currencyLabel}, then try again`,
    };
  }
  if (/ask_above_max_price/.test(normalized)) {
    return {
      title: "$PATH price changed",
      detail: "The price changed before your wallet submitted the transaction.",
      nextStep: "try again with the refreshed price",
    };
  }
  if (/one_bid_per_block/.test(normalized)) {
    return {
      title: "$PATH auction is settling",
      detail: "The previous bid is still in the latest block.",
      nextStep: "try again",
    };
  }
  if (/out of gas|reentrancy sentry/.test(normalized)) {
    return {
      title: "$PATH mint failed",
      detail: "The transaction did not have enough gas.",
      nextStep: "try again",
    };
  }
  if (/transaction reverted on-chain/.test(normalized)) {
    return {
      title: "$PATH mint failed",
      detail: "The transaction failed. No $PATH was created.",
      nextStep: "try again",
    };
  }
  if (
    /active local anvil|wallet rpc|failed to fetch|connection refused|network error/.test(normalized) ||
    (
      /could not coalesce error|internal json-rpc error/.test(normalized) &&
      !messages.some((message) =>
        !/could not coalesce error|internal json-rpc error/i.test(message)
      )
    )
  ) {
    return {
      title: "wallet is connected to the wrong local node",
      detail: "Set chain 31337 RPC to http://127.0.0.1:8546.",
      nextStep: "update the wallet network, then try again",
    };
  }
  if (/auction is not open yet/.test(normalized)) {
    return {
      title: "$PATH auction not open",
      detail: "The current $PATH sale has not started.",
      nextStep: "wait, then try again",
    };
  }
  if (
    /no in-place \$path auction configured|configured \$path auction deployment is unavailable|not wired to this thought|token approval flow/.test(
      normalized,
    )
  ) {
    return {
      title: "$PATH mint unavailable",
      detail: "This App cannot mint from the current $PATH auction.",
      nextStep: "open /path",
    };
  }
  return {
    title: "$PATH mint failed",
    detail: "The App could not complete the transaction.",
    nextStep: "try again, or open /path",
  };
};

export const withThoughtPathAcquisitionLock = async <T>(
  locks: PathMintLockManager | null | undefined,
  task: () => Promise<T>,
): Promise<ThoughtPathAcquisitionLockResult<T>> => {
  if (!locks || typeof locks.request !== "function") {
    // Web Locks requires a secure context and is unavailable on plain-HTTP LAN
    // dev URLs. Preserve same-page duplicate-submit protection there instead
    // of blocking the wallet flow entirely. Secure origins still coordinate
    // across tabs through the Web Locks branch below.
    return withFallbackThoughtPathAcquisitionLock(task);
  }

  let callbackStarted = false;
  try {
    return await locks.request(
      "inshell:thought:path-acquisition-submit:v1",
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        callbackStarted = true;
        if (!lock) {
          return Object.freeze({ acquired: false as const, reason: "busy" as const });
        }
        return Object.freeze({ acquired: true as const, value: await task() });
      },
    );
  } catch (error) {
    if (!callbackStarted) {
      return withFallbackThoughtPathAcquisitionLock(task);
    }
    throw error;
  }
};
