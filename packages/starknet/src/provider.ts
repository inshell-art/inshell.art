import { RpcProvider, type ProviderInterface, type BlockIdentifier } from "starknet";
import { normalizeBlockId, type StarkBlockId } from "./blockId";

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

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

export async function callContract<T = unknown>(
  provider: ProviderInterface,
  args: Parameters<ProviderInterface["callContract"]>[0],
  blockId?: StarkBlockId
): Promise<T> {
  const { blockIdentifier } = args as { blockIdentifier?: BlockIdentifier };
  const effective = normalizeBlockId(
    (blockId ?? blockIdentifier) as StarkBlockId | undefined
  ) as BlockIdentifier;
  return (await provider.callContract(args, effective)) as T;
}

export async function getEvents<T = unknown>(
  provider: ProviderInterface,
  args: Parameters<RpcProvider["getEvents"]>[0]
): Promise<T> {
  return (await (provider as RpcProvider).getEvents(args)) as T;
}
