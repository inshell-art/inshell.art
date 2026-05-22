export type SurfaceInputMode = "command-first" | "question-first";

export type SurfaceTranscriptKind = "command" | "question" | "output" | "error" | "status";

export type SurfaceTranscriptEntry = {
  kind: SurfaceTranscriptKind;
  lines: string[];
  at: string;
};

export type SurfaceParsedInput = {
  raw: string;
  trimmed: string;
  mode: SurfaceInputMode;
  isBlank: boolean;
  isCommand: boolean;
  isQuestion: boolean;
  commandToken: string;
  commandKey: string;
  rest: string;
  args: string[];
  question: string;
};

export type SurfaceParseOptions = {
  mode: SurfaceInputMode;
  commandPrefix?: string | null;
  commands?: Iterable<string>;
};

export type SurfaceCommandResult =
  | void
  | string
  | string[]
  | SurfaceTranscriptEntry
  | SurfaceTranscriptEntry[];

export type SurfaceCommandContext<TContext = unknown> = {
  input: SurfaceParsedInput;
  shell: SurfaceShell<TContext>;
  context: TContext;
};

export type SurfaceCommand<TContext = unknown> = {
  id: string;
  aliases?: readonly string[];
  description?: string;
  usage?: string;
  hidden?: boolean;
  run: (context: SurfaceCommandContext<TContext>) => SurfaceCommandResult | Promise<SurfaceCommandResult>;
};

export type SurfaceCommandRegistration<TContext = unknown> = {
  command: SurfaceCommand<TContext>;
  keys: string[];
};

export type SurfaceCommandRegistry<TContext = unknown> = {
  list: () => SurfaceCommand<TContext>[];
  resolve: (token: string) => SurfaceCommand<TContext> | null;
  keys: () => string[];
};

export type SurfaceStorageAdapter = {
  read: (key: string) => string | null;
  write: (key: string, value: string) => void;
  remove: (key: string) => void;
};

export type BrowserStorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export type SurfaceRedactionMatch = {
  prefix: string;
  rest: string;
  replacement?: string;
  excludeFromHistory?: boolean;
};

export type SurfaceRedactionRule = {
  id: string;
  tokens?: readonly string[];
  mask?: string;
  allowRestValues?: readonly string[];
  excludeFromHistory?: boolean;
  match?: (input: string) => SurfaceRedactionMatch | null;
};

export type SurfaceShellOptions<TContext = unknown> = {
  mode: SurfaceInputMode;
  commandPrefix?: string | null;
  commands?: readonly SurfaceCommand<TContext>[];
  storage?: SurfaceStorageAdapter;
  historyKey?: string;
  transcriptKey?: string;
  historyLimit?: number;
  transcriptLimit?: number;
  redactionRules?: readonly SurfaceRedactionRule[];
  unknownCommandLines?: readonly string[];
  busyLines?: readonly string[];
};

export type SurfaceDispatchResult = {
  accepted: boolean;
  reason?: "blank" | "in_flight" | "unknown_command";
  input: SurfaceParsedInput;
  entries: SurfaceTranscriptEntry[];
};

export type SurfaceShell<TContext = unknown> = {
  parse: (raw: string) => SurfaceParsedInput;
  dispatch: (raw: string, context: TContext) => Promise<SurfaceDispatchResult>;
  isBusy: () => boolean;
  addTranscript: (entry: Omit<SurfaceTranscriptEntry, "at"> & { at?: string }) => SurfaceTranscriptEntry;
  clearTranscript: () => void;
  getTranscript: () => SurfaceTranscriptEntry[];
  loadTranscript: () => SurfaceTranscriptEntry[];
  recordHistory: (input: string) => void;
  getHistory: () => string[];
  loadHistory: () => string[];
  registry: SurfaceCommandRegistry<TContext>;
};

const DEFAULT_HISTORY_LIMIT = 80;
const DEFAULT_TRANSCRIPT_LIMIT = 80;
const DEFAULT_COMMAND_PREFIX = "/";
const DEFAULT_SECRET_MASK = "********";
const DEFAULT_UNKNOWN_COMMAND_LINES = ["unknown command.", "use: help."];
const DEFAULT_BUSY_LINES = ["command already running."];

const normalizeCommandKey = (value: string) => value.trim().toLowerCase();

const splitWhitespace = (value: string) => value.trim().split(/\s+/).filter(Boolean);

const nowIso = () => new Date().toISOString();

