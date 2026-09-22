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

type LocalPathDeployment = {
  schema?: unknown;
  chainId?: unknown;
  releaseTag?: unknown;
  releasePublicationCommit?: unknown;
  contractSourceCommit?: unknown;
  manifestSha256?: unknown;
  contracts?: Record<
    string,
    { address?: unknown; deployBlock?: unknown; codeHash?: unknown }
  >;
  auction?: {
    openTime?: unknown;
    k?: unknown;
    genesisPrice?: unknown;
    genesisFloor?: unknown;
    pts?: unknown;
  };
};

function localPathRelease(): ProtocolRelease | undefined {
  const runtime = (globalThis as any).__INSHELL_THOUGHT_CONTRACT_RUNTIME__;
  const deployment = runtime?.pathDeployment as LocalPathDeployment | undefined;
  if (
    runtime?.schema !== "inshell.thought.v2.anvil-gallery-runtime.v1" ||
    runtime?.status !== "ready" ||
    deployment?.schema !== "inshell.path.local-deployment.v1" ||
    deployment.releaseTag !== "v0.5.0" ||
    deployment.releasePublicationCommit !==
      "085cfc084b0e568740e0da639e968eb535f7e5c8" ||
    deployment.contractSourceCommit !==
      "5a1ab1f137e76c80dc69045dc520454f6e07cbb1" ||
    deployment.manifestSha256 !==
      "a81355b459b40faea894cf1dfb7f484765a7ec62672039dd62d58a3a52849921" ||
    deployment.chainId !== runtime.chainId ||
    !Number.isSafeInteger(deployment.chainId)
  ) {
    return undefined;
  }

  const contractKeys = ["pathNft", "pathPulseAdapter", "pulseAuction"] as const;
  const snakeCase = {
    pathNft: "path_nft",
    pathPulseAdapter: "path_pulse_adapter",
    pulseAuction: "pulse_auction",
  } as const;
  const contracts: Record<string, string> = {};
  const deployBlocks: Record<string, number> = {};
  const codeHashes: Record<string, string> = {};
  for (const key of contractKeys) {
    const record = deployment.contracts?.[key];
    if (
      typeof record?.address !== "string" ||
      !/^0x[a-fA-F0-9]{40}$/.test(record.address) ||
      typeof record.deployBlock !== "number" ||
      !Number.isSafeInteger(record.deployBlock) ||
      record.deployBlock < 0 ||
      typeof record.codeHash !== "string" ||
      !/^0x[a-fA-F0-9]{64}$/.test(record.codeHash)
    ) {
      return undefined;
    }
    contracts[snakeCase[key]] = record.address;
    deployBlocks[snakeCase[key]] = record.deployBlock;
    codeHashes[snakeCase[key]] = record.codeHash;
  }

  const auction = deployment.auction;
  if (
    !auction ||
    typeof auction.openTime !== "number" ||
    !Number.isSafeInteger(auction.openTime) ||
    [auction.k, auction.genesisPrice, auction.genesisFloor, auction.pts].some(
      (value) => typeof value !== "string" || !/^\d+$/.test(value),
    )
  ) {
    return undefined;
  }

  return {
    schema_version: 2,
    protocol: "path",
    network: "devnet",
    chain_id: Number(deployment.chainId),
    repo_commit: deployment.contractSourceCommit,
    deploy_run_id: `thought-lane-${deployment.releaseTag}`,
    release_tier: "temporary",
    contracts,
    deploy_blocks: deployBlocks,
    code_hashes: codeHashes,
    config: {
      open_time: auction.openTime,
      k: String(auction.k),
      genesis_price: String(auction.genesisPrice),
      genesis_floor: String(auction.genesisFloor),
      pts: String(auction.pts),
      token_base: 1,
      epoch_base: 1,
    },
    status: {
      ready_for_fe: true,
      postconditions: "pass",
      audit: "local-runtime",
      notes: "Validated PATH v0.5 deployment in the dedicated THOUGHT Anvil lane",
    },
  };
}

function getEnv(name: string): any {
  const envCache: Record<string, any> | undefined =
    (globalThis as any).__VITE_ENV__;
  const buildEnv: Record<string, any> | undefined =
    (globalThis as any).__INSHELL_VITE_ENV__;
  const procEnv = (globalThis as any)?.process?.env;
  return envCache?.[name] ?? buildEnv?.[name] ?? procEnv?.[name];
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
  if (network === "devnet") {
    const local = localPathRelease();
    if ((globalThis as any).__INSHELL_THOUGHT_CONTRACT_RUNTIME__ != null) {
      return local;
    }
    if (local) return local;
  }
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
