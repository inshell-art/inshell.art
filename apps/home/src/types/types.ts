import { U256Num } from "@inshell/utils";

export type AuctionConfig = {
  openTimeSec: number;
  genesisPrice: U256Num;
  genesisFloor: U256Num;
  k: U256Num;
  pts: string;
};

export type AuctionRuntimeState = {
  epochIndex: number;
  startTimeSec: number;
  anchorTimeSec: number;
  floorPrice: U256Num;
  active: boolean;
};

export type AuctionSnapshot = {
  active: boolean;
  price: U256Num;
  config: AuctionConfig;
  state: AuctionRuntimeState | null;
};

export type Sale = {
  buyer: string;
  token_id: bigint;
  price: bigint;
  timestamp: bigint;
};