const readJsonArray = <T>(storage: SurfaceStorageAdapter | undefined, key: string): T[] => {
  if (!storage) return [];
  const raw = storage.read(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
};

const writeJsonArray = <T>(
  storage: SurfaceStorageAdapter | undefined,
  key: string,
  values: readonly T[],
) => {
  if (!storage) return;
  storage.write(key, JSON.stringify(values));
};

const normalizeLines = (value: string | readonly string[]) =>
  (Array.isArray(value) ? value : [value]).map((line) => String(line));

const resultToEntries = (result: SurfaceCommandResult): SurfaceTranscriptEntry[] => {
  if (result === undefined) return [];
  if (typeof result === "string" || (Array.isArray(result) && result.every((item) => typeof item === "string"))) {
    return [{
      kind: "output",
      lines: normalizeLines(result as string | string[]),
      at: nowIso(),
    }];
  }
  const entries = Array.isArray(result) ? result : [result];
  return entries.map((entry) => ({
    kind: entry.kind,
    lines: [...entry.lines],
    at: entry.at,
  }));
};

export function parseSurfaceInput(raw: string, options: SurfaceParseOptions): SurfaceParsedInput {
  const trimmed = raw.trim();
  const prefix = options.commandPrefix ?? (options.mode === "question-first" ? DEFAULT_COMMAND_PREFIX : null);
  const commandSet = new Set(Array.from(options.commands ?? [], normalizeCommandKey));

  if (!trimmed) {
    return {
      raw,
      trimmed,
      mode: options.mode,
      isBlank: true,
      isCommand: false,
      isQuestion: false,
      commandToken: "",
      commandKey: "",
      rest: "",
      args: [],
      question: "",
    };
  }

  if (options.mode === "question-first" && prefix && !trimmed.startsWith(prefix)) {
    return {
      raw,
      trimmed,
      mode: options.mode,
      isBlank: false,
      isCommand: false,
      isQuestion: true,
      commandToken: "",
      commandKey: "",
      rest: trimmed,
      args: splitWhitespace(trimmed),
      question: trimmed,
    };
  }

  const commandInput = options.mode === "question-first" && prefix && trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length).trimStart()
    : trimmed;
  const [commandToken = ""] = commandInput.split(/\s+/, 1);
  const commandKey = normalizeCommandKey(commandToken);
  const rest = commandInput.slice(commandToken.length).trim();
  const isKnownCommand = commandSet.size === 0 || commandSet.has(commandKey);
  const isCommand = commandToken.length > 0 && (options.mode === "command-first" || isKnownCommand);

  return {
    raw,
    trimmed,
    mode: options.mode,
    isBlank: false,
    isCommand,
    isQuestion: !isCommand,
    commandToken,
    commandKey,
    rest,
    args: splitWhitespace(rest),
    question: isCommand ? "" : trimmed,
  };
}

export function createSurfaceCommandRegistry<TContext = unknown>(
  commands: readonly SurfaceCommand<TContext>[] = [],
): SurfaceCommandRegistry<TContext> {
  const registrations = new Map<string, SurfaceCommand<TContext>>();
  for (const command of commands) {
    const keys = [command.id, ...(command.aliases ?? [])].map(normalizeCommandKey).filter(Boolean);
    for (const key of keys) {
      registrations.set(key, command);
    }
  }

  return {
    list: () => [...commands],
    resolve: (token) => registrations.get(normalizeCommandKey(token)) ?? null,
    keys: () => [...registrations.keys()],
  };
}

export function createMemoryStorageAdapter(seed: Record<string, string> = {}): SurfaceStorageAdapter {
  const values = new Map(Object.entries(seed));
  return {
    read: (key) => values.get(key) ?? null,
    write: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}

export function createBrowserLocalStorageAdapter(
  storage: BrowserStorageLike = globalThis.localStorage,
): SurfaceStorageAdapter {
  return {
    read: (key) => storage.getItem(key),
    write: (key, value) => {
      storage.setItem(key, value);
    },
    remove: (key) => {
      storage.removeItem(key);
    },
  };
}

export function createBrowserSessionStorageAdapter(
  storage: BrowserStorageLike = globalThis.sessionStorage,
): SurfaceStorageAdapter {
  return {
    read: (key) => storage.getItem(key),
    write: (key, value) => {
      storage.setItem(key, value);
    },
    remove: (key) => {
      storage.removeItem(key);
    },
  };
}

const matchTokenRule = (input: string, rule: SurfaceRedactionRule): SurfaceRedactionMatch | null => {
  if (!rule.tokens?.length) return null;
  const actualTokens = splitWhitespace(input);
  if (actualTokens.length < rule.tokens.length) return null;
  const expected = rule.tokens.map(normalizeCommandKey);
  const actual = actualTokens.slice(0, expected.length).map(normalizeCommandKey);
  if (!expected.every((token, index) => token === actual[index])) return null;
  const prefix = actualTokens.slice(0, expected.length).join(" ");
  const rest = input.slice(prefix.length).trim();
  const allowed = new Set((rule.allowRestValues ?? []).map(normalizeCommandKey));
  const restKey = normalizeCommandKey(rest);
  const allowHistory = !rest || allowed.has(restKey);
  return {
    prefix,
    rest,
    excludeFromHistory: rule.excludeFromHistory !== false && !allowHistory,
  };
};

export function findSurfaceRedactionMatch(
  input: string,
  rules: readonly SurfaceRedactionRule[] = [],
): SurfaceRedactionMatch | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  for (const rule of rules) {
    const match = rule.match?.(trimmed) ?? matchTokenRule(trimmed, rule);
    if (match) return match;
  }
  return null;
}

