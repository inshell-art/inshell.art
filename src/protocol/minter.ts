import { rpc } from "../infra/provider/rpcProvider";

export async function minter_has_role(
  minter: string,
  roleId: string,
  who: string
) {
  const { result } = await rpc.callContract({
    contractAddress: minter,
    entrypoint: "has_role",
    calldata: [roleId, who],
  });
  return result?.[0] !== "0x0";
}
