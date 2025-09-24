import { rpc } from "../infra/provider/rpcProvider";

export async function adapter_get_config(adapter: string) {
  // returns [auction, minter]
  const { result } = await rpc.callContract({
    contractAddress: adapter,
    entrypoint: "get_config",
    calldata: [],
  });
  return { auction: result?.[0], minter: result?.[1] };
}

import { Contract } from "starknet";
import AdapterAbi from "../../abi/PathMinterAdapter.json";

import { addrs } from "../config/env";

const adapter = new Contract(AdapterAbi, addrs.PATH_ADAPTER, rpc);
const { auction, minter } = await adapter.get_config(); // decoded fields