export function redactSurfaceInput(
  input: string,
  rules: readonly SurfaceRedactionRule[] = [],
): string {
  const match = findSurfaceRedactionMatch(input, rules);
  if (!match) return input;
  if (match.replacement !== undefined) return match.replacement;
  return match.rest ? `${match.prefix} ${DEFAULT_SECRET_MASK}` : input;
}

export function shouldRecordSurfaceInput(
  input: string,
  rules: readonly SurfaceRedactionRule[] = [],
): boolean {
  const match = findSurfaceRedactionMatch(input, rules);
  return match?.excludeFromHistory !== true;
}

export function createSurfaceShell<TContext = unknown>(
  options: SurfaceShellOptions<TContext>,
): SurfaceShell<TContext> {
  const registry = createSurfaceCommandRegistry(options.commands ?? []);
  const historyKey = options.historyKey ?? "surface-shell-history";
  const transcriptKey = options.transcriptKey ?? "surface-shell-transcript";
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const transcriptLimit = options.transcriptLimit ?? DEFAULT_TRANSCRIPT_LIMIT;
  const unknownCommandLines = [...(options.unknownCommandLines ?? DEFAULT_UNKNOWN_COMMAND_LINES)];
  const busyLines = [...(options.busyLines ?? DEFAULT_BUSY_LINES)];
  const redactionRules = [...(options.redactionRules ?? [])];
  const history: string[] = [];
  const transcript: SurfaceTranscriptEntry[] = [];
  let busy = false;

  const persistHistory = () => {
    writeJsonArray(options.storage, historyKey, history.slice(-historyLimit));
  };

  const persistTranscript = () => {
    writeJsonArray(options.storage, transcriptKey, transcript.slice(-transcriptLimit));
  };

  const shell: SurfaceShell<TContext> = {
    parse: (raw) => parseSurfaceInput(raw, {
      mode: options.mode,
      commandPrefix: options.commandPrefix,
      commands: registry.keys(),
    }),
    dispatch: async (raw, context) => {
      const input = shell.parse(raw);
      if (input.isBlank) {
        return { accepted: false, reason: "blank", input, entries: [] };
      }
      if (busy) {
        const entry = shell.addTranscript({ kind: "error", lines: busyLines });
        return { accepted: false, reason: "in_flight", input, entries: [entry] };
      }

      busy = true;
      try {
        shell.recordHistory(input.trimmed);
        shell.addTranscript({
          kind: input.isCommand ? "command" : "question",
          lines: [redactSurfaceInput(input.trimmed, redactionRules)],
        });

        const command = input.isCommand ? registry.resolve(input.commandKey) : null;
        if (!command) {
          const entry = shell.addTranscript({ kind: "error", lines: unknownCommandLines });
          return { accepted: false, reason: "unknown_command", input, entries: [entry] };
        }

        const resultEntries = resultToEntries(await command.run({ input, shell, context }));
        const appended = resultEntries.map((entry) => shell.addTranscript(entry));
        return { accepted: true, input, entries: appended };
      } finally {
        busy = false;
      }
    },
    isBusy: () => busy,
    addTranscript: (entry) => {
      const normalized: SurfaceTranscriptEntry = {
        kind: entry.kind,
        lines: [...entry.lines],
        at: entry.at ?? nowIso(),
      };
      transcript.push(normalized);
      if (transcript.length > transcriptLimit) {
        transcript.splice(0, transcript.length - transcriptLimit);
      }
      persistTranscript();
      return normalized;
    },
    clearTranscript: () => {
      transcript.length = 0;
      options.storage?.remove(transcriptKey);
    },
    getTranscript: () => [...transcript],
    loadTranscript: () => {
      const stored = readJsonArray<SurfaceTranscriptEntry>(options.storage, transcriptKey)
        .filter((entry) =>
          typeof entry?.kind === "string" &&
          Array.isArray(entry.lines) &&
          entry.lines.every((line) => typeof line === "string")
        )
        .slice(-transcriptLimit);
      transcript.splice(0, transcript.length, ...stored);
      return [...transcript];
    },
    recordHistory: (input) => {
      const trimmed = input.trim();
      if (!trimmed || !shouldRecordSurfaceInput(trimmed, redactionRules)) return;
      if (history[history.length - 1] !== trimmed) history.push(trimmed);
      if (history.length > historyLimit) {
        history.splice(0, history.length - historyLimit);
      }
      persistHistory();
    },
    getHistory: () => [...history],
    loadHistory: () => {
      const stored = readJsonArray<string>(options.storage, historyKey)
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && shouldRecordSurfaceInput(entry, redactionRules))
        .slice(-historyLimit);
      history.splice(0, history.length, ...stored);
      return [...history];
    },
    registry,
  };

  shell.loadHistory();
  shell.loadTranscript();
  return shell;
}
