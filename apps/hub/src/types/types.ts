import { U256Num } from "@inshell/utils";

export type AuctionConfig = {
  openTimeSec: number;
  genesisPrice: U256Num;
  genesisFloor: U256Num;
  k: U256Num;
  pts: string;
};

export type AuctionSnapshot = {
  active: boolean;
  price: U256Num;
  config: AuctionConfig;
};

export type Sale = {
  buyer: string;
  token_id: bigint;
  price: bigint;
  timestamp: bigint;
};
