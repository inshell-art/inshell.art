import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  parseAbi,
  type Hex,
} from "viem";
import {
  getDefaultProvider,
  supportsRpcRequest,
  type ProviderInterface,
} from "@inshell/ethereum";

const DEFAULT_THOUGHT_GALLERY_API_URL = "/api/thought-gallery";
const THOUGHT_GALLERY_CACHE_TTL_MS = 60_000;
const THOUGHT_GALLERY_CACHE_KEY = "inshell:thought-gallery:v1";
const MAX_LOCAL_THOUGHT_SUPPLY = 10_000;
const LOCAL_THOUGHT_READ_BATCH_SIZE = 8;

const localThoughtNftAbi = parseAbi([
  "function totalSupply() view returns (uint256)",
  "function promptLineOf(uint256 tokenId) view returns (string)",
  "function agentLineOf(uint256 tokenId) view returns (string)",
  "function agentOf(uint256 tokenId) view returns (string)",
  "function modelOf(uint256 tokenId) view returns (string)",
  "function agentHashOf(uint256 tokenId) view returns (bytes32)",
  "function modelHashOf(uint256 tokenId) view returns (bytes32)",
  "function provenanceOf(uint256 tokenId) view returns (string)",
  "function promptLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function agentLineHashOf(uint256 tokenId) view returns (bytes32)",
  "function provenanceHashOf(uint256 tokenId) view returns (bytes32)",
  "function conversationIdentityHashOf(uint256 tokenId) view returns (bytes32)",
  "function workHashOf(uint256 tokenId) view returns (bytes32)",
  "function pathIdOf(uint256 tokenId) view returns (uint256)",
  "function pathSerialOf(uint256 tokenId) view returns (uint256)",
  "function authorOf(uint256 tokenId) view returns (address)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function mintedAtOf(uint256 tokenId) view returns (uint64)",
  "function creationAttestationDigestOf(uint256 tokenId) view returns (bytes32)",
  "function thoughtSpecOf(uint256 tokenId) view returns (bytes32 specId,bytes32 specHash,string specName,string ref)",
  "function svgOf(uint256 tokenId) view returns (string)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);

type LocalThoughtFunctionName =
  | "totalSupply"
  | "promptLineOf"
  | "agentLineOf"
  | "agentOf"
  | "modelOf"
  | "agentHashOf"
  | "modelHashOf"
  | "provenanceOf"
  | "promptLineHashOf"
  | "agentLineHashOf"
  | "provenanceHashOf"
  | "conversationIdentityHashOf"
  | "workHashOf"
  | "pathIdOf"
  | "pathSerialOf"
  | "authorOf"
  | "ownerOf"
  | "mintedAtOf"
  | "creationAttestationDigestOf"
  | "thoughtSpecOf"
  | "svgOf"
  | "tokenURI";

export type ThoughtGalleryItem = {
  tokenId: number;
  pathId: string;
  minter: string;
  textHash: string;
  promptHash: string;
  provenanceHash: string;
  thoughtSpecId: string;
  thoughtSpecHash: string;
  thoughtSpecName?: string;
  thoughtSpecRef?: string;
  mintedAt: number | null;
  rawText: string;
  prompt: string;
  mode: string;
  provider: string;
  agent?: string;
  model: string;
  agentHash?: string;
  modelHash?: string;
  /** Legacy API/cache fields retained while older deployments are read. */
  declaredAgent?: string;
  declaredModel?: string;
  declaredAgentHash?: string;
  declaredModelHash?: string;
  attestedAgent?: string;
  attestedModel?: string;
  returnedText: string;
  returnedTextHash: string;
  conversationIdentityHash?: string;
  workHash?: string;
  pathSerial?: string;
  currentOwner?: string;
  creationAttestationDigest?: string;
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
  const value = getEnvValue("VITE_GALLERY_API_URL") ?? getEnvValue("VITE_THOUGHT_GALLERY_API_URL");
  return typeof value === "string" && value.trim()
    ? value.trim()
    : DEFAULT_THOUGHT_GALLERY_API_URL;
}

function isLocalDevnet() {
  return String(getEnvValue("VITE_NETWORK") ?? "").toLowerCase() === "devnet";
}

function readLocalThoughtNftAddress() {
  const value =
    getEnvValue("VITE_THOUGHT_NFT") ??
    getEnvValue("VITE_THOUGHT_NFT_ADDRESS");
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeProvider(provider?: ProviderInterface) {
  if (provider && supportsRpcRequest(provider)) return provider;
  return getDefaultProvider();
}

async function localThoughtCall<T>(args: {
  provider: ProviderInterface;
  thoughtNftAddress: string;
  functionName: LocalThoughtFunctionName;
  functionArgs?: readonly unknown[];
}): Promise<T> {
  if (!supportsRpcRequest(args.provider)) {
    throw new Error("Local THOUGHT provider is missing JSON-RPC support.");
  }
  const data = encodeFunctionData({
    abi: localThoughtNftAbi,
    functionName: args.functionName,
    args: args.functionArgs ?? [],
  } as any);
  const result = (await args.provider.request?.({
    method: "eth_call",
    params: [
      {
        to: getAddress(args.thoughtNftAddress),
        data,
        gas: "0x5f5e100",
      },
      "latest",
    ],
  })) as Hex;
  if (!result || result === "0x") {
    throw new Error(`No local THOUGHT data returned from ${args.functionName}.`);
  }
  return decodeFunctionResult({
    abi: localThoughtNftAbi,
    functionName: args.functionName,
    data: result,
  } as any) as T;
}

function parseLocalProvenance(value: string) {
  const fallback = {
    mode: "",
    provider: "",
    model: "",
  };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as {
      route?: unknown;
      provider?: unknown;
      model?: unknown;
      process?: {
        kind?: unknown;
        agent?: {
          label?: unknown;
        };
        model?: {
          label?: unknown;
        };
        run?: {
          adapter?: unknown;
        };
      };
    };
    return {
      mode:
        typeof parsed.process?.kind === "string"
          ? parsed.process.kind
          : typeof parsed.route === "string"
            ? parsed.route
            : "",
      provider:
        typeof parsed.process?.run?.adapter === "string"
          ? parsed.process.run.adapter
          : typeof parsed.process?.agent?.label === "string"
            ? parsed.process.agent.label
            : typeof parsed.provider === "string"
              ? parsed.provider
              : "",
      model:
        typeof parsed.process?.model?.label === "string"
          ? parsed.process.model.label
            : typeof parsed.model === "string"
              ? parsed.model
              : "",
    };
  } catch {
    return fallback;
  }
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function parseThoughtTokenMetadata(tokenUri: string): Record<string, unknown> | null {
  if (!tokenUri.startsWith("data:application/json")) return null;
  const commaIndex = tokenUri.indexOf(",");
  if (commaIndex < 0) return null;
  const header = tokenUri.slice(0, commaIndex).toLowerCase();
  const body = tokenUri.slice(commaIndex + 1);
  try {
    const json = header.includes(";base64")
      ? new TextDecoder().decode(
          Uint8Array.from(globalThis.atob(body), (character) =>
            character.charCodeAt(0)
          )
        )
      : decodeURIComponent(body);
    const metadata = JSON.parse(json) as unknown;
    return metadata && typeof metadata === "object"
      ? (metadata as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function metadataTrait(
  metadata: Record<string, unknown> | null,
  traitType: string
) {
  const attributes = metadata?.attributes;
  if (!Array.isArray(attributes)) return undefined;
  const attribute = attributes.find(
    (candidate) =>
      candidate != null &&
      typeof candidate === "object" &&
      (candidate as Record<string, unknown>).trait_type === traitType
  ) as Record<string, unknown> | undefined;
  const value = attribute?.value;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function withCreationIdentity(
  thought: ThoughtGalleryItem
): ThoughtGalleryItem {
  const metadata = parseThoughtTokenMetadata(thought.tokenUri);
  const metadataAgent =
    metadataTrait(metadata, "Agent") ??
    metadataTrait(metadata, "Attested Agent");
  const metadataModel =
    metadataTrait(metadata, "Model") ??
    metadataTrait(metadata, "Attested Model");
  return {
    ...thought,
    agent:
      thought.agent ??
      metadataAgent ??
      thought.declaredAgent ??
      thought.attestedAgent,
    model:
      thought.model ??
      metadataModel ??
      thought.declaredModel ??
      thought.attestedModel ??
      "",
  };
}

async function readLocalThought(args: {
  provider: ProviderInterface;
  thoughtNftAddress: string;
  tokenId: number;
}): Promise<ThoughtGalleryItem> {
  const tokenArgs = [BigInt(args.tokenId)] as const;
  const [
    prompt,
    agentLine,
    agent,
    model,
    agentHash,
    modelHash,
    provenanceJson,
    promptHash,
    agentLineHash,
    provenanceHash,
    conversationIdentityHash,
    workHash,
    pathId,
    pathSerial,
    minter,
    currentOwner,
    mintedAt,
    creationAttestationDigest,
    thoughtSpec,
    svg,
    tokenUri,
  ] = await Promise.all([
    localThoughtCall<string>({
      ...args,
      functionName: "promptLineOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "agentLineOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "agentOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "modelOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "agentHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "modelHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "provenanceOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "promptLineHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "agentLineHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "provenanceHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "conversationIdentityHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "workHashOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<bigint>({
      ...args,
      functionName: "pathIdOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<bigint>({
      ...args,
      functionName: "pathSerialOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "authorOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "ownerOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<bigint>({
      ...args,
      functionName: "mintedAtOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<Hex>({
      ...args,
      functionName: "creationAttestationDigestOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<readonly [Hex, Hex, string, string]>({
      ...args,
      functionName: "thoughtSpecOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "svgOf",
      functionArgs: tokenArgs,
    }),
    localThoughtCall<string>({
      ...args,
      functionName: "tokenURI",
      functionArgs: tokenArgs,
    }),
  ]);
  const provenance = parseLocalProvenance(provenanceJson);
  const tokenMetadata = parseThoughtTokenMetadata(tokenUri);
  const metadataImage =
    typeof tokenMetadata?.image === "string" && tokenMetadata.image.trim()
      ? tokenMetadata.image
      : svgDataUri(svg);
  const creationIdentity = withCreationIdentity({
    tokenId: args.tokenId,
    pathId: pathId.toString(),
    minter,
    textHash: agentLineHash,
    promptHash,
    provenanceHash,
    thoughtSpecId: thoughtSpec[0],
    thoughtSpecHash: thoughtSpec[1],
    thoughtSpecName: thoughtSpec[2],
    thoughtSpecRef: thoughtSpec[3],
    mintedAt: Number(mintedAt),
    rawText: agentLine,
    prompt,
    mode: provenance.mode,
    provider: provenance.provider || agent,
    agent,
    model,
    agentHash,
    modelHash,
    returnedText: agentLine,
    returnedTextHash: agentLineHash,
    conversationIdentityHash,
    workHash,
    pathSerial: pathSerial.toString(),
    currentOwner,
    creationAttestationDigest,
    provenanceJson,
    image: metadataImage,
    tokenUri,
    txHash: "",
    blockNumber: 0,
  });

  return creationIdentity;
}

export async function loadThoughtGalleryItem(
  tokenId: number
): Promise<ThoughtGalleryItem | null> {
  if (!Number.isSafeInteger(tokenId) || tokenId < 1) return null;
  if (!isLocalDevnet()) {
    const thoughts = await loadThoughtGallery();
    return thoughts.find((thought) => thought.tokenId === tokenId) ?? null;
  }

  const thoughtNftAddress = readLocalThoughtNftAddress();
  if (!thoughtNftAddress) {
    throw new Error("Local THOUGHT contract is not configured.");
  }
  const provider = normalizeProvider();
  const totalSupply = await localThoughtCall<bigint>({
    provider,
    thoughtNftAddress,
    functionName: "totalSupply",
  });
  if (BigInt(tokenId) > totalSupply) return null;
  return readLocalThought({ provider, thoughtNftAddress, tokenId });
}

export async function loadLocalThoughtGallery(args?: {
  provider?: ProviderInterface;
  thoughtNftAddress?: string;
}): Promise<ThoughtGalleryItem[]> {
  const thoughtNftAddress =
    args?.thoughtNftAddress?.trim() || readLocalThoughtNftAddress();
  if (!thoughtNftAddress) {
    throw new Error("Local THOUGHT contract is not configured.");
  }
  const provider = normalizeProvider(args?.provider);
  const totalSupply = await localThoughtCall<bigint>({
    provider,
    thoughtNftAddress,
    functionName: "totalSupply",
  });
  if (totalSupply > BigInt(MAX_LOCAL_THOUGHT_SUPPLY)) {
    throw new Error(
      `Local THOUGHT supply ${totalSupply.toString()} exceeds the gallery read limit.`
    );
  }

  const tokenIds = Array.from(
    { length: Number(totalSupply) },
    (_, index) => index + 1
  );
  const thoughts: ThoughtGalleryItem[] = [];
  for (
    let start = 0;
    start < tokenIds.length;
    start += LOCAL_THOUGHT_READ_BATCH_SIZE
  ) {
    thoughts.push(
      ...(await Promise.all(
        tokenIds
          .slice(start, start + LOCAL_THOUGHT_READ_BATCH_SIZE)
          .map((tokenId) =>
            readLocalThought({ provider, thoughtNftAddress, tokenId })
          )
      ))
    );
  }
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
  return sortThoughts(payload.thoughts.map(withCreationIdentity));
}

export function readCachedThoughtGallery(): ThoughtGalleryItem[] | null {
  if (isLocalDevnet()) return null;
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
  if (isLocalDevnet()) return loadLocalThoughtGallery();
  if (typeof globalThis.fetch !== "function") {
    throw new Error("Gallery API unavailable.");
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
  if (!Array.isArray(payload.thoughts)) {
    throw new Error("Gallery API returned invalid payload.");
  }

  const thoughts = sortThoughts(
    payload.thoughts
      .filter(isThoughtGalleryItem)
      .map(withCreationIdentity)
  );
  writeThoughtGalleryCache(thoughts);
  return thoughts;
}
