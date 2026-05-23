import {
  JsonRpcProvider,
  type JsonRpcApiProviderOptions,
} from "ethers";

export const JSON_RPC_NO_BATCH_OPTIONS = {
  batchMaxCount: 1,
} satisfies JsonRpcApiProviderOptions;

export const createSingleRequestJsonRpcProvider = (rpcUrl: string) =>
  new JsonRpcProvider(rpcUrl, undefined, JSON_RPC_NO_BATCH_OPTIONS);
