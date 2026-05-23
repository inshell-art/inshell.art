import {
  JsonRpcProvider,
  type Networkish,
  type JsonRpcApiProviderOptions,
} from "ethers";

export const JSON_RPC_NO_BATCH_OPTIONS = {
  batchMaxCount: 1,
} satisfies JsonRpcApiProviderOptions;

export const createSingleRequestJsonRpcProvider = (
  rpcUrl: string,
  network?: Networkish,
) =>
  new JsonRpcProvider(
    rpcUrl,
    network,
    network
      ? {
          ...JSON_RPC_NO_BATCH_OPTIONS,
          staticNetwork: true,
        }
      : JSON_RPC_NO_BATCH_OPTIONS,
  );
