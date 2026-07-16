export type ThoughtConsoleTone = "neutral" | "success" | "warning" | "error";

export type ThoughtConsoleContext = {
  attemptId: string;
  workHash?: string;
  account?: string;
  chainId?: string | number;
  deploymentFingerprint?: string;
};

export type ThoughtConsoleInput = {
  time: string;
  title: string;
  detail?: string;
  /**
   * @deprecated Controls belong to the live panel, not to its retained history.
   * Kept temporarily so older callers can migrate without rendering `next:` lines.
   */
  actions?: string[];
};

export type ThoughtConsoleEventInput = ThoughtConsoleInput & {
  /** A call-site supplied idempotency key, such as a request or transaction id. */
  eventId?: string;
  kind: string;
  context: ThoughtConsoleContext;
  tone?: ThoughtConsoleTone;
  /** Short-lived projections such as `checking` never belong in retained history. */
  transient?: boolean;
};

export type ThoughtConsoleBoundaryInput = {
  time: string;
  context: ThoughtConsoleContext;
  kind?: string;
  title?: string;
  detail?: string;
  tone?: ThoughtConsoleTone;
};

export type ThoughtConsoleEntry = {
  id: string;
  dedupeKey: string;
  kind: string;
  time: string;
  title: string;
  detail?: string;
  context: ThoughtConsoleContext;
  tone: ThoughtConsoleTone;
  boundary: boolean;
};

export type ThoughtConsoleHistory = {
  version: typeof THOUGHT_CONSOLE_HISTORY_VERSION;
  entries: ThoughtConsoleEntry[];
};

export const THOUGHT_CONSOLE_HISTORY_VERSION = 1 as const;
export const THOUGHT_CONSOLE_HISTORY_LIMIT = 80;
export const THOUGHT_CONSOLE_HISTORY_STORAGE_KEY =
  "inshell:thought:console-history:v1";

const normalizeConsoleText = (value: string) => value.trim();

const normalizeOptionalConsoleText = (value: unknown) => {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeConsoleText(value);
  return normalized || undefined;
};

const normalizeAccount = (account: unknown) =>
  normalizeOptionalConsoleText(account)?.toLowerCase();

const normalizeChainId = (chainId: unknown) => {
  if (typeof chainId === "number" && Number.isSafeInteger(chainId) && chainId >= 0) {
    return String(chainId);
  }
  return normalizeOptionalConsoleText(chainId);
};

const normalizeThoughtConsoleContext = (
  context: ThoughtConsoleContext,
): ThoughtConsoleContext => ({
  attemptId: normalizeConsoleText(context.attemptId) || "legacy",
  ...(normalizeOptionalConsoleText(context.workHash)
    ? { workHash: normalizeOptionalConsoleText(context.workHash) }
    : {}),
  ...(normalizeAccount(context.account)
    ? { account: normalizeAccount(context.account) }
    : {}),
  ...(normalizeChainId(context.chainId)
    ? { chainId: normalizeChainId(context.chainId) }
    : {}),
  ...(normalizeOptionalConsoleText(context.deploymentFingerprint)
    ? {
        deploymentFingerprint: normalizeOptionalConsoleText(
          context.deploymentFingerprint,
        ),
      }
    : {}),
});

const thoughtConsoleContextKey = (context: ThoughtConsoleContext) =>
  [
    context.attemptId,
    context.workHash ?? "",
    context.account ?? "",
    context.chainId ?? "",
    context.deploymentFingerprint ?? "",
  ].join("|");

const sameThoughtConsoleContext = (
  left: ThoughtConsoleContext,
  right: ThoughtConsoleContext,
) => thoughtConsoleContextKey(left) === thoughtConsoleContextKey(right);

const sameThoughtConsoleDetail = (title: string, detail?: string) =>
  detail?.toLowerCase() === title.toLowerCase();

const compactAccount = (account?: string) => {
  if (!account || account.length <= 13) return account ?? "none";
  return `${account.slice(0, 6)}…${account.slice(-4)}`;
};

const hashConsoleKey = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const trimThoughtConsoleEntries = (
  entries: ThoughtConsoleEntry[],
  limit: number,
) => entries.slice(-Math.max(1, limit));

export const createThoughtConsoleHistory = (): ThoughtConsoleHistory => ({
  version: THOUGHT_CONSOLE_HISTORY_VERSION,
  entries: [],
});

