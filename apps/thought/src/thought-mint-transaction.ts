export const THOUGHT_PENDING_MINT_TX_STORAGE_KEY =
  "thought-pending-mint-transaction-v1";
export const THOUGHT_CONFLICTING_MINT_TX_STORAGE_KEY =
  "thought-conflicting-mint-transactions-v1";

export type PendingMintTransaction = Readonly<{
  version: 1;
  attemptId?: string;
  hash: string;
  account: string;
  chainId: number;
  thoughtNft: string;
  workHash: string;
  pathId: string;
  nonce?: number;
  submittedAt: number;
}>;

export type MintSubmissionContext = Readonly<{
  attemptId: string;
  account: string;
  chainId: number;
  thoughtNft: string;
  workHash: string;
  pathId: string;
  nonce: number;
}>;

export type NewPendingMintTransaction = PendingMintTransaction &
  Readonly<{
    attemptId: string;
    nonce: number;
  }>;

export type PendingMintRestorePlan = Readonly<{
  transaction: PendingMintTransaction | null;
  source: "current" | "legacy" | null;
  persistedRaw: string | null;
  removeLegacy: boolean;
}>;

export type MintTrackingFailureCategory =
  | "timeout"
  | "transport"
  | "reverted"
  | "rejected"
  | "other";

export type MintTrackingFailure = Readonly<{
  category: MintTrackingFailureCategory;
  keepTracking: boolean;
}>;

export type MintReceiptStatusOutcome = "success" | "reverted" | "unknown";

export type MintTransactionReplacement = Readonly<{
  cancelled: boolean;
  reason: string;
  hash: string;
  receipt: unknown | null;
  replacement: unknown | null;
}>;

type MintErrorLike = {
  cancelled?: unknown;
  cause?: unknown;
  code?: unknown;
  data?: unknown;
  error?: unknown;
  info?: unknown;
  message?: unknown;
  originalError?: unknown;
  reason?: unknown;
  receipt?: unknown;
  replacement?: unknown;
  shortMessage?: unknown;
  status?: unknown;
};

const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

const normalizeRequiredText = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`invalid ${label}`);
  }
  return value.trim();
};

const normalizeHex = (value: unknown, pattern: RegExp, label: string) => {
  const normalized = normalizeRequiredText(value, label);
  if (!pattern.test(normalized)) {
    throw new Error(`invalid ${label}`);
  }
  return normalized.toLowerCase();
};

const normalizeChainId = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error("invalid chain id");
  }
  return Number(value);
};

const normalizeNonce = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error("invalid transaction nonce");
  }
  return Number(value);
};

const normalizeTimestamp = (value: unknown) => {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error("invalid submitted timestamp");
  }
  return Number(value);
};

const normalizePathId = (value: unknown) => {
  const normalized = typeof value === "bigint" ? value.toString() : String(value ?? "").trim();
  if (!POSITIVE_INTEGER_PATTERN.test(normalized)) {
    throw new Error("invalid $PATH id");
  }
  return normalized;
};

const normalizeAttemptId = (value: unknown, required: boolean) => {
  if (value === undefined && !required) return undefined;
  return normalizeRequiredText(value, "attempt id");
};

const normalizePendingMintTransaction = (
  value: Partial<PendingMintTransaction>,
): PendingMintTransaction => {
  if (value.version !== 1) {
    throw new Error("unsupported pending mint transaction version");
  }

  const attemptId = normalizeAttemptId(value.attemptId, false);
  const nonce = value.nonce === undefined ? undefined : normalizeNonce(value.nonce);
  return Object.freeze({
    version: 1,
    ...(attemptId ? { attemptId } : {}),
    hash: normalizeHex(value.hash, TRANSACTION_HASH_PATTERN, "transaction hash"),
    account: normalizeHex(value.account, ADDRESS_PATTERN, "account"),
    chainId: normalizeChainId(value.chainId),
    thoughtNft: normalizeHex(value.thoughtNft, ADDRESS_PATTERN, "THOUGHT contract"),
    workHash: normalizeHex(value.workHash, TRANSACTION_HASH_PATTERN, "work hash"),
    pathId: normalizePathId(value.pathId),
    ...(nonce === undefined ? {} : { nonce }),
    submittedAt: normalizeTimestamp(value.submittedAt),
  });
};

