import {
  Provider,
  RpcProvider,
  Contract,
  uint256,
  Uint256,
  events as snEvents,
} from "starknet";
import {
  PULSE_ADDRESS,
  PULSE_ABI,
  SALE_EVENT_KEY,
} from "@/constants/Constants";
import { AuctionConfig, Sale } from "@/types/types";

const provider: Provider = new RpcProvider({
  nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_8", // empty for swc phase for now, will be set while node is running
});

if (import.meta.env.DEV) (window as any).myProvider = provider; // for debugging

const contract = new Contract(PULSE_ABI, PULSE_ADDRESS, provider).typedv2(
  PULSE_ABI
);

export type DecodedSaleType = Extract<
  Awaited<ReturnType<typeof snEvents.parseEvents>>[number],
  { name: "Sale" }
>["data"];

/* ---------- helpers ---------- */
export const isDeployed = async (): Promise<boolean> => {
  try {
    await provider.getClassHashAt(PULSE_ADDRESS, "latest");
    console.log("PulseAuction contract is deployed at", PULSE_ADDRESS);
    return true;
  } catch {
    console.warn("PulseAuction contract is not deployed at", PULSE_ADDRESS);
    return false;
  }
};

export const fetchNow = async (): Promise<number> =>
  Number((await provider.getBlock("latest")).timestamp);

export const fetchCurveActive = async (): Promise<boolean> =>
  await contract.curve_active();

export const fetchCurrentPrice = async (): Promise<bigint> => {
  const raw = await contract.get_current_price();

  // transform the raw value to bigint
  const asUnit256: Uint256 =
    typeof raw === "number" || typeof raw === "bigint"
      ? uint256.bnToUint256(BigInt(raw))
      : (raw as Uint256);

  return uint256.uint256ToBN(asUnit256);
};

/** constructor constants */
type ConfigRaw = [bigint, Uint256, Uint256, Uint256, bigint];

export const fetchAuctionConfig = async (): Promise<AuctionConfig> => {
  const [
    open_time, // u64
    genesis_price, // u256
    genesis_floor, // u256
    k, // u256
    pts, // felt252
  ] = (await contract.get_config()) as ConfigRaw;

  return {
    open_time: BigInt(open_time),
    genesis_price: uint256.uint256ToBN(genesis_price),
    genesis_floor: uint256.uint256ToBN(genesis_floor),
    k: uint256.uint256ToBN(k),
    pts: BigInt(pts),
  };
};

/** stream of Sale events (for the chart) */
export const fetchSales = async (limit = 100): Promise<Sale[]> => {
  const res = await provider.getEvents({
    address: PULSE_ADDRESS,
    keys: [[SALE_EVENT_KEY]],
    chunk_size: limit,
    from_block: { block_number: 0 }, // start from genesis
  });

  const Sales: Sale[] = res.events
    .filter((e) => e.keys.length >= 3 && e.keys[0] === SALE_EVENT_KEY)
    .map((e) => ({
      buyer: e.keys[1],
      token_id: BigInt(e.keys[2]),
      price: uint256.uint256ToBN({
        low: BigInt(e.data[0]),
        high: BigInt(e.data[1]),
      }),
      timestamp: BigInt(e.data[2]),
    }));

  return Sales;
};
