export type PathMintSubmissionLockResult =
  | "acquired"
  | "busy"
  | "unsupported";

type PathMintLockManager = {
  request(
    name: string,
    options: { mode: "exclusive"; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<void>,
  ): Promise<void>;
};

export async function withPathMintSubmissionLock(
  handoffId: string,
  task: () => Promise<void>,
): Promise<PathMintSubmissionLockResult> {
  const lockManager = (
    typeof navigator === "undefined"
      ? null
      : (navigator as globalThis.Navigator & {
          locks?: PathMintLockManager;
        })
  )?.locks;
  if (typeof lockManager?.request !== "function") return "unsupported";

  let result: PathMintSubmissionLockResult = "busy";
  let taskFailure: { error: unknown } | null = null;
  try {
    await lockManager.request(
      `inshell:path-mint-submit:${handoffId}`,
      { mode: "exclusive", ifAvailable: true },
      async (lock) => {
        if (!lock) return;
        result = "acquired";
        try {
          await task();
        } catch (error) {
          taskFailure = { error };
        }
      },
    );
  } catch {
    // An inaccessible Web Locks implementation cannot safely coordinate tabs.
    return "unsupported";
  }

  if (taskFailure) throw taskFailure.error;
  return result;
}
