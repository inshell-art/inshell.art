import classJson from "@/abi/PulseAuction.contract_class.json";
import { num, hash } from "starknet";

export const PULSE_ADDRESS = "0x0123";
export const PULSE_ABI = classJson.abi;
export const SALE_EVENT_KEY = num.toHex(hash.starknetKeccak("Sale"));

/** PulseAuction syscall selectors by Poseidon */
export const GET_CLASS_HASH_AT_POSEIDON =
  "0x3123204cbb509049aec39e2a42d01d365a12017c0c5694c42f4fc114cf254ff" as const;
export const SEL_BLOCKNUMBER = "";
export const SEL_GET_BLOCK_WITH_TX_HASHES = "";

/** PulseAuction contract selectors by Keccak */
export const GET_INIT_PARAMS = hash.getSelectorFromName("get_init_params");
export const CURVE_ACTIVE = hash.getSelectorFromName("curve_active");
export const GET_CURRENT_PRICE = hash.getSelectorFromName("get_current_price");
export const GET_GENESIS_FLOOR = hash.getSelectorFromName("get_genesis_floor");