export const buildThoughtConsoleLines = ({
  time,
  title,
  detail = "",
}: ThoughtConsoleInput) => {
  const normalizedTitle = normalizeConsoleText(title);
  const normalizedDetail = normalizeConsoleText(detail);
  const lines = [`[${normalizeConsoleText(time)}] ${normalizedTitle}`];

  if (
    normalizedDetail &&
    !sameThoughtConsoleDetail(normalizedTitle, normalizedDetail)
  ) {
    lines.push(normalizedDetail);
  }

  return lines;
};

type NormalizedThoughtConsoleEvent = Omit<ThoughtConsoleEventInput, "actions"> & {
  context: ThoughtConsoleContext;
  detail?: string;
  eventId?: string;
  tone: ThoughtConsoleTone;
};

const normalizeThoughtConsoleEvent = (
  event: ThoughtConsoleEventInput,
): NormalizedThoughtConsoleEvent => {
  const title = normalizeConsoleText(event.title);
  const detail = normalizeOptionalConsoleText(event.detail);
  return {
    time: normalizeConsoleText(event.time),
    title,
    ...(detail && !sameThoughtConsoleDetail(title, detail) ? { detail } : {}),
    ...(normalizeOptionalConsoleText(event.eventId)
      ? { eventId: normalizeOptionalConsoleText(event.eventId) }
      : {}),
    kind: normalizeConsoleText(event.kind) || "activity",
    context: normalizeThoughtConsoleContext(event.context),
    tone: event.tone ?? "neutral",
    transient: event.transient ?? false,
  };
};

const appendNormalizedThoughtConsoleEvent = (
  history: ThoughtConsoleHistory,
  event: NormalizedThoughtConsoleEvent,
  options: { boundary?: boolean; limit?: number } = {},
) => {
  if (event.transient) return history;

  const contextKey = thoughtConsoleContextKey(event.context);
  const contentKey = [
    contextKey,
    event.kind,
    event.title.toLowerCase(),
    event.detail?.toLowerCase() ?? "",
    event.tone,
  ].join("|");
  const dedupeKey = event.eventId
    ? `event|${contextKey}|${event.eventId}`
    : `content|${contentKey}`;
  const isDuplicate = event.eventId
    ? history.entries.some((entry) => entry.dedupeKey === dedupeKey)
    : history.entries.at(-1)?.dedupeKey === dedupeKey;

  if (isDuplicate) return history;

  const idSeed = [
    dedupeKey,
    event.time,
    history.entries.at(-1)?.id ?? "start",
  ].join("|");
  const entry: ThoughtConsoleEntry = {
    id: `thought-console-${hashConsoleKey(idSeed)}`,
    dedupeKey,
    kind: event.kind,
    time: event.time,
    title: event.title,
    ...(event.detail ? { detail: event.detail } : {}),
    context: event.context,
    tone: event.tone,
    boundary: options.boundary ?? false,
  };

  return {
    version: THOUGHT_CONSOLE_HISTORY_VERSION,
    entries: trimThoughtConsoleEntries(
      [...history.entries, entry],
      options.limit ?? THOUGHT_CONSOLE_HISTORY_LIMIT,
    ),
  } satisfies ThoughtConsoleHistory;
};

const boundaryPresentation = (
  previous: ThoughtConsoleContext,
  next: ThoughtConsoleContext,
) => {
  if (previous.account !== next.account) {
    if (!previous.account) {
      return {
        kind: "wallet_connected",
        title: "wallet connected",
        detail: compactAccount(next.account),
      };
    }
    if (!next.account) {
      return {
        kind: "wallet_disconnected",
        title: "wallet disconnected",
        detail: `${compactAccount(previous.account)}; PATH selection and permission cleared`,
      };
    }
    return {
      kind: "wallet_changed",
      title: "wallet changed",
      detail: `${compactAccount(previous.account)} → ${compactAccount(next.account)}; PATH selection and permission cleared`,
    };
  }
  if (previous.chainId !== next.chainId) {
    return {
      kind: "network_changed",
      title: "network changed",
      detail: `${previous.chainId ?? "none"} → ${next.chainId ?? "none"}; PATH selection and permission cleared`,
    };
  }
  if (previous.workHash !== next.workHash) {
    return {
      kind: "work_changed",
      title: "work changed",
      detail: "previous PATH selection and permission cleared",
    };
  }
  if (previous.deploymentFingerprint !== next.deploymentFingerprint) {
    return {
      kind: "deployment_changed",
      title: "deployment changed",
      detail: "PATH inventory and permission cleared",
    };
  }
  return {
    kind: "attempt_started",
    title: "mint attempt started",
    detail: compactAccount(next.account),
  };
};

