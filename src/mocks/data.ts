/** prepare mocked data here */
import { generatePulseSales } from "./generatePulseSales";
import { SALE_EVENT_KEY } from "@/constants/PulseAuction";

const WAD = 10n ** 18n;
const toWei = (value: number | bigint) => BigInt(value) * WAD;

const k = 1_000_000n * WAD; // 1M STRK in wei
const floor0 = toWei(900); // 900 STRK in wei
const genesisPrice = toWei(1000); // 1000 STRK in wei
const pts = 10n ** 17n; // 0.1 STRK per second in wei

const openTimestamp = 1_700_000_000; // 2023-11-01T00:00:00Z in unix seconds
const startTimestamp = openTimestamp + 60 * 60; // 1 hour later
const startBlock = 100_000; // arbitrary block number for the start

const sales: [number, number] = [10, 20]; // intervals in seconds for each sale
const duration: [number, number] = [60, 120]; // durations in seconds for each sale

export const mockNow = startTimestamp + 10 * 60; // mock current time as 10 minutes after the start

//todo: Clarify the requirements and dev the interface in Pulse contract
export const mockInitParams = {
  k,
  openTimestamp,
  genesisPrice,
};

export const mockGenesisFloor = floor0;

export const mockSales = generatePulseSales({
  sales,
  startTimestamp,
  duration,
  startBlock,
  k,
  floor0,
  genesisPrice,
  pts,
  contract: "0x1234567890abcdef1234567890abcdef12345678",
  saleSelector: SALE_EVENT_KEY,
});
