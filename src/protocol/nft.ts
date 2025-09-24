import { rpc } from "../infra/provider/rpcProvider";

export async function nft_has_role(nft: string, roleId: string, who: string) {
  const { result } = await rpc.callContract({
    contractAddress: nft,
    entrypoint: "has_role",
    calldata: [roleId, who],
  });
  return result?.[0] !== "0x0";
}
