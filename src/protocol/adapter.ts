import { addresses } from "@/config/env";
import { makeContractAt } from "./contracts";
import { rpc } from "@/infra/provider/rpcProvider";

export async function loadAdapterConfig() {
  const adapter = await makeContractAt(addresses.PATH_ADAPTER);
  const result = await rpc.callContract(
    {
      contractAddress: adapter.address,
      entrypoint: "get_config",
      calldata: [],
    },
    "latest"
  );

  const [auction, minter] = result;
  return { auction, minter };
}
