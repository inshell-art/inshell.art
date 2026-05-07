import devnet from "./releases/release.devnet.json";
import sepolia from "./releases/release.sepolia.json";

type ReleaseBook = Record<string, unknown>;

export type ProtocolRelease = {
  schema_version: 2;
  protocol: "path";
  network: "devnet" | "sepolia" | "mainnet";
  chain_id: number;
  repo_commit: string;
  deploy_run_id: string;
  release_tier: "temporary" | "candidate" | "final";
  contracts: Record<string, string>;
  deploy_blocks: Record<string, number>;
  code_hashes?: Record<string, string>;
  config?: {
    open_time?: number;
    open_time_iso?: string;
    k?: string;
    genesis_price?: string;
    genesis_floor?: string;
    pts?: string;
    token_base?: number;
    epoch_base?: number;
  };
  status?: {
    ready_for_fe?: boolean;
    postconditions?: string;
    audit?: string;
    notes?: string;
  };
};

const RELEASES: Record<string, ReleaseBook> = {
  devnet,
  sepolia,
};

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? procEnv?.[name];
}

function currentNetwork(): string {
  return getEnv("VITE_NETWORK") ?? "devnet";
}

function isProtocolRelease(value: unknown): value is ProtocolRelease {
  const release = value as ProtocolRelease;
  return (
    release != null &&
    typeof release === "object" &&
    release.schema_version === 2 &&
    release.protocol === "path" &&
    typeof release.network === "string" &&
    typeof release.chain_id === "number" &&
    release.contracts != null &&
    typeof release.contracts === "object" &&
    release.deploy_blocks != null &&
    typeof release.deploy_blocks === "object"
  );
}

export function getProtocolRelease(
  network = currentNetwork()
): ProtocolRelease | undefined {
  const release = RELEASES[network];
  return isProtocolRelease(release) ? release : undefined;
}

export function getProtocolReleaseAddress(
  id: string,
  network = currentNetwork()
): string | undefined {
  const release = getProtocolRelease(network);
  const value = release?.contracts?.[id.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}

export function getProtocolReleaseDeployBlock(
  id: string,
  network = currentNetwork()
): number | undefined {
  const release = getProtocolRelease(network);
  const value = release?.deploy_blocks?.[id.toLowerCase()];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : undefined;
}

export function getProtocolReleaseChainId(
  network = currentNetwork()
): number | undefined {
  const value = getProtocolRelease(network)?.chain_id;
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : undefined;
}

export function getProtocolReleaseCodeHash(
  id: string,
  network = currentNetwork()
): string | undefined {
  const value = getProtocolRelease(network)?.code_hashes?.[id.toLowerCase()];
  return typeof value === "string" ? value : undefined;
}
