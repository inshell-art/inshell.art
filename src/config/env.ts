export const addrs = {
  PULSE_AUCTION: (import.meta.env.VITE_PULSE_AUCTION as string) || "",
  PATH_ADAPTER: (import.meta.env.VITE_PATH_ADAPTER as string) || "",
  PATH_MINTER: (import.meta.env.VITE_PATH_MINTER as string) || "",
  PATH_NFT: (import.meta.env.VITE_PATH_NFT as string) || "",
  STRK: (import.meta.env.VITE_STRK as string) || "",
};

export const rpcUrl = import.meta.env.VITE_RPC_URL as string;
