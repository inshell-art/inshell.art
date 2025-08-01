import { Provider, RpcProvider, Contract, uint256 } from "starknet";
import {
  PULSE_ADDRESS,
  PULSE_ABI,
  SALE_EVENT_KEY,
} from "@/constants/PulseAuction";

const provider: Provider = new RpcProvider({
  nodeUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_8", // empty for swc phase for now, will be set while node is running
});

if (import.meta.env.DEV) (window as any).myProvider = provider; // for debugging

const contract = new Contract(PULSE_ABI, PULSE_ADDRESS, provider);

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

export const fetchNow = async () =>
  Number((await provider.getBlock("latest")).timestamp);

export const fetchCurveActive = async () => await contract.curve_active();

export const fetchCurrentPrice = async () =>
  uint256.uint256ToBN(await contract.get_current_price());

/** constructor constants */
//todo: combine genesis floor and init params into one call
export const fetchInitParams = async () => {
  const { k, open_time, genesis_price, genesis_floor, pts } =
    await contract.get_init_params();
  return {
    k,
    open_time: Number(open_time),
    genesis_price: uint256.uint256ToBN(genesis_price),
    genesis_floor: uint256.uint256ToBN(genesis_floor),
    pts, //todo: need to confirm the unit of pts in js
  };
};

/** stream of Sale events (for the chart) */
export async function fetchSales(limit: number) {
  const res = await provider.getEvents({
    address: PULSE_ADDRESS,
    keys: [[SALE_EVENT_KEY]],
    chunk_size: limit,
    from_block: { block_number: 0 }, // start from genesis
  });
  return res.events;
}