export const parsePendingMintTransaction = (
  raw: string | null | undefined,
): PendingMintTransaction | null => {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return null;
    }
    return normalizePendingMintTransaction(value as Partial<PendingMintTransaction>);
  } catch {
    return null;
  }
};

export const serializePendingMintTransaction = (
  transaction: PendingMintTransaction,
) => JSON.stringify(transaction);

export const parseConflictingMintTransactions = (
  raw: string | null | undefined,
): readonly PendingMintTransaction[] => {
  if (!raw?.trim()) return Object.freeze([]);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return Object.freeze([]);
    const seen = new Set<string>();
    const transactions = parsed.flatMap((value) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
      try {
        const transaction = normalizePendingMintTransaction(
          value as Partial<PendingMintTransaction>,
        );
        if (seen.has(transaction.hash)) return [];
        seen.add(transaction.hash);
        return [transaction];
      } catch {
        return [];
      }
    }).slice(-8);
    return Object.freeze(transactions);
  } catch {
    return Object.freeze([]);
  }
};

export const serializeConflictingMintTransactions = (
  transactions: readonly PendingMintTransaction[],
) => JSON.stringify(parseConflictingMintTransactions(JSON.stringify(transactions)));

export const planPendingMintRestore = ({
  currentRaw,
  legacySessionRaw,
}: {
  currentRaw: string | null;
  legacySessionRaw: string | null;
}): PendingMintRestorePlan => {
  const current = parsePendingMintTransaction(currentRaw);
  if (current) {
    return Object.freeze({
      transaction: current,
      source: "current",
      persistedRaw: serializePendingMintTransaction(current),
      removeLegacy: legacySessionRaw !== null,
    });
  }

  const legacy = parsePendingMintTransaction(legacySessionRaw);
  if (legacy) {
    return Object.freeze({
      transaction: legacy,
      source: "legacy",
      persistedRaw: serializePendingMintTransaction(legacy),
      removeLegacy: true,
    });
  }

  return Object.freeze({
    transaction: null,
    source: null,
    persistedRaw: null,
    removeLegacy: legacySessionRaw !== null,
  });
};

export const createMintSubmissionContext = (input: {
  attemptId: string;
  account: string;
  chainId: number;
  thoughtNft: string;
  workHash: string;
  pathId: string | bigint;
  nonce: number;
}): MintSubmissionContext => Object.freeze({
  attemptId: normalizeAttemptId(input.attemptId, true)!,
  account: normalizeHex(input.account, ADDRESS_PATTERN, "account"),
  chainId: normalizeChainId(input.chainId),
  thoughtNft: normalizeHex(input.thoughtNft, ADDRESS_PATTERN, "THOUGHT contract"),
  workHash: normalizeHex(input.workHash, TRANSACTION_HASH_PATTERN, "work hash"),
  pathId: normalizePathId(input.pathId),
  nonce: normalizeNonce(input.nonce),
});

export const createPendingMintTransaction = (
  context: MintSubmissionContext,
  transactionHash: string,
  submittedAt: number,
): NewPendingMintTransaction => Object.freeze({
  version: 1,
  attemptId: context.attemptId,
  hash: normalizeHex(transactionHash, TRANSACTION_HASH_PATTERN, "transaction hash"),
  account: context.account,
  chainId: context.chainId,
  thoughtNft: context.thoughtNft,
  workHash: context.workHash,
  pathId: context.pathId,
  nonce: context.nonce,
  submittedAt: normalizeTimestamp(submittedAt),
});

export const pendingMintTransactionMatches = (
  transaction: PendingMintTransaction | null | undefined,
  hash: string | null | undefined,
) => Boolean(
  transaction &&
  typeof hash === "string" &&
  TRANSACTION_HASH_PATTERN.test(hash) &&
  transaction.hash.toLowerCase() === hash.toLowerCase(),
);

export const replacePendingMintTransactionHash = (
  transaction: PendingMintTransaction,
  replacementHash: string,
): PendingMintTransaction => normalizePendingMintTransaction({
  ...transaction,
  hash: replacementHash,
});

