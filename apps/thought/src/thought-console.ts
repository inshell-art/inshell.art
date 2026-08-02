export type ThoughtConsoleTone = "neutral" | "success" | "warning" | "error";
export type ThoughtConsoleVisualRole = "standard" | "guidance";

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
  nextStep?: string;
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
  /**
   * Short-lived projections such as live prices, open controls, and `checking`
   * states belong in the live panel rather than retained history.
   */
  transient?: boolean;
};

export type ThoughtConsoleBoundaryInput = {
  time: string;
  context: ThoughtConsoleContext;
  kind?: string;
  title?: string;
  detail?: string;
  nextStep?: string;
  tone?: ThoughtConsoleTone;
};

export type ThoughtConsoleEntry = {
  id: string;
  dedupeKey: string;
  kind: string;
  time: string;
  title: string;
  detail?: string;
  nextStep?: string;
  context: ThoughtConsoleContext;
  tone: ThoughtConsoleTone;
  boundary: boolean;
};

export type ThoughtConsoleHistory = {
  version: typeof THOUGHT_CONSOLE_HISTORY_VERSION;
  entries: ThoughtConsoleEntry[];
};

const THOUGHT_CONSOLE_GUIDANCE_KINDS = new Set([
  "work_agent_selection_ready",
  "work_waiting_for_agent",
  "work_claim_authorization_needed",
  "work_ready",
  "path_selected",
  "authorization_signed",
  "wallet_connection_requested",
  "authorization_requested",
  "transaction_requested",
  "transaction_confirmed",
  "path_acquisition_wallet",
  "pending_mint_preserved",
  "wallet_mint_request_preserved",
  "wallet_changed_after_submission",
  "mint_activity_checked",
]);

export const thoughtConsoleVisualRole = (
  entry: Pick<ThoughtConsoleEntry, "kind" | "tone">,
): ThoughtConsoleVisualRole =>
  entry.tone === "warning" ||
  entry.tone === "error" ||
  THOUGHT_CONSOLE_GUIDANCE_KINDS.has(entry.kind)
    ? "guidance"
    : "standard";

export const newestFirstThoughtConsoleEntries = (
  entries: ThoughtConsoleEntry[],
): ThoughtConsoleEntry[] => {
  const timeGroups: ThoughtConsoleEntry[][] = [];
  entries.forEach((entry) => {
    const currentGroup = timeGroups.at(-1);
    if (currentGroup?.at(-1)?.time === entry.time) {
      currentGroup.push(entry);
      return;
    }
    timeGroups.push([entry]);
  });

  return timeGroups.reverse().flatMap((group) => {
    const guidance: ThoughtConsoleEntry[] = [];
    const standard: ThoughtConsoleEntry[] = [];
    group.forEach((entry) => {
      (thoughtConsoleVisualRole(entry) === "guidance"
        ? guidance
        : standard
      ).push(entry);
    });
    return [...guidance.reverse(), ...standard.reverse()];
  });
};

export const THOUGHT_CONSOLE_HISTORY_VERSION = 1 as const;
export const THOUGHT_CONSOLE_HISTORY_LIMIT = 80;
export const THOUGHT_CONSOLE_HISTORY_STORAGE_KEY =
  "inshell:thought:console-history:v1";
export const THOUGHT_EXISTS_CONSOLE_NEXT_STEP =
  "view the existing THOUGHT, or reset and create a new one";

// Earlier releases retained live projections and inferred context boundaries.
// Neither is a confirmed product event. Drop them while restoring history so
// stale panel state and wallet-hydration races do not survive an upgrade.
const LEGACY_NON_EVENT_KINDS = new Set([
  "attempt_started",
  "checking_paths",
  "deployment_changed",
  "network_changed",
  "path_acquisition_quote",
  "path_inventory_loaded",
  "wallet_changed",
  "wallet_connected",
  "wallet_disconnected",
  "wallet_needed",
  "work_changed",
]);

const IDEMPOTENT_OUTCOME_KINDS = new Set([
  "thought_exists",
  "transaction_confirmed",
]);

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
  nextStep = "",
}: ThoughtConsoleInput) => {
  const normalizedTitle = normalizeConsoleText(title);
  const normalizedDetailLines = detail
    .replace(/([.!?])\s+(?=Allowed:)/g, "$1\n")
    .split(/\r?\n/)
    .map(normalizeConsoleText)
    .filter(Boolean);
  const normalizedNextStep = normalizeConsoleText(nextStep);
  const lines = [`[${normalizeConsoleText(time)}] ${normalizedTitle}`];

  normalizedDetailLines.forEach((line) => {
    if (!sameThoughtConsoleDetail(normalizedTitle, line)) {
      lines.push(line);
    }
  });

  if (normalizedNextStep) {
    lines.push(`next: ${normalizedNextStep}`);
  }

  return lines;
};

