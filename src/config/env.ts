function requiresEnv(name: string): string {
  const value = import.meta.env[name] as string;
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const addresses = {
  PULSE_AUCTION: requiresEnv("VITE_PULSE_AUCTION"),
  PATH_ADAPTER: requiresEnv("VITE_PATH_ADAPTER"),
  PATH_MINTER: requiresEnv("VITE_PATH_MINTER"),
  PATH_NFT: requiresEnv("VITE_PATH_NFT"),
};

export const rpcUrl = requiresEnv("VITE_RPC_URL");
