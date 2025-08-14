/** prepare mocked data here */
import { generatePulseSales } from "./generatePulseSales";
import { SALE_EVENT_KEY } from "@/constants/Constants";
import { Sale, AuctionConfig } from "@/types/types";

const WAD = 10n ** 18n;
const toWei = (value: number | bigint) => BigInt(value) * WAD;

const k = 1_000_000n * WAD; // 1M STRK in wei
const genesisPrice = toWei(1000); // 1000 STRK in wei
const genesisFloor = toWei(900); // 900 STRK in wei
const pts = 10n ** 17n; // 0.1 STRK per second in wei

const openTimestamp = 1_700_000_000; // 2023-11-01T00:00:00Z in unix seconds
const startTimestamp = openTimestamp + 60 * 60; // 1 hour later
const startBlock = 100_000; // arbitrary block number for the start

export const mockNow = startTimestamp + 10 * 60; // mock current time as 10 minutes after the start

export const cfg: AuctionConfig = {
  open_time: BigInt(openTimestamp),
  k,
  genesis_price: genesisPrice,
  genesis_floor: genesisFloor,
  pts,
};

export const mockAuctionConfig = (cfg: AuctionConfig): string[] => [
  toFelt(cfg.open_time),
  ...encodeUint256(cfg.genesis_price),
  ...encodeUint256(cfg.genesis_floor),
  ...encodeUint256(cfg.k),
  toFelt(cfg.pts),
];

export const mockGenesisFloor = genesisFloor;

const mockSales = generatePulseSales({
  count: 100,
  startTimestamp,
  durationSec: 60 * 60, // 1 hour
  startBlock,
  k,
  floor0: genesisFloor,
  genesisPrice,
  pts,
  contract: "0x1234567890123456789012345678901234567890", // mock contract address
  saleSelector: SALE_EVENT_KEY,
  buyerPool: [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
  ],
});
// Helper to encode Uint256
export const encodeUint256 = (value: bigint): [string, string] => {
  const low = value & ((1n << 128n) - 1n);
  const high = value >> 128n;
  return [`0x${low.toString(16)}`, `0x${high.toString(16)}`];
};

export const toFelt = (v: bigint | number | string) =>
  `0x${BigInt(v).toString(16)}`;
