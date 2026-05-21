export type WorkRunContext = {
  mode: string;
  provider: string;
  model: string;
  prompt: string;
  returnedText?: string;
  clientGeneratedAt: string;
  request?: {
    maxOutputTokens: 48 | 32 | "48" | "32" | "none";
    stop?: "\\n" | "none";
  };
  web?: {
    enabled: boolean;
    tool: string;
  };
  thoughtSpec?: {
    id: string;
    ref: string;
    hash: string;
  };
};

export type ThoughtWorkRecord = {
  id: number;
  prompt: string;
  returnedText: string;
  text: string;
  title: string;
  rawOutput: string;
  image: string;
  svg?: string;
  route: string;
  provider: string;
  model: string;
  thoughtSpec?: {
    id: string;
    ref: string;
    hash: string;
  };
  normalizer: {
    id: "thought.normalize.v1";
    source: "contract-view";
  };
  provenanceJson?: string;
  provenanceBytes?: number;
  hashes?: {
    promptHash?: string;
    returnedTextHash?: string;
    textHash?: string;
  };
  runContext: WorkRunContext;
  createdAt: string;
};

export type ThoughtWorkInput = {
  prompt?: string;
  returnedText?: string;
  text?: string;
  title: string;
  rawOutput: string;
  image: string;
  svg?: string;
  route?: string;
  provider?: string;
  model?: string;
  thoughtSpec?: {
    id: string;
    ref: string;
    hash: string;
  };
  normalizer?: {
    id: "thought.normalize.v1";
    source: "contract-view";
  };
  provenanceJson?: string;
  provenanceBytes?: number;
  hashes?: {
    promptHash?: string;
    returnedTextHash?: string;
    textHash?: string;
  };
  runContext: WorkRunContext;
  createdAt?: string;
};

export type WorkStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const THOUGHT_WORKS_STORAGE_KEY = "thought-works";
export const THOUGHT_WORKS_LIMIT = 80;

const isWorkRunContext = (value: unknown): value is WorkRunContext => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<WorkRunContext>;
  return (
    (
      candidate.mode === "connect" ||
      candidate.mode === "direct" ||
      candidate.mode === "local" ||
      candidate.mode === "my-brain"
    ) &&
    typeof candidate.provider === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.clientGeneratedAt === "string"
  );
};

export const sanitizeWorkRecord = (value: unknown): ThoughtWorkRecord | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<ThoughtWorkRecord>;
  const id = candidate.id;
  const runContext = candidate.runContext;
  if (
    !Number.isSafeInteger(id) ||
    id === undefined ||
    id <= 0 ||
    typeof candidate.title !== "string" ||
    !candidate.title.trim() ||
    typeof candidate.rawOutput !== "string" ||
    typeof candidate.image !== "string" ||
    typeof candidate.createdAt !== "string" ||
    !isWorkRunContext(runContext)
  ) {
    return null;
  }

  const text = typeof candidate.text === "string" && candidate.text.trim()
    ? candidate.text
    : candidate.title;
  const returnedText = typeof candidate.returnedText === "string"
    ? candidate.returnedText
    : candidate.rawOutput;
  const prompt = typeof candidate.prompt === "string" ? candidate.prompt : runContext.prompt;

  const record: ThoughtWorkRecord = {
    id,
    prompt,
    returnedText,
    text,
    title: candidate.title,
    rawOutput: candidate.rawOutput,
    image: candidate.image,
    route: typeof candidate.route === "string" ? candidate.route : runContext.mode,
    provider: typeof candidate.provider === "string" ? candidate.provider : runContext.provider,
    model: typeof candidate.model === "string" ? candidate.model : runContext.model,
    normalizer: candidate.normalizer ?? {
      id: "thought.normalize.v1",
      source: "contract-view",
    },
    runContext: {
      ...runContext,
      returnedText: runContext.returnedText ?? returnedText,
    },
    createdAt: candidate.createdAt,
  };

  if (typeof candidate.svg === "string") {
    record.svg = candidate.svg;
  }
  if (candidate.thoughtSpec ?? runContext.thoughtSpec) {
    record.thoughtSpec = candidate.thoughtSpec ?? runContext.thoughtSpec;
  }
  if (typeof candidate.provenanceJson === "string") {
    record.provenanceJson = candidate.provenanceJson;
  }
  if (typeof candidate.provenanceBytes === "number") {
    record.provenanceBytes = candidate.provenanceBytes;
  }
  if (candidate.hashes) {
    record.hashes = candidate.hashes;
  }

  return record;
};

