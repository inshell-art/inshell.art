import { num, hash } from "starknet";

export { ABI as PULSE_ABI } from "@/generated/pulse_PulseAuction.abi";
export const PULSE_ADDRESS = "0x0123";
export const SALE_EVENT_KEY = num.toHex(hash.starknetKeccak("Sale"));

/** PulseAuction syscall selectors by Poseidon */
export const GET_CLASS_HASH_AT_POSEIDON =
  "0x3123204cbb509049aec39e2a42d01d365a12017c0c5694c42f4fc114cf254ff" as const;
export const SEL_BLOCKNUMBER = "";
export const SEL_GET_BLOCK_WITH_TX_HASHES = "";

/** PulseAuction contract selectors by Keccak */
export const GET_AUCTION_CONFIG = hash.getSelectorFromName("get_config");
export const CURVE_ACTIVE = hash.getSelectorFromName("curve_active");
export const GET_CURRENT_PRICE = hash.getSelectorFromName("get_current_price");
export const GET_GENESIS_FLOOR = hash.getSelectorFromName("get_genesis_floor");
