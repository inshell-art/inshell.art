import { THOUGHT_V2_PRODUCTION_DEPLOYMENT } from "../../../thought/src/thought-v2-production-deployment";
import { createPublicClient, http, parseAbi } from "viem";

const DEFAULT_THOUGHT_GALLERY_API_URL = "/api/thought-gallery";
const THOUGHT_GALLERY_CACHE_TTL_MS = 60_000;
const THOUGHT_GALLERY_CACHE_NAMESPACE = "inshell:thought-gallery";
const THOUGHT_GALLERY_CACHE_PREFIX = `${THOUGHT_GALLERY_CACHE_NAMESPACE}:`;
const LEGACY_THOUGHT_GALLERY_CACHE_KEY = "inshell:thought-gallery:v1";
type LocalThoughtRuntime = {
  schema?: unknown;
  status?: unknown;
  generatedAt?: unknown;
  chainId?: unknown;
  rpcUrl?: unknown;
  artifact?: {
    artifactId?: unknown;
    manifestSha256?: unknown;
  };
  contracts?: {
    thoughtNft?: unknown;
  };
  localLane?: {
    id?: unknown;
    isolation?: unknown;
  };
};

declare global {
  // Injected only by the devnet home server. Production builds always receive null.
  var __INSHELL_THOUGHT_CONTRACT_RUNTIME__: LocalThoughtRuntime | null | undefined;
}

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const localRuntime = globalThis.__INSHELL_THOUGHT_CONTRACT_RUNTIME__;
const LOCAL_THOUGHT_GALLERY_DEPLOYMENT =
  localRuntime?.schema === "inshell.thought.v2.anvil-gallery-runtime.v1" &&
  localRuntime.status === "ready" &&
  localRuntime.localLane?.id === "thought" &&
  localRuntime.localLane?.isolation === "dedicated-anvil" &&
  Number.isSafeInteger(localRuntime.chainId) &&
  typeof localRuntime.artifact?.artifactId === "string" &&
  typeof localRuntime.artifact?.manifestSha256 === "string" &&
  typeof localRuntime.contracts?.thoughtNft === "string" &&
  addressPattern.test(localRuntime.contracts.thoughtNft)
    ? {
      artifactId: localRuntime.artifact.artifactId,
      manifestSha256: localRuntime.artifact.manifestSha256,
      chainId: Number(localRuntime.chainId),
      contracts: {
        thoughtNft: localRuntime.contracts.thoughtNft.toLowerCase() as `0x${string}`,
      },
      generatedAt:
        typeof localRuntime.generatedAt === "string"
          ? localRuntime.generatedAt
          : "local-runtime-generation-unavailable",
      rpcUrl:
        typeof localRuntime.rpcUrl === "string" ? localRuntime.rpcUrl : "",
    }
    : null;

const THOUGHT_GALLERY_DEPLOYMENT =
  THOUGHT_V2_PRODUCTION_DEPLOYMENT ?? LOCAL_THOUGHT_GALLERY_DEPLOYMENT;
const THOUGHT_GALLERY_CACHE_KEY = THOUGHT_GALLERY_DEPLOYMENT
  ? [
    THOUGHT_GALLERY_CACHE_NAMESPACE,
    "v2",
    THOUGHT_GALLERY_DEPLOYMENT.chainId,
    THOUGHT_GALLERY_DEPLOYMENT.contracts.thoughtNft.toLowerCase(),
    THOUGHT_GALLERY_DEPLOYMENT.artifactId,
    THOUGHT_GALLERY_DEPLOYMENT.manifestSha256,
    "generatedAt" in THOUGHT_GALLERY_DEPLOYMENT
      ? THOUGHT_GALLERY_DEPLOYMENT.generatedAt
      : "production",
  ].join(":")
  : null;

