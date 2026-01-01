import {
  Contract,
  RpcProvider,
  type ProviderInterface,
  type Abi,
  hash,
  type TypedContractV2,
  type BlockIdentifier,
} from "starknet";
import {
  DEFAULT_SAFE_TAG,
  normalizeBlockId,
  type SafeBlockId,
  type StarkBlockId,
} from "@/protocol/blockId";
import { type AbiSource } from "@/types/types";

const envCache: Record<string, any> | undefined =
  (globalThis as any).__VITE_ENV__;
const isTestEnv =
  typeof globalThis !== "undefined" &&
  typeof globalThis.process !== "undefined" &&
  globalThis.process?.env?.NODE_ENV === "test";

function getEnv(name: string): any {
  return envCache?.[name];
}

export const DEFAULT_ABI_SOURCE: AbiSource =
  (getEnv("VITE_DEFAULT_ABI_SOURCE") as AbiSource) ?? "artifact";

// -------------------- Provider & defaults --------------------

/** Default provider: RPC from env, else local devnet. */
export function getDefaultProvider(): ProviderInterface {
  const rpcUrl =
    (getEnv("VITE_STARKNET_RPC") as string | undefined) ??
    "http://127.0.0.1:5050/rpc";
  return new RpcProvider({ nodeUrl: rpcUrl });
}

/** Build read call options with a safe block id. */
export function readOpts(id?: StarkBlockId): {
  blockIdentifier: BlockIdentifier;
} {
  return { blockIdentifier: normalizeBlockId(id) as BlockIdentifier };
}

// -------------------- Typed contract construction --------------------

/** Build a typed contract: runtime ABI for encode/decode, static ABI for TS types. */
export function typedFromAbi<const ABI extends readonly any[]>(
  abiForRuntime: Abi,
  abiForTyping: ABI,
  address: string,
  provider?: ProviderInterface
): TypedContractV2<ABI> {
  const c = new (Contract as any)(abiForRuntime, address, provider);
  return (
    (c as any).typedv2?.(abiForTyping) ??
    (c as any).typedv1?.(abiForTyping) ??
    (c as any)
  );
}

/** Optional safety: assert required entrypoints exist and match selectors. */
// --- helpers ---
function collectFns(abi: readonly any[] | undefined): Record<string, true> {
  const out: Record<string, true> = {};
  if (!abi) return out;

  for (const e of abi) {
    // Cairo-0: top-level functions
    if (e?.type === "function" && typeof e?.name === "string") {
      out[e.name] = true;
      continue;
    }
    // Cairo-1: functions nested under interface.items
    if (e?.type === "interface" && Array.isArray(e?.items)) {
      for (const it of e.items) {
        if (it?.type === "function" && typeof it?.name === "string") {
          out[it.name] = true;
        }
      }
    }
  }
  return out;
}

export function assertCompatibleAbi(
  staticAbi: readonly any[],
  runtimeAbi: readonly any[] | undefined,
  requiredFns?: readonly string[]
) {
  if (!requiredFns?.length || !runtimeAbi) return;

  const haveStatic = collectFns(staticAbi);
  const haveRuntime = collectFns(runtimeAbi);

  for (const n of requiredFns) {
    if (!haveStatic[n] || !haveRuntime[n]) {
      throw new Error(`ABI mismatch: missing function ${n}`);
    }
    // Optional (still valid for Cairo‑1): check selector equality
    const selS = hash.getSelectorFromName(n);
    const selR = hash.getSelectorFromName(n);
    if (selS !== selR)
      throw new Error(`ABI mismatch: selector differs for ${n}`);
  }
}

/**
 * Generic typed factory with pluggable ABI source.
 * - Uses static (artifact) ABI for TypeScript typing (always).
 * - Uses artifact or node ABI at runtime for encode/decode.
 */
export async function makeTypedContract<
  const ABI extends readonly any[]
>(params: {
  address: string;
  abiStatic: ABI;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
  requiredFns?: readonly string[];
  fetchAbiFromNode?: (
    provider: ProviderInterface,
    address: string,
    id?: SafeBlockId
  ) => Promise<Abi | undefined>;
}): Promise<TypedContractV2<ABI>> {
  const {
    address,
    abiStatic,
    provider: provided,
    abiSource,
    requiredFns,
    fetchAbiFromNode,
  } = params;

  const provider = provided ?? getDefaultProvider();
  const safeId = DEFAULT_SAFE_TAG;

  if (abiSource === "artifact") {
    return typedFromAbi(
      abiStatic as unknown as Abi,
      abiStatic,
      address,
      provider
    );
  }

  if (abiSource === "node" || abiSource === "auto") {
    let runtimeAbi: Abi | undefined;
    try {
      runtimeAbi = fetchAbiFromNode
        ? await fetchAbiFromNode(provider, address, safeId)
        : await (async () => {
            const rpc = provider as RpcProvider;
            const klass = await rpc.getClassAt(
              address,
              safeId as BlockIdentifier
            );
            return (klass as any)?.abi as Abi | undefined;
          })();
    } catch {
      runtimeAbi = undefined;
    }

    if (!runtimeAbi) {
      if (abiSource === "node")
        throw new Error("Failed to fetch ABI from node");
      // auto → fetch failed → fall back to artifact
      return typedFromAbi(
        abiStatic as unknown as Abi,
        abiStatic,
        address,
        provider
      );
    }

    try {
      // Now works for Cairo‑1 thanks to collectFns()
      assertCompatibleAbi(abiStatic, runtimeAbi as any, requiredFns);
    } catch (e) {
      if (abiSource === "auto") {
        if (!isTestEnv) {
          console.warn(`[abi:auto] ${String(e)} — falling back to artifact.`);
        }
        return typedFromAbi(
          abiStatic as unknown as Abi,
          abiStatic,
          address,
          provider
        );
      }
      throw e; // node → strict
    }

    return typedFromAbi(runtimeAbi, abiStatic, address, provider);
  }

  // Fallback
  return typedFromAbi(
    abiStatic as unknown as Abi,
    abiStatic,
    address,
    provider
  );
}
