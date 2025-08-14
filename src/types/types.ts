export type Sale = {
  buyer: string;
  token_id: bigint;
  price: bigint;
  timestamp: bigint;
};

export type AuctionConfig = {
  open_time: bigint;
  k: bigint;
  genesis_price: bigint;
  genesis_floor: bigint;
  pts: bigint;
};
