import { RpcProvider } from "starknet";

const RPC_URL = import.meta.env.VITE_RPC_URL as string;
if (!RPC_URL) throw new Error("VITE_RPC_URL is not set");
export const rpc = new RpcProvider({ nodeUrl: RPC_URL });
console.log("RPC Provider set to", RPC_URL);