export const appendThoughtConsoleContextBoundary = (
  history: ThoughtConsoleHistory,
  input: ThoughtConsoleBoundaryInput,
  options: { limit?: number } = {},
): ThoughtConsoleHistory => {
  const context = normalizeThoughtConsoleContext(input.context);
  const previousContext = history.entries.at(-1)?.context;
  if (!previousContext || sameThoughtConsoleContext(previousContext, context)) {
    return history;
  }

  const presentation = boundaryPresentation(previousContext, context);
  return appendNormalizedThoughtConsoleEvent(
    history,
    {
      time: normalizeConsoleText(input.time),
      kind: normalizeOptionalConsoleText(input.kind) ?? presentation.kind,
      title: normalizeOptionalConsoleText(input.title) ?? presentation.title,
      detail: normalizeOptionalConsoleText(input.detail) ?? presentation.detail,
      context,
      tone: input.tone ?? "neutral",
      transient: false,
    },
    { boundary: true, limit: options.limit },
  );
};

export const appendThoughtConsoleEvent = (
  history: ThoughtConsoleHistory,
  input: ThoughtConsoleEventInput,
  options: { limit?: number } = {},
): ThoughtConsoleHistory => {
  const event = normalizeThoughtConsoleEvent(input);
  if (event.transient) return history;

  const previousContext = history.entries.at(-1)?.context;
  let nextHistory = history;
  if (previousContext && !sameThoughtConsoleContext(previousContext, event.context)) {
    nextHistory = appendThoughtConsoleContextBoundary(
      history,
      {
        time: event.time,
        context: event.context,
      },
      options,
    );
  }

  return appendNormalizedThoughtConsoleEvent(nextHistory, event, options);
};

export const serializeThoughtConsoleHistory = (
  history: ThoughtConsoleHistory,
) => JSON.stringify(history);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseThoughtConsoleEntry = (value: unknown): ThoughtConsoleEntry | null => {
  if (!isRecord(value) || !isRecord(value.context)) return null;
  const { context } = value;
  if (
    typeof value.id !== "string" ||
    typeof value.dedupeKey !== "string" ||
    typeof value.kind !== "string" ||
    typeof value.time !== "string" ||
    typeof value.title !== "string" ||
    typeof value.tone !== "string" ||
    typeof value.boundary !== "boolean" ||
    typeof context.attemptId !== "string"
  ) {
    return null;
  }
  if (
    value.tone !== "neutral" &&
    value.tone !== "success" &&
    value.tone !== "warning" &&
    value.tone !== "error"
  ) {
    return null;
  }

  const normalizedContext = normalizeThoughtConsoleContext({
    attemptId: context.attemptId,
    ...(typeof context.workHash === "string" ? { workHash: context.workHash } : {}),
    ...(typeof context.account === "string" ? { account: context.account } : {}),
    ...(typeof context.chainId === "string" || typeof context.chainId === "number"
      ? { chainId: context.chainId }
      : {}),
    ...(typeof context.deploymentFingerprint === "string"
      ? { deploymentFingerprint: context.deploymentFingerprint }
      : {}),
  });
  const title = normalizeConsoleText(value.title);
  const detail = normalizeOptionalConsoleText(value.detail);

  return {
    id: normalizeConsoleText(value.id),
    dedupeKey: normalizeConsoleText(value.dedupeKey),
    kind: normalizeConsoleText(value.kind),
    time: normalizeConsoleText(value.time),
    title,
    ...(detail && !sameThoughtConsoleDetail(title, detail) ? { detail } : {}),
    context: normalizedContext,
    tone: value.tone,
    boundary: value.boundary,
  };
};

export const parseThoughtConsoleHistory = (
  serialized: unknown,
  options: { limit?: number } = {},
): ThoughtConsoleHistory => {
  if (typeof serialized !== "string" || serialized.length > 200_000) {
    return createThoughtConsoleHistory();
  }

  try {
    const value: unknown = JSON.parse(serialized);
    if (
      !isRecord(value) ||
      value.version !== THOUGHT_CONSOLE_HISTORY_VERSION ||
      !Array.isArray(value.entries)
    ) {
      return createThoughtConsoleHistory();
    }
    return {
      version: THOUGHT_CONSOLE_HISTORY_VERSION,
      entries: trimThoughtConsoleEntries(
        value.entries
          .map(parseThoughtConsoleEntry)
          .filter((entry): entry is ThoughtConsoleEntry => entry !== null),
        options.limit ?? THOUGHT_CONSOLE_HISTORY_LIMIT,
      ),
    };
  } catch {
    return createThoughtConsoleHistory();
  }
};
