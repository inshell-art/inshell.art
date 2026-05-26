const DEFAULT_THOUGHT_GALLERY_API_URL = "/api/thought-gallery";
const THOUGHT_GALLERY_CACHE_TTL_MS = 60_000;
const THOUGHT_GALLERY_CACHE_KEY = "inshell:thought-gallery:v1";

export type ThoughtGalleryItem = {
  tokenId: number;
  pathId: string;
  minter: string;
  textHash: string;
  promptHash: string;
  provenanceHash: string;
  thoughtSpecId: string;
  thoughtSpecHash: string;
  mintedAt: number | null;
  rawText: string;
  prompt: string;
  mode: string;
  provider: string;
  model: string;
  returnedText: string;
  returnedTextHash: string;
  provenanceJson: string;
  image: string;
  tokenUri: string;
  txHash: string;
  blockNumber: number;
};

type ThoughtGalleryCachePayload = {
  cachedAt: number;
  thoughts: ThoughtGalleryItem[];
};

type ThoughtGalleryApiPayload = {
  thoughts?: unknown;
};

let thoughtGalleryMemoryCache: ThoughtGalleryCachePayload | null = null;

function getEnvValue(name: string): unknown {
  const envCache: Record<string, unknown> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, unknown> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env as
    | Record<string, unknown>
    | undefined;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
}

function readThoughtGalleryApiUrl() {
  const value = getEnvValue("VITE_THOUGHT_GALLERY_API_URL");
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_THOUGHT_GALLERY_API_URL;
}

function storage() {
  try {
    globalThis.localStorage?.getItem("__thought_gallery_cache_probe__");
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isThoughtGalleryItem(value: unknown): value is ThoughtGalleryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ThoughtGalleryItem>;
  return (
    typeof item.tokenId === "number" &&
    Number.isFinite(item.tokenId) &&
    typeof item.pathId === "string" &&
    typeof item.minter === "string" &&
    typeof item.textHash === "string" &&
    typeof item.promptHash === "string" &&
    typeof item.provenanceHash === "string" &&
    typeof item.thoughtSpecId === "string" &&
    typeof item.thoughtSpecHash === "string" &&
    (typeof item.mintedAt === "number" || item.mintedAt === null) &&
    typeof item.rawText === "string" &&
    typeof item.prompt === "string" &&
    typeof item.mode === "string" &&
    typeof item.provider === "string" &&
    typeof item.model === "string" &&
    typeof item.returnedText === "string" &&
    typeof item.returnedTextHash === "string" &&
    typeof item.provenanceJson === "string" &&
    typeof item.image === "string" &&
    typeof item.tokenUri === "string" &&
    typeof item.txHash === "string" &&
    typeof item.blockNumber === "number" &&
    Number.isFinite(item.blockNumber)
  );
}

function sortThoughts(thoughts: ThoughtGalleryItem[]) {
  return thoughts.slice().sort((left, right) => left.tokenId - right.tokenId);
}

function validPayload(payload: ThoughtGalleryCachePayload | null) {
  if (!payload || !Number.isFinite(payload.cachedAt)) return null;
  if (Date.now() - payload.cachedAt > THOUGHT_GALLERY_CACHE_TTL_MS) {
    return null;
  }
  if (!Array.isArray(payload.thoughts) || !payload.thoughts.every(isThoughtGalleryItem)) {
    return null;
  }
  return sortThoughts(payload.thoughts);
}

export function readCachedThoughtGallery(): ThoughtGalleryItem[] | null {
  const memory = validPayload(thoughtGalleryMemoryCache);
  if (memory) return memory;

  const raw = storage()?.getItem(THOUGHT_GALLERY_CACHE_KEY) ?? null;
  if (!raw) {
    thoughtGalleryMemoryCache = null;
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ThoughtGalleryCachePayload;
    const thoughts = validPayload(parsed);
    if (!thoughts) {
      storage()?.removeItem(THOUGHT_GALLERY_CACHE_KEY);
      thoughtGalleryMemoryCache = null;
      return null;
    }
    thoughtGalleryMemoryCache = parsed;
    return thoughts;
  } catch {
    storage()?.removeItem(THOUGHT_GALLERY_CACHE_KEY);
    thoughtGalleryMemoryCache = null;
    return null;
  }
}

function writeThoughtGalleryCache(thoughts: ThoughtGalleryItem[]) {
  const payload = {
    cachedAt: Date.now(),
    thoughts: sortThoughts(thoughts),
  };
  thoughtGalleryMemoryCache = payload;
  try {
    storage()?.setItem(THOUGHT_GALLERY_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Best-effort browser cache; the same-origin API remains authoritative.
  }
}

export async function loadThoughtGallery(options?: {
  cacheMode?: "default" | "bypass";
}): Promise<ThoughtGalleryItem[]> {
  if (typeof globalThis.fetch !== "function") {
    throw new Error("THOUGHT gallery API unavailable.");
  }

  const url = new globalThis.URL(
    readThoughtGalleryApiUrl(),
    globalThis.location?.origin ?? "https://inshell.art"
  );
  if (options?.cacheMode === "bypass") {
    url.searchParams.set("refresh", Date.now().toString());
  }

  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
    cache: options?.cacheMode === "bypass" ? "reload" : "default",
  });
  if (!response.ok) {
    throw new Error(`THOUGHT gallery API unavailable: ${response.status}`);
  }

  const payload = (await response.json()) as ThoughtGalleryApiPayload;
  if (!Array.isArray(payload.thoughts)) {
    throw new Error("THOUGHT gallery API returned invalid payload.");
  }

  const thoughts = sortThoughts(payload.thoughts.filter(isThoughtGalleryItem));
  writeThoughtGalleryCache(thoughts);
  return thoughts;
}
