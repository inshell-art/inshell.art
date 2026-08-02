export const THOUGHT_MINT_SUBMISSION_LOCK_NAME = "inshell:thought:mint-submission:v1";

type LockLike = { name?: string };

type LocksLike = {
  request<T>(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: LockLike | null) => Promise<T>,
  ): Promise<T>;
};

type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
};

export type MintSubmissionLockHandle = Readonly<{
  ownerId: string;
  kind: "web-lock" | "same-page";
  ownsExclusion: () => boolean;
}>;

export type MintSubmissionLockEnvironment = {
  locks?: LocksLike | null;
  crypto: CryptoLike;
  allowSamePageFallback?: boolean;
};

export type MintSubmissionLockResult<T> =
  | Readonly<{ acquired: true; value: T }>
  | Readonly<{ acquired: false; reason: "busy" | "unavailable" }>;

export type RecoverableMintSubmissionOutcome<T> =
  | Readonly<{ kind: "settled"; value: T }>
  | Readonly<{ kind: "rejected"; error: unknown }>
  | Readonly<{ kind: "released" }>;

export const waitForMintSubmissionOrRelease = async <T>(
  submission: Promise<T>,
  release: Promise<void>,
): Promise<RecoverableMintSubmissionOutcome<T>> => Promise.race([
  submission.then(
    (value) => Object.freeze({ kind: "settled" as const, value }),
    (error) => Object.freeze({ kind: "rejected" as const, error }),
  ),
  release.then(() => Object.freeze({ kind: "released" as const })),
]);

const randomHex = (crypto: CryptoLike, bytes = 16) => {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
};

export const createMintAttemptId = (
  prefix: string,
  crypto: CryptoLike,
  now = Date.now(),
) => {
  const normalizedPrefix = prefix.replace(/[^A-Za-z0-9-]/g, "-").replace(/^-+/, "") || "mint";
  const entropy = crypto.randomUUID?.().replace(/[^A-Za-z0-9-]/g, "") || randomHex(crypto);
  return `${normalizedPrefix}-${Math.max(0, now).toString(36)}-${entropy}`.slice(0, 96);
};

let fallbackMintSubmissionLockOwnerId: string | null = null;

const withFallbackMintSubmissionLock = async <T>(
  environment: MintSubmissionLockEnvironment,
  task: (handle: MintSubmissionLockHandle) => Promise<T>,
): Promise<MintSubmissionLockResult<T>> => {
  if (fallbackMintSubmissionLockOwnerId !== null) {
    return Object.freeze({ acquired: false as const, reason: "busy" as const });
  }

  const ownerId = createMintAttemptId("mint-lock", environment.crypto);
  fallbackMintSubmissionLockOwnerId = ownerId;
  try {
    const value = await task(Object.freeze({
      ownerId,
      kind: "same-page" as const,
      ownsExclusion: () => fallbackMintSubmissionLockOwnerId === ownerId,
    }));
    return Object.freeze({ acquired: true as const, value });
  } finally {
    if (fallbackMintSubmissionLockOwnerId === ownerId) {
      fallbackMintSubmissionLockOwnerId = null;
    }
  }
};

export const withMintSubmissionLock = async <T>(
  environment: MintSubmissionLockEnvironment,
  task: (handle: MintSubmissionLockHandle) => Promise<T>,
): Promise<MintSubmissionLockResult<T>> => {
  const locks = environment.locks;
  if (!locks || typeof locks.request !== "function") {
    if (environment.allowSamePageFallback) {
      return withFallbackMintSubmissionLock(environment, task);
    }
    return Object.freeze({ acquired: false as const, reason: "unavailable" as const });
  }

  const ownerId = createMintAttemptId("mint-lock", environment.crypto);
  let callbackStarted = false;
  try {
    return await locks.request(
      THOUGHT_MINT_SUBMISSION_LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        callbackStarted = true;
        if (!lock) {
          return Object.freeze({ acquired: false as const, reason: "busy" as const });
        }
        const value = await task(Object.freeze({
          ownerId,
          kind: "web-lock" as const,
          ownsExclusion: () => true,
        }));
        return Object.freeze({ acquired: true as const, value });
      },
    );
  } catch (error) {
    // A browser can expose navigator.locks but reject access (for example in a
    // restricted context). Fail closed before the wallet request. Errors from
    // inside the protected task still belong to the normal mint error flow.
    if (!callbackStarted) {
      if (environment.allowSamePageFallback) {
        return withFallbackMintSubmissionLock(environment, task);
      }
      return Object.freeze({ acquired: false as const, reason: "unavailable" as const });
    }
    throw error;
  }
};