const LOCAL_THOUGHT_ABI = parseAbi([
  "event ThoughtMinted(uint256 indexed tokenId,address indexed minter,bytes32 indexed workHash,bytes32 promptLineHash,bytes32 agentLineHash,bytes32 conversationIdentityHash,uint256 pathId,uint256 pathSerial,bytes32 thoughtSpecId,bytes32 thoughtSpecHash)",
  "function promptLineOf(uint256 tokenId) view returns (string)",
  "function agentLineOf(uint256 tokenId) view returns (string)",
  "function provenanceOf(uint256 tokenId) view returns (string)",
  "function provenanceHashOf(uint256 tokenId) view returns (bytes32)",
  "function mintedAtOf(uint256 tokenId) view returns (uint64)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

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
  artifactId?: unknown;
  manifestSha256?: unknown;
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
  const value = getEnvValue("VITE_GALLERY_API_URL") ?? getEnvValue("VITE_THOUGHT_GALLERY_API_URL");
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_THOUGHT_GALLERY_API_URL;
}

function readLocalThoughtRpcUrl() {
  const configured = getEnvValue("VITE_THOUGHT_RPC_URL");
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }
  return LOCAL_THOUGHT_GALLERY_DEPLOYMENT?.rpcUrl || "";
}

function decodeDataUriText(uri: string) {
  const comma = uri.indexOf(",");
  if (!uri.startsWith("data:") || comma === -1) return "";
  const header = uri.slice(0, comma);
  const body = uri.slice(comma + 1);
  if (!header.includes(";base64")) return decodeURIComponent(body);
  const binary = globalThis.atob(body);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (character) => character.charCodeAt(0)),
  );
}

function readTokenImage(tokenUri: string) {
  try {
    const metadata = JSON.parse(decodeDataUriText(tokenUri)) as { image?: unknown };
    return typeof metadata.image === "string" ? metadata.image : "";
  } catch {
    return "";
  }
}

function readProvenanceContext(provenanceJson: string) {
  try {
    const provenance = JSON.parse(provenanceJson) as {
      process?: {
        kind?: unknown;
        run?: { adapter?: unknown };
        agent?: { label?: unknown };
        model?: { label?: unknown };
      };
    };
    const process = provenance.process;
    return {
      mode: typeof process?.kind === "string" ? process.kind : "",
      provider:
        typeof process?.run?.adapter === "string"
          ? process.run.adapter
          : typeof process?.agent?.label === "string"
            ? process.agent.label
            : process?.kind === "manual" ? "me" : "",
      model: typeof process?.model?.label === "string" ? process.model.label : "",
    };
  } catch {
    return { mode: "", provider: "", model: "" };
  }
}

async function loadLocalThoughtGallery(): Promise<ThoughtGalleryItem[]> {
  const deployment = LOCAL_THOUGHT_GALLERY_DEPLOYMENT;
  const rpcUrl = readLocalThoughtRpcUrl();
  if (!deployment || !rpcUrl) {
    throw new Error("Local THOUGHT gallery runtime unavailable.");
  }
  const client = createPublicClient({ transport: http(rpcUrl) });
  const logs = await client.getLogs({
    address: deployment.contracts.thoughtNft,
    event: LOCAL_THOUGHT_ABI[0],
    fromBlock: 0n,
    toBlock: "latest",
  });
  const thoughts = await Promise.all(logs.map(async (log) => {
    const args = log.args;
    const tokenId = args.tokenId as bigint;
    const [prompt, agentLine, provenanceJson, provenanceHash, mintedAt, tokenUri] =
      await Promise.all([
        client.readContract({
          address: deployment.contracts.thoughtNft,
          abi: LOCAL_THOUGHT_ABI,
          functionName: "promptLineOf",
          args: [tokenId],
        }),
        client.readContract({
          address: deployment.contracts.thoughtNft,
          abi: LOCAL_THOUGHT_ABI,
          functionName: "agentLineOf",
          args: [tokenId],
        }),
        client.readContract({
          address: deployment.contracts.thoughtNft,
          abi: LOCAL_THOUGHT_ABI,
          functionName: "provenanceOf",
          args: [tokenId],
        }),
        client.readContract({
          address: deployment.contracts.thoughtNft,
          abi: LOCAL_THOUGHT_ABI,
          functionName: "provenanceHashOf",
          args: [tokenId],
        }),
        client.readContract({
          address: deployment.contracts.thoughtNft,
          abi: LOCAL_THOUGHT_ABI,
          functionName: "mintedAtOf",
          args: [tokenId],
        }),
        client.readContract({
          address: deployment.contracts.thoughtNft,
          abi: LOCAL_THOUGHT_ABI,
          functionName: "tokenURI",
          args: [tokenId],
        }),
      ]);
    const context = readProvenanceContext(provenanceJson);
    return {
      tokenId: Number(tokenId),
      pathId: (args.pathId as bigint).toString(),
      minter: String(args.minter),
      textHash: String(args.agentLineHash),
      promptHash: String(args.promptLineHash),
      provenanceHash: String(provenanceHash),
      thoughtSpecId: String(args.thoughtSpecId),
      thoughtSpecHash: String(args.thoughtSpecHash),
      mintedAt: Number(mintedAt),
      rawText: agentLine,
      prompt,
      mode: context.mode,
      provider: context.provider,
      model: context.model,
      returnedText: agentLine,
      returnedTextHash: String(args.agentLineHash),
      provenanceJson,
      image: readTokenImage(tokenUri),
      tokenUri,
      txHash: log.transactionHash,
      blockNumber: Number(log.blockNumber),
    } satisfies ThoughtGalleryItem;
  }));
  return sortThoughts(thoughts);
}

