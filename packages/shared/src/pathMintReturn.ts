export const PATH_MINT_RETURN_STORAGE_KEY_PREFIX =
  "inshell:path-mint-return:v1:";
export const PATH_MINT_RETURN_TTL_MS = 86_400_000;

export type PathMintReturnStatus = "submitted" | "confirmed";

export type PathMintReturnRecord = {
  version: 1;
  handoffId: string;
  status: PathMintReturnStatus;
  account: string;
  chainId: number;
  txHash: string;
  tokenId?: string;
  baselineTokenId?: number | null;
  updatedAt: number;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type PathMintReturnStorageHost = {
  localStorage?: StorageLike | null;
  sessionStorage?: StorageLike | null;
};

const HANDOFF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,95}$/;
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const EVM_TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const TOKEN_ID_PATTERN = /^(?:0|[1-9][0-9]*)$/;

export function isPathMintHandoffId(value: unknown): value is string {
  return typeof value === "string" && HANDOFF_ID_PATTERN.test(value);
}

export function pathMintReturnStorageKey(handoffId: string): string | null {
  return isPathMintHandoffId(handoffId)
    ? `${PATH_MINT_RETURN_STORAGE_KEY_PREFIX}${handoffId}`
    : null;
}

function parseStoredValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parsePathMintReturnRecord(
  value: unknown,
  expectedHandoffId?: string,
): PathMintReturnRecord | null {
  const parsed = parseStoredValue(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const candidate = parsed as Record<string, unknown>;
  if (candidate.version !== 1) return null;
  if (!isPathMintHandoffId(candidate.handoffId)) return null;
  if (
    expectedHandoffId !== undefined &&
    candidate.handoffId !== expectedHandoffId
  ) {
    return null;
  }
  if (candidate.status !== "submitted" && candidate.status !== "confirmed") {
    return null;
  }
  if (
    typeof candidate.account !== "string" ||
    !EVM_ADDRESS_PATTERN.test(candidate.account)
  ) {
    return null;
  }
  if (
    typeof candidate.chainId !== "number" ||
    !Number.isSafeInteger(candidate.chainId) ||
    candidate.chainId <= 0
  ) {
    return null;
  }
  if (
    typeof candidate.txHash !== "string" ||
    !EVM_TRANSACTION_HASH_PATTERN.test(candidate.txHash)
  ) {
    return null;
  }
  if (
    candidate.tokenId !== undefined &&
    (typeof candidate.tokenId !== "string" ||
      !TOKEN_ID_PATTERN.test(candidate.tokenId))
  ) {
    return null;
  }
  if (
    candidate.baselineTokenId !== undefined &&
    candidate.baselineTokenId !== null &&
    (typeof candidate.baselineTokenId !== "number" ||
      !Number.isSafeInteger(candidate.baselineTokenId) ||
      candidate.baselineTokenId < 0)
  ) {
    return null;
  }
  if (
    typeof candidate.updatedAt !== "number" ||
    !Number.isSafeInteger(candidate.updatedAt) ||
    candidate.updatedAt <= 0 ||
    (candidate.status === "confirmed" &&
      Date.now() - candidate.updatedAt > PATH_MINT_RETURN_TTL_MS)
  ) {
    return null;
  }

  return {
    version: 1,
    handoffId: candidate.handoffId,
    status: candidate.status,
    account: candidate.account.toLowerCase(),
    chainId: candidate.chainId,
    txHash: candidate.txHash.toLowerCase(),
    ...(candidate.tokenId === undefined
      ? {}
      : { tokenId: candidate.tokenId as string }),
    ...(candidate.baselineTokenId === undefined
      ? {}
      : { baselineTokenId: candidate.baselineTokenId as number | null }),
    updatedAt: candidate.updatedAt,
  };
}

function storageGet(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(
  storage: StorageLike | null | undefined,
  key: string,
  value: string,
): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(storage: StorageLike | null | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Browser storage is an optimization; callers keep their in-memory state.
  }
}

export function readPathMintReturnRecord(
  host: PathMintReturnStorageHost,
  handoffId: string,
): PathMintReturnRecord | null {
  const key = pathMintReturnStorageKey(handoffId);
  if (!key) return null;

  const localRecord = parsePathMintReturnRecord(
    storageGet(host.localStorage, key),
    handoffId,
  );
  const sessionRecord = parsePathMintReturnRecord(
    storageGet(host.sessionStorage, key),
    handoffId,
  );
  const record =
    localRecord && sessionRecord
      ? localRecord.updatedAt === sessionRecord.updatedAt
        ? localRecord.status === "confirmed"
          ? localRecord
          : sessionRecord
        : localRecord.updatedAt > sessionRecord.updatedAt
          ? localRecord
          : sessionRecord
      : localRecord ?? sessionRecord;
  if (!record) {
    storageRemove(host.localStorage, key);
    storageRemove(host.sessionStorage, key);
    return null;
  }

  // Keep one freshest durable copy whenever local storage is writable.
  if (storageSet(host.localStorage, key, JSON.stringify(record))) {
    storageRemove(host.sessionStorage, key);
  }
  return record;
}

export function writePathMintReturnRecord(
  host: PathMintReturnStorageHost,
  value: PathMintReturnRecord,
): boolean {
  const record = parsePathMintReturnRecord(value, value.handoffId);
  if (!record) return false;
  const key = pathMintReturnStorageKey(record.handoffId);
  if (!key) return false;
  const serialized = JSON.stringify(record);

  if (storageSet(host.localStorage, key, serialized)) {
    storageRemove(host.sessionStorage, key);
    return true;
  }
  return storageSet(host.sessionStorage, key, serialized);
}

export function removePathMintReturnRecord(
  host: PathMintReturnStorageHost,
  handoffId: string,
): void {
  const key = pathMintReturnStorageKey(handoffId);
  if (!key) return;
  storageRemove(host.localStorage, key);
  storageRemove(host.sessionStorage, key);
}
