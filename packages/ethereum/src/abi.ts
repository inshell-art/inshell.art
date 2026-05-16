import { parseAbi, toEventSelector } from "viem";

export const pulseAuctionAbi = parseAbi([
  "function getCurrentPrice() view returns (uint256)",
  "function curveActive() view returns (bool)",
  "function getConfig() view returns (uint64 openTime, uint256 genesisPrice, uint256 genesisFloor, uint256 k, uint256 pts)",
  "function getState() view returns (uint64 epochIndex, uint64 startTime, uint64 anchorTime, uint256 floorPrice, bool active)",
  "function bid(uint256 amount)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

export const pulseSaleEventSignature =
  "Sale(address,uint64,uint256,uint64,uint64,uint256)";
export const pulseSaleEventTopic = toEventSelector(pulseSaleEventSignature);

export type LegacyEntrypoint =
  | "get_current_price"
  | "curve_active"
  | "get_config"
  | "get_state"
  | "balance_of"
  | "allowance"
  | "approve"
  | "bid";

type EntrypointDefinition = {
  abi: typeof pulseAuctionAbi | typeof erc20Abi;
  functionName:
    | "getCurrentPrice"
    | "curveActive"
    | "getConfig"
    | "getState"
    | "balanceOf"
    | "allowance"
    | "approve"
    | "bid";
};

const ENTRYPOINTS: Record<string, EntrypointDefinition> = {
  get_current_price: {
    abi: pulseAuctionAbi,
    functionName: "getCurrentPrice",
  },
  getcurrentprice: {
    abi: pulseAuctionAbi,
    functionName: "getCurrentPrice",
  },
  curve_active: {
    abi: pulseAuctionAbi,
    functionName: "curveActive",
  },
  curveactive: {
    abi: pulseAuctionAbi,
    functionName: "curveActive",
  },
  get_config: {
    abi: pulseAuctionAbi,
    functionName: "getConfig",
  },
  getconfig: {
    abi: pulseAuctionAbi,
    functionName: "getConfig",
  },
  get_state: {
    abi: pulseAuctionAbi,
    functionName: "getState",
  },
  getstate: {
    abi: pulseAuctionAbi,
    functionName: "getState",
  },
  balance_of: {
    abi: erc20Abi,
    functionName: "balanceOf",
  },
  balanceof: {
    abi: erc20Abi,
    functionName: "balanceOf",
  },
  allowance: {
    abi: erc20Abi,
    functionName: "allowance",
  },
  approve: {
    abi: erc20Abi,
    functionName: "approve",
  },
  bid: {
    abi: pulseAuctionAbi,
    functionName: "bid",
  },
};

export function resolveEntrypoint(entrypoint: string): EntrypointDefinition {
  const normalized = entrypoint.replace(/[^a-z0-9_]/gi, "").toLowerCase();
  const resolved = ENTRYPOINTS[normalized];
  if (!resolved) {
    throw new Error(`Unsupported contract entrypoint: ${entrypoint}`);
  }
  return resolved;
}
