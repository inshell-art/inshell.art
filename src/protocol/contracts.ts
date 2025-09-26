import { Contract, Abi, BlockIdentifier } from "starknet";
import { rpc } from "@/infra/provider/rpcProvider";

export async function makeContractAt(address: string) {
  // Force a tag your devnet understands
  const klass = await rpc.getClassAt(address, "latest" as BlockIdentifier);
  const abi = (klass as any).abi as Abi; // klass.abi is the JSON ABI array
  return new Contract(abi, address, rpc);
}