export const mintReceiptStatusOutcome = (status: unknown): MintReceiptStatusOutcome => {
  if (status === 1 || status === 1n || status === true || status === "0x1") {
    return "success";
  }
  if (status === 0 || status === 0n || status === false || status === "0x0") {
    return "reverted";
  }
  return "unknown";
};

const objectValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

export const parseMintTransactionReplacement = (
  error: unknown,
): MintTransactionReplacement | null => {
  const item = objectValue(error);
  if (!item || String(item.code ?? "").toUpperCase() !== "TRANSACTION_REPLACED") {
    return null;
  }

  const replacement = objectValue(item.replacement);
  const receipt = objectValue(item.receipt);
  const hashCandidates = [replacement?.hash, receipt?.hash, receipt?.transactionHash];
  const hash = hashCandidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && TRANSACTION_HASH_PATTERN.test(candidate),
  );
  if (!hash) {
    return null;
  }

  const reason = typeof item.reason === "string" ? item.reason.trim().toLowerCase() : "";
  return Object.freeze({
    cancelled: item.cancelled === true || reason === "cancelled" || reason === "canceled",
    reason,
    hash: hash.toLowerCase(),
    receipt: receipt ?? null,
    replacement: replacement ?? null,
  });
};

const collectMintErrorDetails = (error: unknown) => {
  const messages: string[] = [];
  const codes: string[] = [];
  let receiptStatus: number | null = null;
  const queue: unknown[] = [error];
  const visited = new Set<unknown>();

  while (queue.length > 0 && visited.size < 16) {
    const value = queue.shift();
    if (value == null || visited.has(value)) continue;
    visited.add(value);

    if (typeof value === "string") {
      if (value.trim()) messages.push(value.trim());
      continue;
    }
    if (typeof value !== "object") continue;

    const item = value as MintErrorLike;
    for (const candidate of [item.shortMessage, item.message, item.reason]) {
      if (typeof candidate === "string" && candidate.trim()) {
        messages.push(candidate.trim());
      }
    }
    if (typeof item.code === "string" || typeof item.code === "number") {
      codes.push(String(item.code).toUpperCase());
    }
    if (item.status === 0) {
      receiptStatus = 0;
    }

    queue.push(
      item.error,
      item.cause,
      item.info,
      item.data,
      item.originalError,
      item.receipt,
    );
  }

  return {
    codes,
    normalized: messages.join(" ").toLowerCase(),
    receiptStatus,
  };
};

const includesCode = (codes: readonly string[], ...candidates: string[]) =>
  candidates.some((candidate) => codes.includes(candidate));

export const classifyMintTrackingFailure = (
  error: unknown,
  submittedHash: string | null | undefined,
): MintTrackingFailure => {
  const replacement = parseMintTransactionReplacement(error);
  if (replacement?.cancelled) {
    return Object.freeze({
      category: "rejected" as const,
      keepTracking: false,
    });
  }

  const { codes, normalized, receiptStatus } = collectMintErrorDetails(error);
  const hasSubmittedHash =
    typeof submittedHash === "string" && TRANSACTION_HASH_PATTERN.test(submittedHash);

  let category: MintTrackingFailureCategory = "other";
  if (
    receiptStatus === 0 ||
    includesCode(codes, "CALL_EXCEPTION") ||
    /\b(?:execution |transaction )?revert(?:ed)?\b/.test(normalized)
  ) {
    category = "reverted";
  } else if (
    includesCode(codes, "4001", "ACTION_REJECTED") ||
    /\b(?:reject(?:ed)?|denied|cancelled|canceled)\b/.test(normalized)
  ) {
    category = "rejected";
  } else if (
    includesCode(codes, "TIMEOUT", "ETIMEDOUT") ||
    /\b(?:timeout|timed out|time out)\b|not submitted/.test(normalized)
  ) {
    category = "timeout";
  } else if (
    includesCode(
      codes,
      "NETWORK_ERROR",
      "ECONNRESET",
      "ECONNREFUSED",
      "ENETUNREACH",
      "EHOSTUNREACH",
    ) ||
    /network|socket|connection|failed to fetch|temporarily unavailable|missing response/.test(
      normalized,
    )
  ) {
    category = "transport";
  }

  return Object.freeze({
    category,
    keepTracking: hasSubmittedHash && category !== "reverted",
  });
};
