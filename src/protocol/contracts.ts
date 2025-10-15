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

export const DEFAULT_ABI_SOURCE: AbiSource =
  ((import.meta as any).env?.VITE_DEFAULT_ABI_SOURCE as AbiSource) ??
  "artifact";

// -------------------- Provider & defaults --------------------

/** Default provider: RPC from env, else local devnet. */
export function getDefaultProvider(): ProviderInterface {
  const rpcUrl =
    ((import.meta as any).env?.VITE_STARKNET_RPC as string | undefined) ??
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
  const c = new Contract(abiForRuntime, address, provider);
  return (
    (c as any).typedv2?.(abiForTyping) ??
    (c as any).typedv1?.(abiForTyping) ??
    (c as any)
  );
}

function findFn(abi: readonly any[], name: string) {
  return abi.find((e) => e?.type === "function" && e?.name === name);
}

/** Optional safety: assert required entrypoints exist and match selectors. */
export function assertCompatibleAbi(
  staticAbi: readonly any[],
  runtimeAbi: readonly any[] | undefined,
  requiredFns?: readonly string[]
) {
  if (!requiredFns?.length || !runtimeAbi) return;
  for (const n of requiredFns) {
    const s = findFn(staticAbi, n);
    const r = findFn(runtimeAbi, n);
    if (!s || !r) throw new Error(`ABI mismatch: missing function ${n}`);
    const selS = hash.getSelectorFromName(s.name);
    const selR = hash.getSelectorFromName(r.name);
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
    provider = getDefaultProvider(),
    abiSource,
    requiredFns,
    fetchAbiFromNode,
  } = params;

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
            // Narrow to RpcProvider to keep typings for getClassAt.
            const rpc = provider as RpcProvider;
            const klass = await rpc.getClassAt(
              address,
              safeId as BlockIdentifier
            );
            console.log("address", address);
            console.log("Fetched runtime ABI from node:", klass);
            return (klass as any)?.abi as Abi | undefined;
          })();
    } catch {
      runtimeAbi = undefined;
    }

    if (!runtimeAbi) {
      if (abiSource === "node")
        throw new Error("Failed to fetch ABI from node");
      // auto → fallback to artifact
      return typedFromAbi(
        abiStatic as unknown as Abi,
        abiStatic,
        address,
        provider
      );
    }

    assertCompatibleAbi(abiStatic, runtimeAbi as any, requiredFns);
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
