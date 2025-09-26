import { addresses } from "@/config/env";
import { makeContractAt } from "./contracts";
import { rpc } from "@/infra/provider/rpcProvider";

export async function getAdapter() {
  return await makeContractAt(addresses.PATH_ADAPTER);
}

export async function loadAdapterConfig() {
  const adapter = await getAdapter();
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

export async function loadAdapterConfig1() {
  const adapter = await getAdapter();

  const out = await adapter.call("get_config", [], {
    blockIdentifier: "latest",
  });
  const { auction, minter } = out as { auction: string; minter: string };
  return { auction, minter };
}

//todo: the code looks useless, remove it?