export const readThoughtWorks = (
  storage: WorkStorage,
  storageKey = THOUGHT_WORKS_STORAGE_KEY,
) => {
  const raw = storage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .flatMap((record) => {
        const sanitized = sanitizeWorkRecord(record);
        return sanitized ? [sanitized] : [];
      })
      .slice(-THOUGHT_WORKS_LIMIT);
  } catch {
    return [];
  }
};

export const writeThoughtWorks = (
  storage: WorkStorage,
  works: ThoughtWorkRecord[],
  storageKey = THOUGHT_WORKS_STORAGE_KEY,
) => {
  if (!works.length) {
    storage.removeItem(storageKey);
    return;
  }

  storage.setItem(storageKey, JSON.stringify(works.slice(-THOUGHT_WORKS_LIMIT)));
};

export const appendThoughtWork = (
  existingWorks: ThoughtWorkRecord[],
  input: ThoughtWorkInput,
) => {
  const maxId = existingWorks.reduce((max, work) => Math.max(max, work.id), 0);
  const work: ThoughtWorkRecord = {
    id: maxId + 1,
    prompt: input.prompt ?? input.runContext.prompt,
    returnedText: input.returnedText ?? input.rawOutput,
    text: input.text ?? input.title,
    title: input.title,
    rawOutput: input.rawOutput,
    image: input.image,
    svg: input.svg,
    route: input.route ?? input.runContext.mode,
    provider: input.provider ?? input.runContext.provider,
    model: input.model ?? input.runContext.model,
    thoughtSpec: input.thoughtSpec ?? input.runContext.thoughtSpec,
    normalizer: input.normalizer ?? {
      id: "thought.normalize.v1",
      source: "contract-view",
    },
    provenanceJson: input.provenanceJson,
    provenanceBytes: input.provenanceBytes,
    hashes: input.hashes,
    runContext: {
      ...input.runContext,
      returnedText: input.runContext.returnedText ?? input.returnedText ?? input.rawOutput,
    },
    createdAt: input.createdAt ?? new Date().toISOString(),
  };

  return {
    work,
    works: [...existingWorks, work].slice(-THOUGHT_WORKS_LIMIT),
  };
};

export const parseWorkId = (value: string) => {
  const normalized = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const id = Number(normalized);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const getWorkById = (works: ThoughtWorkRecord[], id: number) =>
  works.find((work) => work.id === id) ?? null;

export const getPreviousWork = (
  works: ThoughtWorkRecord[],
  currentWorkId: number | null,
) => {
  if (!works.length) {
    return null;
  }

  if (currentWorkId === null) {
    return works[works.length - 1] ?? null;
  }

  const currentIndex = works.findIndex((work) => work.id === currentWorkId);
  if (currentIndex > 0) {
    return works[currentIndex - 1] ?? null;
  }

  if (currentIndex === -1) {
    return works[works.length - 1] ?? null;
  }

  return null;
};

export const getNextWork = (
  works: ThoughtWorkRecord[],
  currentWorkId: number | null,
) => {
  if (!works.length) {
    return null;
  }

  if (currentWorkId === null) {
    return works[0] ?? null;
  }

  const currentIndex = works.findIndex((work) => work.id === currentWorkId);
  if (currentIndex >= 0 && currentIndex < works.length - 1) {
    return works[currentIndex + 1] ?? null;
  }

  return null;
};

export const getLatestWork = (works: ThoughtWorkRecord[]) =>
  works[works.length - 1] ?? null;