type NormalizedThoughtConsoleEvent = Omit<ThoughtConsoleEventInput, "actions"> & {
  context: ThoughtConsoleContext;
  detail?: string;
  nextStep?: string;
  eventId?: string;
  tone: ThoughtConsoleTone;
};

const normalizeThoughtConsoleEvent = (
  event: ThoughtConsoleEventInput,
): NormalizedThoughtConsoleEvent => {
  const title = normalizeConsoleText(event.title);
  const detail = normalizeOptionalConsoleText(event.detail);
  const actionNeeded = event.tone === "warning" || event.tone === "error";
  const nextStep = actionNeeded
    ? normalizeOptionalConsoleText(event.nextStep)
    : undefined;
  return {
    time: normalizeConsoleText(event.time),
    title,
    ...(detail && !sameThoughtConsoleDetail(title, detail) ? { detail } : {}),
    ...(nextStep ? { nextStep } : {}),
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
    event.nextStep?.toLowerCase() ?? "",
    event.tone,
  ].join("|");
  const dedupeKey = event.eventId
    ? `event|${event.eventId}`
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
    ...(event.nextStep ? { nextStep: event.nextStep } : {}),
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

  // Context is metadata for an event, not evidence that an action happened.
  // Callers must provide the semantic boundary they actually observed.
  if (!input.kind || !input.title) {
    return history;
  }
  return appendNormalizedThoughtConsoleEvent(
    history,
    {
      time: normalizeConsoleText(input.time),
      kind: normalizeConsoleText(input.kind),
      title: normalizeConsoleText(input.title),
      detail: normalizeOptionalConsoleText(input.detail),
      ...(normalizeOptionalConsoleText(input.nextStep)
        ? { nextStep: normalizeOptionalConsoleText(input.nextStep) }
        : {}),
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
  return appendNormalizedThoughtConsoleEvent(history, event, options);
};

export type PendingMintWalletChangeInput = {
  previousAddress: string;
  previousChainId: number | null;
  nextAddress: string;
  nextChainId: number | null;
  trackedAddress: string;
  trackedChainId: number;
};

export const pendingMintWalletChangeTitle = ({
  previousAddress,
  previousChainId,
  nextAddress,
  nextChainId,
  trackedAddress,
  trackedChainId,
}: PendingMintWalletChangeInput) => {
  const previous = normalizeAccount(previousAddress) ?? "";
  const next = normalizeAccount(nextAddress) ?? "";
  const tracked = normalizeAccount(trackedAddress) ?? "";

  if (previous === next && previousChainId === nextChainId) {
    return null;
  }
  // Returning to the wallet and network that own the tracked transaction is
  // not a safety event. This also absorbs the shared wallet's empty-then-ready
  // hydration sequence.
  if (
    next === tracked &&
    nextChainId === trackedChainId
  ) {
    return null;
  }
  if (!next) {
    return "active wallet disconnected";
  }
  if (next !== tracked) {
    return "active wallet changed";
  }
  return "wallet network changed";
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
  const actionNeeded = value.tone === "warning" || value.tone === "error";
  const nextStep = actionNeeded
    ? normalizeOptionalConsoleText(value.nextStep)
    : undefined;
  const kind = normalizeConsoleText(value.kind);

  return {
    id: normalizeConsoleText(value.id),
    dedupeKey: normalizeConsoleText(value.dedupeKey),
    kind,
    time: normalizeConsoleText(value.time),
    title,
    ...(detail && !sameThoughtConsoleDetail(title, detail) ? { detail } : {}),
    ...(kind === "thought_exists"
      ? { nextStep: THOUGHT_EXISTS_CONSOLE_NEXT_STEP }
      : nextStep
        ? { nextStep }
        : {}),
    context: normalizedContext,
    tone: value.tone,
    boundary: value.boundary,
  };
};

const collapseRestoredIdempotentOutcomes = (entries: ThoughtConsoleEntry[]) => {
  const seen = new Set<string>();
  return entries
    .slice()
    .reverse()
    .filter((entry) => {
      if (!IDEMPOTENT_OUTCOME_KINDS.has(entry.kind)) return true;
      const key = [
        entry.kind,
        entry.context.workHash ?? "",
        entry.title.toLowerCase(),
        entry.detail?.toLowerCase() ?? "",
      ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reverse();
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
    const entries = value.entries
      .map(parseThoughtConsoleEntry)
      .filter((entry): entry is ThoughtConsoleEntry => entry !== null)
      .filter((entry) => !LEGACY_NON_EVENT_KINDS.has(entry.kind));
    return {
      version: THOUGHT_CONSOLE_HISTORY_VERSION,
      entries: trimThoughtConsoleEntries(
        collapseRestoredIdempotentOutcomes(entries),
        options.limit ?? THOUGHT_CONSOLE_HISTORY_LIMIT,
      ),
    };
  } catch {
    return createThoughtConsoleHistory();
  }
};
