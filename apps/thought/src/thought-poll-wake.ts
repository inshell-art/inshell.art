export const createThoughtPollWakeScheduler = () => {
  const pending = new Set<() => void>();
  let immediatePoll: (() => void) | null = null;

  const wait = (delayMs: number) => new Promise<void>((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timeoutId);
      pending.delete(finish);
      resolve();
    };
    timeoutId = setTimeout(finish, delayMs);
    pending.add(finish);
  });

  const wake = () => {
    for (const finish of [...pending]) {
      finish();
    }
  };

  const pollNow = () => {
    immediatePoll?.();
  };

  const setImmediatePoll = (poll: () => void) => {
    immediatePoll = poll;
  };

  const clearImmediatePoll = (poll?: () => void) => {
    if (!poll || immediatePoll === poll) {
      immediatePoll = null;
    }
  };

  return { wait, wake, pollNow, setImmediatePoll, clearImmediatePoll };
};

export const hasThoughtPollDeadlineExpired = (
  expiresAt: string | undefined,
  now = Date.now(),
) => {
  if (!expiresAt) {
    return false;
  }
  const deadline = Date.parse(expiresAt);
  return Number.isFinite(deadline) && deadline <= now;
};