function storage() {
  try {
    globalThis.localStorage?.getItem("__thought_gallery_cache_probe__");
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function clearThoughtGalleryCaches() {
  thoughtGalleryMemoryCache = null;
  const browserStorage = storage();
  if (!browserStorage) return;
  const keys: string[] = [];
  for (let index = 0; index < browserStorage.length; index += 1) {
    const key = browserStorage.key(index);
    if (key?.startsWith(THOUGHT_GALLERY_CACHE_PREFIX)) keys.push(key);
  }
  keys.push(LEGACY_THOUGHT_GALLERY_CACHE_KEY);
  for (const key of new Set(keys)) browserStorage.removeItem(key);
}

export function isThoughtGalleryDeploymentActive() {
  return THOUGHT_GALLERY_DEPLOYMENT !== null;
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
  return thoughts.slice().sort((left, right) => right.tokenId - left.tokenId);
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
  if (!THOUGHT_GALLERY_DEPLOYMENT || !THOUGHT_GALLERY_CACHE_KEY) {
    clearThoughtGalleryCaches();
    return null;
  }
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
  if (!THOUGHT_GALLERY_DEPLOYMENT || !THOUGHT_GALLERY_CACHE_KEY) return;
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
  if (!THOUGHT_GALLERY_DEPLOYMENT) {
    clearThoughtGalleryCaches();
    throw new Error("Current THOUGHT collection is not deployed.");
  }
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Gallery API unavailable.");
  }

  if (LOCAL_THOUGHT_GALLERY_DEPLOYMENT) {
    if (options?.cacheMode !== "bypass") {
      const cached = readCachedThoughtGallery();
      if (cached) return cached;
    }
    const thoughts = await loadLocalThoughtGallery();
    writeThoughtGalleryCache(thoughts);
    return thoughts;
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
    throw new Error(`Gallery API unavailable: ${response.status}`);
  }

  const payload = (await response.json()) as ThoughtGalleryApiPayload;
  if (
    payload.artifactId !== THOUGHT_GALLERY_DEPLOYMENT.artifactId ||
    payload.manifestSha256 !== THOUGHT_GALLERY_DEPLOYMENT.manifestSha256 ||
    !Array.isArray(payload.thoughts)
  ) {
    throw new Error("Gallery API returned invalid payload.");
  }

  const thoughts = sortThoughts(payload.thoughts.filter(isThoughtGalleryItem));
  writeThoughtGalleryCache(thoughts);
  return thoughts;
}
