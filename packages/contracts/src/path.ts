import type { ProviderInterface, TypedContractV2 } from "starknet";
import { makeTypedContract } from "./contracts";
import { resolveAddress } from "./addressBook";
import { type AbiSource } from "./types";
import PathNftAbiJson from "./abi/devnet/PathNFT.json";

const PathNftAbi = PathNftAbiJson as unknown as readonly any[];

export type PathNftContract = TypedContractV2<typeof PathNftAbi>;

export async function createPathNftContract(opts?: {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
}) {
  const address = opts?.address ?? resolveAddress("path_nft");
  return makeTypedContract({
    address,
    abiStatic: PathNftAbi,
    provider: opts?.provider,
    abiSource: opts?.abiSource,
  });
}

export type PathLookContract = TypedContractV2<typeof PathNftAbi>;

export async function createPathLookContract(opts?: {
  address?: string;
  provider?: ProviderInterface;
  abiSource?: AbiSource;
}) {
  const address = opts?.address ?? resolveAddress("path_look");
  return makeTypedContract({
    address,
    abiStatic: PathNftAbi,
    provider: opts?.provider,
    abiSource: opts?.abiSource,
  });
}
