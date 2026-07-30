export const THOUGHT_PATH_ACQUISITION_STORAGE_KEY =
  "inshell:thought:path-acquisition:v1";

export type ThoughtPathAcquisitionState =
  | "idle"
  | "quoting"
  | "review"
  | "awaiting_signature"
  | "submitted"
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
  | Readonly<{ acquired: false; reason: "busy" | "unsupported" }>;

export const withThoughtPathAcquisitionLock = async <T>(
  locks: PathMintLockManager | null | undefined,
  task: () => Promise<T>,
): Promise<ThoughtPathAcquisitionLockResult<T>> => {
  if (!locks || typeof locks.request !== "function") {
    return Object.freeze({ acquired: false as const, reason: "unsupported" as const });
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
      return Object.freeze({ acquired: false as const, reason: "unsupported" as const });
    }
    throw error;
  }
};
